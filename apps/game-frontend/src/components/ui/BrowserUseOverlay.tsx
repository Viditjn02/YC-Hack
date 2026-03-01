'use client';

import { useBrowserUseStore } from '@/stores/browserUseStore';
import { useEmbedStore } from '@/stores/embedStore';

export function BrowserUseOverlay() {
  const activeSessions = useBrowserUseStore((s) => s.activeSessions);
  const openPanel = useEmbedStore((s) => s.openPanel);

  if (activeSessions.size === 0) return null;

  const sessions = Array.from(activeSessions.values());

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-auto">
      {sessions.map((session) => (
        <div
          key={session.agentId}
          className="bg-gray-900/95 backdrop-blur-md border border-cyan-500/30 rounded-2xl px-5 py-3.5
            shadow-[0_0_30px_rgba(6,182,212,0.15)] animate-[fadeIn_0.3s_ease-out]
            flex items-center gap-4 min-w-[340px]"
        >
          {/* Pulsing dot */}
          <div className="relative flex items-center justify-center w-8 h-8 shrink-0">
            <div className="absolute w-8 h-8 rounded-full bg-cyan-500/20 animate-ping" />
            <div className="relative w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.6)]" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {session.agentName} is browsing the web
            </p>
            <p className="text-xs text-white/40 mt-0.5">
              Browser Use is running
            </p>
          </div>

          {session.liveUrl && (
            <button
              onClick={openPanel}
              className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium
                bg-cyan-500/15 text-cyan-300 border border-cyan-500/20
                hover:bg-cyan-500/25 hover:border-cyan-500/40 transition-all"
            >
              View
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
