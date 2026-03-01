'use client';

import { useState } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { useSettingsStore } from '@/stores/settingsStore';

interface Props {
  embedded?: boolean;
}

export function ImaginePromptBar({ embedded }: Props) {
  const [input, setInput] = useState('');
  const activeAgent = useChatStore((s) => s.activeAgent);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const isLoadingWorkspace = useChatStore((s) => s.isLoadingWorkspace);
  const purchaseMode = useSettingsStore((s) => s.purchaseMode);
  const purchaseBudget = useSettingsStore((s) => s.purchaseBudget);

  const handleSend = () => {
    if (!input.trim() || !activeAgent || isLoadingWorkspace) return;
    sendMessage(activeAgent, input.trim(), 'text', { purchaseMode, purchaseBudget });
    setInput('');
  };

  if (embedded) {
    return (
      <div className="px-6 py-4 border-t border-white/[0.06] bg-[#181825]">
        <div className="flex items-center gap-3 max-w-[800px] mx-auto">
          <div className="flex-1 flex items-center bg-[#313244] rounded-[20px] h-[44px] px-4 border border-white/[0.06] focus-within:border-[#89b4fa]/40 transition-colors">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={activeAgent ? 'Type a message...' : 'Select an agent'}
              disabled={isLoadingWorkspace}
              className="flex-1 bg-transparent text-sm text-[#cdd6f4] placeholder:text-[#6c7086] focus:outline-none disabled:opacity-50"
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoadingWorkspace}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-[#89b4fa] text-[#1e1e2e] hover:bg-[#9dc4fa] disabled:bg-[#45475a] disabled:text-[#6c7086] transition-colors cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 12V2M7 2L2 7M7 2L12 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // Floating canvas-mode prompt bar
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20">
      <div className="relative">
        {/* Multi-layer shadow */}
        <div className="absolute -inset-x-2 -inset-y-1 rounded-[35px] bg-black/10 blur-sm" />
        <div className="absolute -inset-x-3 -inset-y-1.5 rounded-[37px] bg-black/[0.07] blur-md" />
        <div className="absolute -inset-x-5 -inset-y-2.5 rounded-[40px] bg-black/[0.04] blur-lg" />

        <div className="relative flex items-center bg-imagine-window-warm rounded-[26px] h-[52px] px-5 border border-imagine-divider w-[min(640px,calc(100vw-120px))]">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Let's make something"
            className="flex-1 bg-transparent text-sm text-imagine-canvas-text placeholder:text-imagine-canvas-text-dim focus:outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              input.trim()
                ? 'bg-imagine-terracotta text-white hover:bg-imagine-terracotta-hover'
                : 'bg-black/[0.06] text-imagine-canvas-text-dim opacity-40'
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 12V2M7 2L2 7M7 2L12 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
