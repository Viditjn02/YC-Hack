/** Heads-up display: logo, connection status, agent roster with live activity. */
'use client';

import { useMemo } from 'react';
import { useWorldStore } from '@/stores/worldStore';
import { useChatStore } from '@/stores/chatStore';
import { useAuthStore } from '@/stores/authStore';
import { useActivityStore } from '@/stores/activityStore';
import { gameSocket } from '@/lib/websocket';
import { statusColors, statusLabels } from '@/data/agents';
import { ModeToggle } from '@/components/imagine/ModeToggle';

function formatToolName(raw: string): string {
  const parts = raw.split('_');
  if (parts.length > 1) {
    return parts
      .slice(1)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }
  return raw.replace(/([A-Z])/g, ' $1').trim();
}

function AgentActivityLabel({ agentId }: { agentId: string }) {
  const events = useActivityStore((s) => s.events);
  const lastEvent = useMemo(
    () => events.filter((e) => e.agentId === agentId && e.type === 'tool' && e.toolStatus === 'started').at(-1),
    [events, agentId],
  );

  if (!lastEvent) return null;

  return (
    <span className="text-[9px] text-yellow-400/70 truncate max-w-[120px] block">
      {formatToolName(lastEvent.toolName!)}...
    </span>
  );
}

export function HUD() {
  const connected = useWorldStore((s) => s.connected);
  const agents = useWorldStore((s) => s.agents);
  const user = useAuthStore((s) => s.user);
  const worldReset = useWorldStore((s) => s.reset);
  const chatReset = useChatStore((s) => s.reset);
  const openChat = useChatStore((s) => s.openChat);
  const authSignOut = useAuthStore((s) => s.signOut);

  const handleSignOut = () => {
    gameSocket.disconnect();
    worldReset();
    chatReset();
    authSignOut();
  };

  return (
    <div className="fixed top-0 left-0 right-0 p-4 flex justify-between items-start pointer-events-none z-40">
      {/* Left: Logo + connection */}
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold text-white tracking-tight">
          Boss<span className="text-indigo-400">Room</span>
        </h1>
        <div className="flex items-center gap-1.5 bg-black/40 rounded-full px-2.5 py-1">
          <div
            className={`w-2 h-2 rounded-full ${
              connected ? 'bg-green-400' : 'bg-yellow-400 animate-pulse'
            }`}
          />
          <span className="text-[10px] text-white/50">
            {connected ? 'Online' : 'Offline'}
          </span>
        </div>
        <div className="pointer-events-auto">
          <ModeToggle />
        </div>
        {user && (
          <div className="flex items-center gap-2 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-1.5 pointer-events-auto">
            {user.photoURL && (
              <img
                src={user.photoURL}
                alt="User avatar"
                className="w-6 h-6 rounded-full"
              />
            )}
            <span className="text-xs text-white/60">
              {user.displayName ?? user.email}
            </span>
            <button
              onClick={handleSignOut}
              className="text-[10px] text-white/40 hover:text-white cursor-pointer"
            >
              Sign out
            </button>
          </div>
        )}
      </div>

      {/* Right: Agent roster with activity */}
      <div className="flex flex-col gap-1">
        {agents.map((agent) => (
          <div
            key={agent.id}
            onClick={() => openChat(agent.id)}
            className="flex items-center gap-2 bg-black/50 hover:bg-white/10 backdrop-blur-sm rounded-lg px-3 py-2 pointer-events-auto cursor-pointer transition-colors min-w-[180px]"
          >
            <div className="relative shrink-0">
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  agent.status === 'working' || agent.status === 'thinking'
                    ? 'animate-pulse'
                    : ''
                }`}
                style={{ backgroundColor: statusColors[agent.status] }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-white font-medium">
                  {agent.name}
                </span>
                {statusLabels[agent.status] && (
                  <span className="text-[10px] text-white/40">{statusLabels[agent.status]}</span>
                )}
              </div>
              {(agent.status === 'working' || agent.status === 'thinking') && (
                <AgentActivityLabel agentId={agent.id} />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
