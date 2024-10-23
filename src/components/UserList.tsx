const UserList = ({
  onlineUsers,
  initiateCall,
  initiateCallWithRecording,
}: {
  onlineUsers: any[];
  initiateCall: (user: any) => void;
  initiateCallWithRecording: (user: any) => void;
}) => {
  return (
    <>
      <h2 className="text-xl mt-4 mb-2">Online Users ({onlineUsers.length})</h2>
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
              onClick={() => initiateCallWithRecording(user)}
              className="bg-purple-500 text-white px-4 py-2 rounded"
            >
              Call & Record
            </button>
          </li>
        ))}
      </ul>
    </>
  );
};

export default UserList;
