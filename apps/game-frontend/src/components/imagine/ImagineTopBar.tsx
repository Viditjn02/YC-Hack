'use client';

import { useWorldStore } from '@/stores/worldStore';
import { useAuthStore } from '@/stores/authStore';
import { gameSocket } from '@/lib/websocket';
import { useChatStore } from '@/stores/chatStore';
import { ModeToggle } from './ModeToggle';

interface Props {
  canvasMode: boolean;
}

export function ImagineTopBar({ canvasMode }: Props) {
  const connected = useWorldStore((s) => s.connected);
  const agents = useWorldStore((s) => s.agents);
  const user = useAuthStore((s) => s.user);
  const worldReset = useWorldStore((s) => s.reset);
  const chatReset = useChatStore((s) => s.reset);
  const authSignOut = useAuthStore((s) => s.signOut);

  const handleSignOut = () => {
    gameSocket.disconnect();
    worldReset();
    chatReset();
    authSignOut();
  };

  return (
    <div
      className={`fixed top-0 left-0 right-0 h-11 z-30 flex items-center justify-between px-6 transition-all duration-300 ${
        canvasMode
          ? 'bg-[#b3bab1]/60 backdrop-blur-md border-b border-white/[0.12]'
          : 'bg-[#181825]/80 backdrop-blur-sm border-b border-white/[0.06]'
      }`}
    >
      <div className="flex items-center gap-3">
        <h1
          className={`text-base font-bold tracking-tight ${
            canvasMode ? 'text-imagine-canvas-text' : 'text-white'
          }`}
        >
          Boss<span className={canvasMode ? 'text-imagine-terracotta' : 'text-indigo-400'}>Room</span>
        </h1>
        <div
          className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] ${
            canvasMode ? 'bg-black/[0.05]' : 'bg-white/[0.08]'
          }`}
        >
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              connected ? 'bg-green-500' : 'bg-yellow-400 animate-pulse'
            }`}
          />
          <span className={canvasMode ? 'text-imagine-canvas-text-sec' : 'text-white/50'}>
            {agents.length} agents
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <ModeToggle canvasMode={canvasMode} />
        {user && (
          <div className="flex items-center gap-2">
            {user.photoURL && (
              <img src={user.photoURL} alt="" className="w-6 h-6 rounded-full" />
            )}
            <span
              className={`text-xs ${
                canvasMode ? 'text-imagine-canvas-text-sec' : 'text-white/60'
              }`}
            >
              {user.displayName ?? user.email}
            </span>
            <button
              onClick={handleSignOut}
              className={`text-[10px] cursor-pointer hover:underline ${
                canvasMode ? 'text-imagine-canvas-text-dim' : 'text-white/40'
              }`}
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
