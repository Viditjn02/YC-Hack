'use client';

import { useState } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { useBrowserUseStore } from '@/stores/browserUseStore';

const SUGGESTIONS = [
  { emoji: '\u{1F680}', text: 'Build me a landing page', prompt: 'Build me a modern landing page with hero section, features, and pricing' },
  { emoji: '\u{1F4CA}', text: 'Create a dashboard', prompt: 'Create a data analytics dashboard with charts and KPI cards' },
  { emoji: '\u{1F4DD}', text: 'Draft a pitch deck', prompt: 'Help me create a pitch deck outline for my YC application' },
];

const STICKY_NOTES = [
  { text: 'Your agents are standing by', rotation: -4, x: 6, y: 8 },
  { text: 'Ask anything,\nwe\'ll figure it out', rotation: 3, x: 18, y: 6 },
  { text: 'Think big', rotation: -2, x: 4, y: 32 },
];

export function WelcomeDashboard() {
  const [input, setInput] = useState('');
  const openChat = useChatStore((s) => s.openChat);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const activeSessions = useBrowserUseStore((s) => s.activeSessions);
  const browserSession = activeSessions.size > 0 ? Array.from(activeSessions.values())[0] : null;

  const handleSend = (text: string) => {
    if (!text.trim()) return;
    openChat('receptionist');
    setTimeout(() => {
      sendMessage('receptionist', text.trim());
    }, 100);
  };

  return (
    <div className="absolute inset-0 z-10 pt-11">
      {/* Sticky notes scattered on desktop */}
      {STICKY_NOTES.map((note, i) => (
        <div
          key={i}
          className="absolute select-none pointer-events-none"
          style={{
            left: `${note.x}%`,
            top: `${note.y}%`,
            transform: `rotate(${note.rotation}deg)`,
            animation: `imagineSlideUp ${500 + i * 150}ms ease-out`,
          }}
        >
          <div className="w-[150px] min-h-[100px] bg-[#FFEEA3] shadow-md p-4 text-[13px] leading-snug text-[#5a5240] font-medium whitespace-pre-line"
            style={{ fontFamily: 'Georgia, serif' }}
          >
            {note.text}
          </div>
        </div>
      ))}

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-end pb-28">
        {/* Live browser panel when an agent is browsing */}
        {browserSession?.liveUrl && (
          <div
            className="w-full max-w-[640px] mb-5 px-4"
            style={{ animation: 'imagineSlideUp 400ms ease-out' }}
          >
            <div className="rounded-2xl overflow-hidden border shadow-2xl"
              style={{
                borderColor: 'rgba(6, 182, 212, 0.3)',
                boxShadow: '0 0 40px rgba(6, 182, 212, 0.1), 0 20px 40px rgba(0,0,0,0.12)',
                background: '#0c0c14',
              }}
            >
              <div className="flex items-center justify-between px-4 py-2"
                style={{ background: 'rgba(6, 182, 212, 0.06)' }}
              >
                <div className="flex items-center gap-2">
                  <div className="relative flex items-center justify-center w-4 h-4 shrink-0">
                    <div className="absolute w-4 h-4 rounded-full bg-cyan-500/25 animate-ping" />
                    <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.8)]" />
                  </div>
                  <span className="text-[11px] text-cyan-300/80 font-medium">
                    {browserSession.agentName}&apos;s Browser
                  </span>
                </div>
                <a
                  href={browserSession.liveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/30 hover:text-white/60 p-1 rounded hover:bg-white/10 transition-colors"
                  title="Open in new tab"
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M10 2h4v4M6 10l8-8M14 9v5a1 1 0 01-1 1H3a1 1 0 01-1-1V4a1 1 0 011-1h5" />
                  </svg>
                </a>
              </div>
              <iframe
                src={browserSession.liveUrl}
                title={`${browserSession.agentName} browser session`}
                className="w-full border-0"
                style={{ height: 340, background: '#111118' }}
                sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
              />
            </div>
          </div>
        )}

        {/* Suggestion cards */}
        <div
          className="flex gap-3 mb-5"
          style={{ animation: 'imagineSlideUp 600ms ease-out' }}
        >
          {SUGGESTIONS.map((s) => (
            <button
              key={s.text}
              onClick={() => handleSend(s.prompt)}
              className="w-[200px] bg-white/90 backdrop-blur-sm rounded-xl p-4 text-left shadow-md border border-black/[0.05] hover:shadow-lg hover:scale-[1.02] transition-all cursor-pointer group"
            >
              <span className="text-xl mb-2 block">{s.emoji}</span>
              <span className="text-[13px] text-[#444] font-medium group-hover:text-[#222] transition-colors">{s.text}</span>
            </button>
          ))}
        </div>

        {/* Prompt pill */}
        <div
          className="w-full max-w-[560px] px-4"
          style={{ animation: 'imagineSlideUp 700ms ease-out' }}
        >
          <div className="flex items-center bg-white/95 backdrop-blur-md rounded-[26px] h-[52px] px-5 shadow-xl border border-black/[0.08] focus-within:shadow-2xl transition-shadow">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(input);
                  setInput('');
                }
              }}
              placeholder="What do you want to build?"
              className="flex-1 bg-transparent text-sm text-[#333] placeholder:text-[#aaa] focus:outline-none"
            />
            <div className="flex items-center gap-2">
              <button className="w-8 h-8 rounded-full flex items-center justify-center text-[#bbb] hover:text-[#888] transition-colors cursor-pointer">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              </button>
              <button
                onClick={() => {
                  handleSend(input);
                  setInput('');
                }}
                disabled={!input.trim()}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                  input.trim()
                    ? 'bg-imagine-terracotta text-white hover:brightness-110 scale-100'
                    : 'bg-black/[0.06] text-[#bbb] opacity-40 scale-90'
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 12V2M7 2L2 7M7 2L12 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
