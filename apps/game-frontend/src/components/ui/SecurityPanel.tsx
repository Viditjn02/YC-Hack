'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useSecurityStore, type SecurityEvent } from '@/stores/securityStore';

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 5) return 'now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function SeverityBadge({ severity }: { severity: 'low' | 'high' }) {
  return (
    <span
      className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
        severity === 'high'
          ? 'bg-red-500/20 text-red-400 ring-1 ring-red-500/30'
          : 'bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/30'
      }`}
    >
      {severity}
    </span>
  );
}

function ActionBadge({ action }: { action: SecurityEvent['action'] }) {
  const styles = {
    blocked: 'bg-red-500/20 text-red-400',
    sanitized: 'bg-yellow-500/20 text-yellow-400',
    rate_limited: 'bg-orange-500/20 text-orange-400',
  };
  const labels = {
    blocked: 'BLOCKED',
    sanitized: 'SANITIZED',
    rate_limited: 'RATE LIMITED',
  };
  return (
    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${styles[action]}`}>
      {labels[action]}
    </span>
  );
}

function SecurityEventRow({ event }: { event: SecurityEvent }) {
  return (
    <div className="px-3 py-2.5 rounded-lg hover:bg-white/[0.03] transition-colors border-l-2 border-l-red-500/50">
      {/* Header: severity + action + time */}
      <div className="flex items-center gap-2 mb-1.5">
        <SeverityBadge severity={event.severity} />
        <ActionBadge action={event.action} />
        <span className="text-[9px] text-white/20 ml-auto shrink-0">{timeAgo(event.timestamp)}</span>
      </div>

      {/* Agent name */}
      <div className="text-[11px] text-white/60 mb-1">
        Target: <span className="text-white/80 font-medium">{event.agentName}</span>
      </div>

      {/* Patterns */}
      <div className="flex flex-wrap gap-1 mb-1.5">
        {event.patterns.map((p) => (
          <span key={p} className="px-1.5 py-0.5 bg-white/5 rounded text-[9px] text-white/50 font-mono">
            {p}
          </span>
        ))}
      </div>

      {/* Input snippet */}
      <div className="text-[10px] text-white/30 font-mono bg-white/[0.02] rounded px-2 py-1 break-all">
        &quot;{event.inputSnippet}{event.inputSnippet.length >= 100 ? '...' : ''}&quot;
      </div>

      {/* LLM Classification */}
      {event.llmClassification && (
        <div className="mt-1.5 text-[10px] bg-white/[0.02] rounded px-2 py-1.5">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-white/40">LLM Judge:</span>
            <span className={event.llmClassification.isInjection ? 'text-red-400 font-bold' : 'text-green-400'}>
              {event.llmClassification.isInjection ? 'INJECTION' : 'SAFE'}
            </span>
            <span className="text-white/30">
              ({Math.round(event.llmClassification.confidence * 100)}% confidence)
            </span>
          </div>
          <div className="text-white/30 italic">{event.llmClassification.reason}</div>
        </div>
      )}
    </div>
  );
}

export function SecurityPanel() {
  const events = useSecurityStore((s) => s.events);
  const clear = useSecurityStore((s) => s.clear);
  const [open, setOpen] = useState(false);
  const [, setTick] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events.length]);

  useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(interval);
  }, [open]);

  const recentEvents = useMemo(() => events.slice(-50), [events]);

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className={`fixed bottom-4 left-4 z-50 flex items-center gap-2 px-3 py-2 rounded-xl transition-all cursor-pointer ${
          open
            ? 'bg-red-600/90 text-white'
            : 'bg-black/60 hover:bg-black/80 text-white/60 hover:text-white'
        } backdrop-blur-sm border border-white/10`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        <span className="text-xs font-medium">Security</span>
        {events.length > 0 && !open && (
          <span className="flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-[9px] text-white font-bold animate-pulse">
            {events.length > 99 ? '99+' : events.length}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed left-4 bottom-16 w-[420px] z-50 bg-gray-950/95 backdrop-blur-md rounded-xl border border-red-500/20 overflow-hidden max-h-[70vh] flex flex-col animate-[fadeIn_0.2s_ease-out]">
          {/* Header */}
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
              <span className="text-sm font-semibold text-white">Security Monitor</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/30">{events.length} events</span>
              {events.length > 0 && (
                <button
                  onClick={clear}
                  className="text-[10px] text-white/30 hover:text-white/60 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Events */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/15 [&::-webkit-scrollbar-thumb]:rounded-full">
            {recentEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-white/25 text-xs gap-2">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-30">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <span>No security events detected</span>
                <span className="text-[10px] text-white/15">Guardrails are active and monitoring</span>
              </div>
            ) : (
              recentEvents.map((event) => (
                <SecurityEventRow key={event.id} event={event} />
              ))
            )}
            <div ref={bottomRef} />
          </div>

          {/* Footer: guardrail status */}
          <div className="px-4 py-2 border-t border-white/5 flex items-center gap-3 text-[9px] text-white/20">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Regex Scanner
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              LLM Classifier
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Rate Limiter
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Output Scanner
            </span>
          </div>
        </div>
      )}
    </>
  );
}
