interface CallControlsProps {
  isMuted: boolean;
  isRecording: boolean;
  autoRecord: boolean;
  toggleMute: () => void;
  toggleRecording: () => void;
  endCall: () => void;
}

const CallControls: React.FC<CallControlsProps> = ({
  isMuted,
  isRecording,
  autoRecord,
  toggleMute,
  toggleRecording,
  endCall,
}) => {
  return (
    <div className="flex flex-row gap-2 mt-4">
      <button
        onClick={toggleMute}
        className={`px-4 py-2 rounded ${
          isMuted ? "bg-yellow-500" : "bg-blue-500"
        } text-white`}
      >
        {isMuted ? "Unmute" : "Mute"}
      </button>
      {!autoRecord && (
        <button
          onClick={toggleRecording}
          className={`px-4 py-2 rounded ${
            isRecording ? "bg-red-500" : "bg-green-500"
          } text-white`}
        >
          {isRecording ? "Stop Recording" : "Start Recording"}
        </button>
      )}
      <button
        onClick={endCall}
        className="bg-red-500 text-white px-4 py-2 rounded"
      >
        End Call
      </button>
    </div>
  );
};

export default CallControls;
