'use client';

interface AgentAvatarProps {
  name: string;
  color: string;
  className?: string;
}

export function AgentAvatar({ name, color, className = 'w-10 h-10' }: AgentAvatarProps) {
  return (
    <div
      className={`${className} rounded-lg flex items-center justify-center text-white font-bold`}
      style={{ backgroundColor: color }}
    >
      {name[0]}
    </div>
  );
}
