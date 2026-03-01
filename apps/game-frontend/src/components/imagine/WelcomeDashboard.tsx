'use client';

import { useState } from 'react';
import { useChatStore } from '@/stores/chatStore';

const SUGGESTIONS = [
  { text: 'Plan my product launch', prompt: 'Help me plan a product launch with a timeline, milestones, and team assignments' },
  { text: 'Research competitors', prompt: 'Research my top competitors and create a comparison report' },
  { text: 'Draft a pitch deck', prompt: 'Help me create a pitch deck outline for my YC application' },
  { text: 'Organize my tasks', prompt: 'Help me organize my tasks and set up a project management workflow' },
];

export function WelcomeDashboard() {
  const [input, setInput] = useState('');
  const openChat = useChatStore((s) => s.openChat);
  const sendMessage = useChatStore((s) => s.sendMessage);

  const handleSend = (text: string) => {
    if (!text.trim()) return;
    openChat('receptionist');
    setTimeout(() => {
      sendMessage('receptionist', text.trim());
    }, 100);
  };

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center pt-11">
      <div
        className="flex flex-col items-center gap-0 w-full max-w-[600px] px-6"
        style={{ animation: 'imagineSlideUp 600ms ease-out' }}
      >
        {/* Wordmark */}
        <h1 className="text-[48px] font-light text-imagine-canvas-text tracking-tight leading-tight">
          Boss<span className="text-imagine-terracotta">Room</span>
        </h1>

        <p className="text-base text-imagine-canvas-text-sec mt-1">
          What do you want to build?
        </p>

        {/* Prompt pill */}
        <div className="mt-8 w-full max-w-[560px]">
          <div className="flex items-center bg-imagine-window-warm rounded-[26px] h-[52px] px-5 shadow-md border border-imagine-divider focus-within:shadow-lg transition-shadow">
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
              placeholder="Describe anything — an app, a dashboard, a tool..."
              className="flex-1 bg-transparent text-sm text-imagine-canvas-text placeholder:text-imagine-canvas-text-dim focus:outline-none"
            />
            <button
              onClick={() => {
                handleSend(input);
                setInput('');
              }}
              disabled={!input.trim()}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                input.trim()
                  ? 'bg-imagine-terracotta text-white hover:bg-imagine-terracotta-hover scale-100'
                  : 'bg-black/[0.06] text-imagine-canvas-text-dim opacity-40 scale-90'
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 12V2M7 2L2 7M7 2L12 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Suggestion chips */}
        <div className="flex flex-wrap justify-center gap-2 mt-4 w-full max-w-[560px]">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.text}
              onClick={() => handleSend(s.prompt)}
              className="px-3.5 py-1.5 rounded-full text-xs bg-imagine-window-warm text-imagine-canvas-text-sec border border-imagine-divider hover:bg-imagine-window-alt hover:text-imagine-canvas-text transition-colors cursor-pointer"
            >
              {s.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
