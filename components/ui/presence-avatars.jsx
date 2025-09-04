import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export function PresenceAvatars({ users }) {
  return (
    <TooltipProvider>
      <div className="flex -space-x-2">
        {users.map((user) => (
          <Tooltip key={user.socketId}>
            <TooltipTrigger>
              <Avatar 
                className="h-8 w-8 border-2 border-white"
                style={{ borderColor: user.userInfo?.color || '#ccc' }}
              >
                <AvatarFallback style={{ backgroundColor: user.userInfo?.color || '#ccc' }}>
                  {user.userId?.charAt(0)?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent>
              <p>{user.userInfo?.name || user.userId}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}