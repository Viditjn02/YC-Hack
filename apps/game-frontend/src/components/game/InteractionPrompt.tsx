/** "Press E to talk to [Agent]" or "Hold T to talk to [Player]" overlay. */
'use client';

import { useWorldStore } from '@/stores/worldStore';
import { useChatStore } from '@/stores/chatStore';

export function InteractionPrompt() {
  const nearestTarget = useWorldStore((s) => s.nearestTarget);
  const agents = useWorldStore((s) => s.agents);
  const remotePlayers = useWorldStore((s) => s.remotePlayers);
  const chatPanelOpen = useChatStore((s) => s.chatPanelOpen);

  if (!nearestTarget || chatPanelOpen) return null;

  if (nearestTarget.type === 'agent') {
    const agent = agents.find((a) => a.id === nearestTarget.id);
    if (!agent) return null;

    return (
      <div
        className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50
          px-6 py-3 rounded-xl bg-black/70 backdrop-blur-sm border border-white/10
          text-white text-sm font-medium pointer-events-none
          animate-[fadeIn_0.2s_ease-out]"
      >
        Press{' '}
        <kbd className="px-2 py-0.5 mx-1 rounded bg-white/15 border border-white/20 text-xs font-mono">
          E
        </kbd>{' '}
        to chat or hold{' '}
        <kbd className="px-2 py-0.5 mx-1 rounded bg-white/15 border border-white/20 text-xs font-mono">
          T
        </kbd>{' '}
        to talk to{' '}
        <span style={{ color: agent.color }}>{agent.name}</span>
      </div>
    );
  }

  // Player target
  const player = remotePlayers[nearestTarget.id];
  if (!player) return null;

  return (
    <div
      className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50
        px-6 py-3 rounded-xl bg-black/70 backdrop-blur-sm border border-white/10
        text-white text-sm font-medium pointer-events-none
        animate-[fadeIn_0.2s_ease-out] flex items-center gap-4"
    >
      Hold{' '}
      <kbd className="px-2 py-0.5 mx-1 rounded bg-white/15 border border-white/20 text-xs font-mono">
        T
      </kbd>{' '}
      to talk to{' '}
      <span className="text-blue-400">{player.username}</span>
    </div>
  );
}
