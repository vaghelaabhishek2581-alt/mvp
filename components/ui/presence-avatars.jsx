import * as React from "react"

const PresenceAvatars = ({ users = [] }) => {
  return (
    <div className="flex -space-x-2">
      {users.slice(0, 3).map((user, index) => (
        <div
          key={user.socketId || index}
          className="w-8 h-8 rounded-full bg-blue-500 border-2 border-white flex items-center justify-center text-white text-xs font-semibold"
          style={{ backgroundColor: user.userInfo?.color || '#3B82F6' }}
          title={user.userInfo?.name || user.userId}
        >
          {(user.userInfo?.name || user.userId)?.charAt(0)?.toUpperCase() || 'U'}
        </div>
      ))}
      {users.length > 3 && (
        <div className="w-8 h-8 rounded-full bg-gray-500 border-2 border-white flex items-center justify-center text-white text-xs font-semibold">
          +{users.length - 3}
        </div>
      )}
    </div>
  )
}

export { PresenceAvatars }