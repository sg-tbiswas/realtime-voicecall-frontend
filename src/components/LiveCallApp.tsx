"use client";

import { useState, useEffect, useRef } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import io, { Socket } from "socket.io-client";
import IncomingCallModal from "./IncomingCallModal";

let socketInstance: Socket | null = null;

const LiveCallApp = () => {
  const { data: session } = useSession();
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [inCall, setInCall] = useState(false);
  const [callPartner, setCallPartner] = useState<any>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const isSocketInitialized = useRef(false);
  const callPartnerRef = useRef<any>(null);
  const inCallRef = useRef(false);
  const iceCandidatesQueue = useRef<RTCIceCandidate[]>([]);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [callDuration, setCallDuration] = useState(0); // in seconds
  const callDurationRef = useRef<number>(0); // To store duration when call is paused
  const timerRef = useRef<NodeJS.Timeout | null>(null); // To store interval ID
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const autoRecordRef = useRef(false);

  useEffect(() => {
    if (session && !socketInstance) {
      console.log("Session detected, connecting to socket");

      socketInstance = io("https://call.sentientgeeks.us", {
        path: "/socket",
      });

      socketInstance.on("connect", () => {
        console.log("Connected to socket server");
        socketInstance?.emit("user-online", {
          userId: session.user.id,
          name: session.user.name,
          socketId: socketInstance.id,
        });
      });

      socketInstance.on("online-users", (users) => {
        console.log("Received online users:", users);
        setOnlineUsers(
          users.filter((user: any) => user.userId !== session.user.id)
        );
      });

      socketInstance.on("call-request", async (data: any) => {
        console.log("Incoming call request from:", data.caller);
        setIncomingCall(data.caller);
        if (ringtoneRef.current) {
          ringtoneRef.current.play().catch((err) => {
            console.error("Error playing ringtone:", err);
          });
        }
      });

      socketInstance.on("call-accepted", async (data: any) => {
        inCallRef.current = true;
        callPartnerRef.current = data.caller;
        setInCall(true);
        setCallPartner(data.caller);
        await setupMediaDevices();
        createOffer(data.caller);
        startCallTimer();
        if (autoRecordRef.current == true) {
          startRecording();
        }
      });

      socketInstance.on("call-rejected", () => {
        alert("Call was rejected");
        endCall();
      });

      socketInstance.on("webrtc-offer", async (data: any) => {
        console.log("Received WebRTC Offer", data);
        await handleOffer(data);
      });

      socketInstance.on("webrtc-answer", async (data: any) => {
        console.log("Received WebRTC Answer", data);
        await handleAnswer(data);
      });

      socketInstance.on("webrtc-ice-candidate", async (data: any) => {
        console.log("Received ICE Candidate", data.candidate);
        const candidate = new RTCIceCandidate(data.candidate);
        if (peerConnectionRef.current?.remoteDescription) {
          await peerConnectionRef.current.addIceCandidate(candidate);
        } else {
          iceCandidatesQueue.current.push(candidate);
        }
      });

      socketInstance.on("call-ended", () => {
        console.log("Call ended by the other user");
        endCall();
      });

      socketRef.current = socketInstance;
      isSocketInitialized.current = true;
    }

    return () => {
      console.log("Disconnecting socket");
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        socketInstance = null;
        isSocketInitialized.current = false;
      }
    };
  }, [session]);

  const startCallTimer = () => {
    callDurationRef.current = 0;
    setCallDuration(0);

    timerRef.current = setInterval(() => {
      callDurationRef.current += 1;
      setCallDuration(callDurationRef.current);
    }, 1000); // Update the timer every second
  };

  const formatCallDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? "0" : ""}${remainingSeconds}`;
  };

  const handleAccept = () => {
    setIncomingCall(null);
    inCallRef.current = true;
    callPartnerRef.current = incomingCall;
    setInCall(true);
    setCallPartner(incomingCall);
    setupMediaDevices();
    startCallTimer();
    socketInstance?.emit("call-accepted", {
      to: incomingCall.socketId,
    });
    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current.currentTime = 0;
    }
    if (autoRecordRef.current == true) {
      startRecording();
    }
  };

  const handleReject = () => {
    setIncomingCall(null);
    socketInstance?.emit("call-rejected", {
      to: incomingCall.socketId,
    });
    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current.currentTime = 0;
    }
    if (isRecording) {
      stopRecording(); // Stop recording if it was started
    }
  };

  const startRecording = () => {
    if (!localStreamRef.current) {
      console.error("No local stream available");
      return;
    }

    recordedChunksRef.current = []; // Clear previous recordings

    try {
      const mediaRecorder = new MediaRecorder(localStreamRef.current, {
        mimeType: "audio/webm",
      });

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        console.log("MediaRecorder stopped");
      };

      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      console.log("Recording started");
    } catch (error) {
      console.error("Error starting recording:", error);
    }
  };

  const stopRecording = () => {
    if (
      !mediaRecorderRef.current ||
      mediaRecorderRef.current.state === "inactive"
    ) {
      console.log("No active recording to stop");
      return;
    }

    return new Promise<void>((resolve) => {
      mediaRecorderRef.current!.onstop = () => {
        console.log("Processing recorded data");
        if (recordedChunksRef.current.length === 0) {
          console.error("No recorded data available");
          setIsRecording(false);
          resolve();
          return;
        }

        const audioBlob = new Blob(recordedChunksRef.current, {
          type: "audio/webm",
        });
        const audioUrl = URL.createObjectURL(audioBlob);

        const link = document.createElement("a");
        link.href = audioUrl;
        link.download = "call-recording.webm";
        link.click();

        URL.revokeObjectURL(audioUrl);
        setIsRecording(false);
        console.log("Recording stopped and saved");
        resolve();
      };

      mediaRecorderRef.current!.stop();
    });
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const setupMediaDevices = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true, // Request only audio
      });
      localStreamRef.current = stream;
      return stream;
    } catch (error) {
      console.error("Error accessing audio device:", error);
      alert("Error accessing microphone. Please check your device.");
    }
  };

  const createPeerConnection = async () => {
    peerConnectionRef.current = new RTCPeerConnection({
      iceServers: [
        {
          urls: "stun:75.119.158.149:3478",
        },
      ],
    });

    peerConnectionRef.current.onicecandidate = handleICECandidateEvent;
    peerConnectionRef.current.ontrack = handleTrackEvent;

    const stream = await setupMediaDevices();
    if (stream) {
      stream.getTracks().forEach((track) => {
        peerConnectionRef.current?.addTrack(track, stream);
        console.log("Track added to peer connection:", track);
      });
    }
  };

  const createOffer = async (caller: any) => {
    await setupMediaDevices();
    await createPeerConnection();
    const offer = await peerConnectionRef.current?.createOffer();
    if (offer) {
      await peerConnectionRef.current?.setLocalDescription(offer);
      console.log("Call partner:", callPartnerRef.current);
      socketRef.current?.emit("webrtc-offer", {
        offer: offer,
        to: caller.socketId,
      });
    }
  };

  const handleOffer = async (data: any) => {
    console.log("Handling offer from:", data);
    await createPeerConnection();
    await peerConnectionRef.current?.setRemoteDescription(
      new RTCSessionDescription(data?.data?.offer)
    );
    const answer = await peerConnectionRef.current?.createAnswer();
    if (answer) {
      await peerConnectionRef.current?.setLocalDescription(answer);
      socketRef.current?.emit("webrtc-answer", {
        answer: answer,
        to: data.caller.socketId,
      });
    }

    // Add queued ICE candidates
    while (iceCandidatesQueue.current.length > 0) {
      const candidate = iceCandidatesQueue.current.shift();
      if (candidate) {
        await peerConnectionRef.current?.addIceCandidate(candidate);
      }
    }
  };

  const handleAnswer = async (data: any) => {
    await peerConnectionRef.current?.setRemoteDescription(
      new RTCSessionDescription(data.answer)
    );

    // Add queued ICE candidates
    while (iceCandidatesQueue.current.length > 0) {
      const candidate = iceCandidatesQueue.current.shift();
      if (candidate) {
        await peerConnectionRef.current?.addIceCandidate(candidate);
      }
    }
  };

  const handleICECandidateEvent = (event: RTCPeerConnectionIceEvent) => {
    if (event.candidate) {
      console.log("Sending ICE Candidate", event, callPartnerRef.current);
      socketRef.current?.emit("webrtc-ice-candidate", {
        candidate: event.candidate,
        to: callPartnerRef.current?.socketId,
      });
    }
  };

  const handleTrackEvent = (event: RTCTrackEvent) => {
    console.log("Track event received:", event);

    if (event.track.kind === "audio") {
      console.log("Audio track received:", event.track);

      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = event.streams[0];

        // Attempt to play the audio
        remoteAudioRef.current
          .play()
          .then(() => {
            console.log("Audio is playing.");
          })
          .catch((error) => {
            console.error("Error playing audio:", error);
          });

        // Log the stream and tracks
        console.log("Audio stream:", event.streams[0]);
        event.streams[0].getTracks().forEach((track) => {
          console.log("Stream track:", track);
        });
      }
    }
  };

  const initiateCall = (user: any) => {
    console.log("Initiating call to:", user);
    callPartnerRef.current = user;
    setCallPartner(user);
    socketRef.current?.emit("call-request", { to: user.socketId });
  };

  const endCall = async () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
    inCallRef.current = false;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    socketRef.current?.emit("call-ended", {
      to: callPartnerRef.current?.socketId,
    });
    callPartnerRef.current = null;
    setInCall(false);
    setCallPartner(null);
    setCallDuration(0);
    setIsMuted(false);
    autoRecordRef.current = false;
    if (isRecording) {
      await stopRecording();
    }
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        if (track.kind === "audio") {
          track.enabled = !track.enabled; // Toggle the enabled property
        }
      });
    }
    setIsMuted((prev) => !prev); // Update mute state
  };

  return (
    <>
      <IncomingCallModal
        caller={incomingCall}
        onAccept={handleAccept}
        onReject={handleReject}
      />
      <div className="container mx-auto px-4">
        <h1 className="text-3xl font-bold mb-4">One-on-One Audio Call App</h1>
        {session ? (
          <>
            <div className="flex flex-row justify-between">
              <p>
                Logged in as: {session.user.name} (ID: {session.user.id})
              </p>
              <button
                onClick={() => signOut()}
                className="bg-red-500 text-white px-4 py-2 rounded"
              >
                Sign Out
              </button>
            </div>
            {inCall ? (
              <div className="mt-4">
                <h2 className="text-xl mb-2">
                  In call with {callPartner?.name}
                </h2>
                <p>Call Duration: {formatCallDuration(callDuration)}</p>
                <div className="flex flex-row gap-2 mt-4">
                  <button
                    onClick={toggleMute}
                    className={`px-4 py-2 rounded ${
                      isMuted ? "bg-yellow-500" : "bg-blue-500"
                    } text-white`}
                  >
                    {isMuted ? "Unmute" : "Mute"}
                  </button>

                  {!autoRecordRef.current && (
                    <button
                      onClick={toggleRecording}
                      className={`px-4 py-2 rounded ${
                        isRecording ? "bg-red-500" : "bg-green-500"
                      } text-white`}
                    >
                      {isRecording ? "Stop Recording" : "Start Recording"}
                    </button>
                  )}
                  {/* Audio-only, no video elements */}
                  <button
                    onClick={endCall}
                    className="bg-red-500 text-white px-4 py-2 rounded"
                  >
                    End Call
                  </button>
                </div>
                <audio ref={remoteAudioRef} autoPlay />
              </div>
            ) : (
              <>
                <h2 className="text-xl mt-4 mb-2">
                  Online Users ({onlineUsers.length})
                </h2>
                <ul className="space-y-2">
                  {onlineUsers.map((user) => (
                    <li
                      key={user.userId}
                      className="flex items-center justify-between bg-gray-100 p-2 rounded"
                    >
                      <span>
                        {user.name} (ID: {user.userId})
                      </span>
                      <button
                        onClick={() => initiateCall(user)}
                        className="bg-blue-500 text-white px-4 py-2 rounded"
                      >
                        Call
                      </button>
                      <button
                        onClick={() => {
                          autoRecordRef.current = true;
                          initiateCall(user);
                        }}
                        className="bg-purple-500 text-white px-4 py-2 rounded"
                      >
                        Call & Record
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        ) : (
          <button
            onClick={() => signIn()}
            className="bg-green-500 text-white px-4 py-2 rounded"
          >
            Sign In
          </button>
        )}
        <audio ref={ringtoneRef} src="/audio/ringtone.mp3" loop />
      </div>
    </>
  );
};

export default LiveCallApp;
