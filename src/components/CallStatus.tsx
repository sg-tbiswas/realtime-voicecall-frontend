interface CallStatusProps {
  callPartner: any;
  callDuration: number;
  remoteAudioRef: React.RefObject<HTMLAudioElement>;
  formatCallDuration: (seconds: number) => string;
}

const CallStatus: React.FC<CallStatusProps> = ({
  callPartner,
  callDuration,
  remoteAudioRef,
  formatCallDuration,
}) => {
  return (
    <div className="mt-4">
      <h2 className="text-xl mb-2">In call with {callPartner?.name}</h2>
      <p>Call Duration: {formatCallDuration(callDuration)}</p>
      <audio ref={remoteAudioRef} autoPlay />
    </div>
  );
};

export default CallStatus;
