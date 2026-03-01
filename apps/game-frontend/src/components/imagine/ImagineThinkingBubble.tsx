'use client';

import { useChatStore, type ChatMessage } from '@/stores/chatStore';
import { useWorldStore } from '@/stores/worldStore';

export function ImagineThinkingBubble() {
  const activeAgent = useChatStore((s) => s.activeAgent);
  const agents = useWorldStore((s) => s.agents);
  const chatMessages = useChatStore((s) => s.chatMessages);

  const agent = agents.find((a) => a.id === activeAgent);
  const isActive = agent && (agent.status === 'thinking' || agent.status === 'working');

  const messages = activeAgent ? (chatMessages[activeAgent] ?? []) : [];
  const currentTool = messages.findLast(
    (m): m is Extract<ChatMessage, { role: 'tool' }> =>
      m.role === 'tool' && m.status === 'started',
  );

  if (!isActive) return null;

  return (
    <div
      className="fixed top-16 right-6 z-30"
      style={{ animation: 'imagineFadeScale 350ms ease-out' }}
    >
      <div className="relative">
        {/* Shadows */}
        <div className="absolute -inset-1 rounded-[18px] bg-black/[0.08] blur-sm" />
        <div className="absolute -inset-2 rounded-[20px] bg-black/[0.05] blur-md" />

        <div className="relative w-[280px] bg-imagine-window-warm rounded-2xl border border-black/[0.06] p-4">
          {/* Pulsing dots */}
          <div className="flex items-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-imagine-terracotta"
                style={{
                  animation: `imaginePulse 1.2s ease-in-out infinite ${i * 200}ms`,
                }}
              />
            ))}
            <span className="ml-2 text-xs text-imagine-canvas-text-sec">
              {agent.status === 'thinking' ? 'Thinking' : 'Working'}
            </span>
          </div>

          {/* Current tool */}
          {currentTool && (
            <div className="mt-2 pt-2 border-t border-imagine-divider flex items-center gap-1.5">
              <span className="text-xs text-imagine-canvas-text-dim">Running</span>
              <span className="text-xs font-semibold text-imagine-canvas-text">
                {currentTool.toolName}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
