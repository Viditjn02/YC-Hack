'use client';

import { useState, useEffect } from 'react';
import { useChatStore } from '@/stores/chatStore';

export function ImagineActivitySidebar() {
  const [open, setOpen] = useState(false);
  const chatMessages = useChatStore((s) => s.chatMessages);

  // Ctrl+. to toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === '.') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Collect all tool executions across agents
  const toolEvents: { agentId: string; toolName: string; status: string }[] = [];
  for (const [agentId, msgs] of Object.entries(chatMessages)) {
    for (const msg of msgs) {
      if (msg.role === 'tool') {
        toolEvents.push({ agentId, toolName: msg.toolName, status: msg.status });
      }
    }
  }

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className={`fixed top-16 right-4 z-30 w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
          open
            ? 'bg-[#89b4fa]/20 text-[#89b4fa]'
            : 'bg-white/[0.06] text-white/40 hover:text-white/60 hover:bg-white/10'
        }`}
        title="Activity (Ctrl+.)"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 4h10M2 7h7M2 10h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {/* Sidebar panel */}
      <div
        className={`fixed top-11 right-0 bottom-0 w-[280px] z-20 bg-[#181825]/95 backdrop-blur-sm border-l border-white/[0.06] transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-4">
          <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">
            Activity
          </h3>

          {toolEvents.length === 0 ? (
            <p className="text-xs text-white/25 italic">No activity yet</p>
          ) : (
            <div className="space-y-1.5 max-h-[calc(100vh-100px)] overflow-y-auto">
              {toolEvents.map((evt, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.03]"
                >
                  <div
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      evt.status === 'started'
                        ? 'bg-yellow-400 animate-pulse'
                        : evt.status === 'completed'
                          ? 'bg-green-400'
                          : 'bg-red-400'
                    }`}
                  />
                  <span className="text-[11px] text-white/50 truncate">
                    {evt.toolName}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
