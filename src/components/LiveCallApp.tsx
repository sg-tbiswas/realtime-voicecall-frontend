"use client";

import { useState, useEffect, useRef } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import io, { Socket } from "socket.io-client";

const LiveCallApp = () => {
  const { data: session } = useSession();
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [inCall, setInCall] = useState(false);
  const [callPartner, setCallPartner] = useState<any>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const isSocketInitialized = useRef(false);

  useEffect(() => {
    if (session && !isSocketInitialized.current) {
      console.log("Session detected, connecting to socket");
      socketRef.current = io("https://call.sentientgeeks.us", {
        path: "/socket",
      });

      socketRef.current.on("connect", () => {
        console.log("Connected to socket server");
        socketRef.current?.emit("user-online", {
          userId: session.user.id,
          name: session.user.name,
          socketId: socketRef.current.id,
        });
      });

      socketRef.current.on("online-users", (users) => {
        console.log("Received online users:", users);
        setOnlineUsers(
          users.filter((user: any) => user.userId !== session.user.id)
        );
      });

      socketRef.current.on("call-request", async (data: any) => {
        console.log("Incoming call request from:", data.caller);
        if (window.confirm(`${data.caller.name} is calling. Answer?`)) {
          setInCall(true);
          setCallPartner(data.caller);
          await setupMediaDevices();
          socketRef.current?.emit("call-accepted", {
            to: data.caller.socketId,
          });
        } else {
          socketRef.current?.emit("call-rejected", {
            to: data.caller.socketId,
          });
        }
      });

      socketRef.current.on("call-accepted", async (data: any) => {
        setInCall(true);
        await setupMediaDevices();
        createOffer(data.caller);
      });

      socketRef.current.on("call-rejected", () => {
        alert("Call was rejected");
        endCall();
      });

      socketRef.current.on("webrtc-offer", async (data: any) => {
        console.log("Received WebRTC Offer", data);
        await handleOffer(data);
      });

      socketRef.current.on("webrtc-answer", async (data: any) => {
        console.log("Received WebRTC Answer", data);
        await handleAnswer(data);
      });

      socketRef.current.on("webrtc-ice-candidate", async (data: any) => {
        console.log("Received ICE Candidate", data.candidate);
        const candidate = new RTCIceCandidate(data.candidate);
        await peerConnectionRef.current?.addIceCandidate(candidate);
      });

      isSocketInitialized.current = true;
    }

    return () => {
      console.log("Disconnecting socket");
      if (socketRef.current) {
        socketRef.current.disconnect();
        isSocketInitialized.current = false;
      }
    };
  }, [session]);

  const setupMediaDevices = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true, // Request only audio
      });
      return stream;
    } catch (error) {
      console.error("Error accessing audio device:", error);
      alert("Error accessing microphone. Please check your device.");
    }
  };

  const createPeerConnection = async () => {
    peerConnectionRef.current = new RTCPeerConnection({
      iceServers: [{ urls: "stun.l.google.com:19302" }],
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
      console.log("Call partner:", callPartner);
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
  };

  const handleAnswer = async (data: any) => {
    await peerConnectionRef.current?.setRemoteDescription(
      new RTCSessionDescription(data.answer)
    );
  };

  const handleICECandidateEvent = (event: RTCPeerConnectionIceEvent) => {
    if (event.candidate) {
      console.log("Sending ICE Candidate", event);
      socketRef.current?.emit("webrtc-ice-candidate", {
        candidate: event.candidate,
        to: callPartner?.socketId,
      });
    }
  };

  const handleTrackEvent = (event: RTCTrackEvent) => {
    console.log("Track event received:", event);

    if (event.track.kind === "audio") {
      console.log("Audio track received:", event.track);

      const audioElement = new Audio();
      audioElement.srcObject = event.streams[0];

      // Attempt to play the audio
      audioElement
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
  };

  const initiateCall = async (user: any) => {
    console.log("Initiating call to:", user);
    setCallPartner(user);
    socketRef.current?.emit("call-request", { to: user.socketId });
  };

  const endCall = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    setInCall(false);
    setCallPartner(null);
  };

  useEffect(() => {
    console.log("Call partner changed:", callPartner);
  }, [callPartner]);

  return (
    <div className="container mx-auto px-4">
      <h1 className="text-3xl font-bold mb-4">One-on-One Audio Call App</h1>
      {session ? (
        <>
          <p>
            Logged in as: {session.user.name} (ID: {session.user.id})
          </p>
          <button
            onClick={() => signOut()}
            className="bg-red-500 text-white px-4 py-2 rounded"
          >
            Sign Out
          </button>
          {inCall ? (
            <div className="mt-4">
              <h2 className="text-xl mb-2">In call with {callPartner.name}</h2>
              {/* Audio-only, no video elements */}
              <button
                onClick={endCall}
                className="bg-red-500 text-white px-4 py-2 rounded mt-4"
              >
                End Call
              </button>
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
    </div>
  );
};

export default LiveCallApp;
