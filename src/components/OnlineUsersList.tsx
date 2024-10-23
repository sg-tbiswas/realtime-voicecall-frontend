interface OnlineUsersListProps {
  onlineUsers: any[];
  initiateCall: (user: any) => void;
  initiateCallWithRecording: (user: any) => void;
}

const OnlineUsersList: React.FC<OnlineUsersListProps> = ({
  onlineUsers,
  initiateCall,
  initiateCallWithRecording,
}) => {
  return (
    <div>
      <h2 className="text-xl mt-4 mb-2">Online Users ({onlineUsers.length})</h2>
      <ul className="space-y-2">
        {onlineUsers.map((user) => (
          <li
            key={user.userId}
            className="flex items-center justify-between bg-gray-100 p-2 rounded flex-col sm:flex-row"
          >
            <span>
              {user.name} (ID: {user.userId})
            </span>
            <div className="flex justify-between gap-5 pt-1 sm:pt-0 w-full sm:w-auto">
              <button
                onClick={() => initiateCall(user)}
                className="bg-blue-500 text-white px-4 py-2 rounded"
              >
                Call
              </button>
              <button
                onClick={() => initiateCallWithRecording(user)}
                className="bg-purple-500 text-white px-4 py-2 rounded"
              >
                Call & Record
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default OnlineUsersList;
