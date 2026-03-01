'use client';

import { useRef, useEffect } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { useWorldStore } from '@/stores/worldStore';
import { ImagineChatBubble } from './ImagineChatBubble';
import { ImaginePromptBar } from './ImaginePromptBar';
import { ImagineAgentRoster } from './ImagineAgentRoster';

export function ImagineChat() {
  const activeAgent = useChatStore((s) => s.activeAgent);
  const chatMessages = useChatStore((s) => s.chatMessages);
  const streamingText = useChatStore((s) => s.streamingText);
  const agents = useWorldStore((s) => s.agents);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const messages = activeAgent ? (chatMessages[activeAgent] ?? []) : [];
  const currentStream = activeAgent ? (streamingText[activeAgent] ?? '') : '';
  const agent = agents.find((a) => a.id === activeAgent);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, currentStream]);

  return (
    <div className="absolute inset-0 z-10 flex flex-col pt-11">
      {/* Agent roster tabs */}
      <ImagineAgentRoster />

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {/* Agent name label */}
        {agent && (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-[#89b4fa]">
              {agent.name}
            </span>
            <span className="text-[10px] text-white/30">
              {agent.description}
            </span>
          </div>
        )}

        {messages.map((msg, i) => {
          if (msg.role === 'tool') {
            return (
              <div key={i} className="flex justify-center py-0.5">
                <span className="text-[11px] text-white/25 italic">
                  {msg.status === 'started'
                    ? `Running ${msg.toolName}...`
                    : msg.status === 'failed'
                      ? `${msg.toolName} failed`
                      : `${msg.toolName} done`}
                </span>
              </div>
            );
          }

          if (msg.role === 'products') {
            return (
              <div key={i} className="flex flex-wrap gap-2 py-2">
                {msg.products.map((p, j) => (
                  <a
                    key={j}
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block bg-[#313244] rounded-xl p-3 max-w-[240px] hover:bg-[#45475a] transition-colors border border-white/[0.06]"
                  >
                    <div className="text-sm font-medium text-[#cdd6f4] truncate">
                      {p.name}
                    </div>
                    <div className="text-xs text-[#89b4fa] mt-1">
                      {p.currency} {p.price.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-white/40 mt-0.5">
                      {p.retailer}
                    </div>
                  </a>
                ))}
              </div>
            );
          }

          return (
            <ImagineChatBubble
              key={i}
              role={msg.role}
              content={msg.content}
            />
          );
        })}

        {/* Streaming text */}
        {currentStream && (
          <ImagineChatBubble role="agent" content={currentStream} streaming />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Integrated prompt bar */}
      <ImaginePromptBar embedded />
    </div>
  );
}
