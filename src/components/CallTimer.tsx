const CallTimer = ({ callDuration }: { callDuration: number }) => {
  const formatCallDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? "0" : ""}${remainingSeconds}`;
  };

  return <p>Call Duration: {formatCallDuration(callDuration)}</p>;
};

export default CallTimer;
