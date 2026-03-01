'use client';

import { useState, useRef, useEffect, Fragment, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import { useScratchpadStore } from '@/stores/scratchpadStore';
import { useEmbedStore } from '@/stores/embedStore';
import { gameSocket } from '@/lib/websocket';

/** Parse text and highlight @mentions — only the @ is purple */
function renderWithMentions(text: string): ReactNode[] | string {
  const mentionRegex = /@([\w][\w\s]*?[\w]|[\w]+)/g;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = mentionRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <span key={match.index}>
        <span className="text-indigo-400 font-semibold">@</span>
        {match[1]}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

/** Recursively process children to highlight @mentions in text nodes */
function withMentions(children: ReactNode): ReactNode {
  if (typeof children === 'string') return <>{renderWithMentions(children)}</>;
  if (Array.isArray(children)) {
    return children.map((child, i) =>
      typeof child === 'string'
        ? <Fragment key={i}>{renderWithMentions(child)}</Fragment>
        : child
    );
  }
  return children;
}

/** Compact markdown components sized for the feed */
const feedComponents: Components = {
  p: ({ children }) => <p className="mb-1 last:mb-0 leading-snug">{withMentions(children)}</p>,
  a: ({ href, children }) => (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        if (!href) return;
        const title = typeof children === 'string' ? children : (Array.isArray(children) ? children.join('') : 'Link');
        useEmbedStore.getState().addEmbed({
          id: `feed-${Date.now()}`,
          url: href,
          title: String(title).slice(0, 60),
          type: 'other',
          agentId: 'feed',
          agentName: 'Feed',
        });
      }}
      className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 cursor-pointer"
    >
      {children}
    </a>
  ),
  ul: ({ children }) => <ul className="mb-1 ml-3 list-disc last:mb-0 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="mb-1 ml-3 list-decimal last:mb-0 space-y-0.5">{children}</ol>,
  li: ({ children }) => <li className="leading-snug">{withMentions(children)}</li>,
  strong: ({ children }) => <strong className="font-semibold text-white/80">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  code: ({ className, children }) => {
    if (className?.includes('language-')) {
      return (
        <code className="block my-1 p-1.5 rounded bg-black/30 text-[10px] font-mono overflow-x-auto whitespace-pre">
          {children}
        </code>
      );
    }
    return <code className="px-0.5 py-px rounded bg-white/10 text-[10px] font-mono">{children}</code>;
  },
  pre: ({ children }) => <pre className="my-1 last:my-0">{children}</pre>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-white/20 pl-2 my-1 text-white/50 italic">{children}</blockquote>
  ),
  h1: ({ children }) => <p className="font-bold mb-0.5">{children}</p>,
  h2: ({ children }) => <p className="font-bold mb-0.5">{children}</p>,
  h3: ({ children }) => <p className="font-bold mb-0.5">{children}</p>,
  hr: () => <hr className="border-white/10 my-1" />,
  table: ({ children }) => (
    <div className="my-1 overflow-x-auto">
      <table className="min-w-full text-[10px] border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border border-white/10 px-1.5 py-0.5 text-left font-semibold bg-white/5">{children}</th>,
  td: ({ children }) => <td className="border border-white/10 px-1.5 py-0.5">{children}</td>,
};

export function ScratchpadFeed() {
  const entries = useScratchpadStore((s) => s.entries);
  const activeWorkspaceId = useScratchpadStore((s) => s.activeWorkspaceId);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries.length]);

  if (!activeWorkspaceId) return null;

  const handleSubmit = () => {
    if (!input.trim()) return;
    gameSocket.send({
      type: 'workspace:userNote',
      payload: { workspaceId: activeWorkspaceId, content: input.trim() },
    });
    setInput('');
  };

  return (
    <div className="fixed left-4 bottom-24 w-80 z-40 pointer-events-none">
      <div className="pointer-events-auto flex flex-col bg-black/40 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden max-h-[660px]">
        {/* Header */}
        <div className="px-3 py-2 border-b border-white/10 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs font-medium text-white/70">Team Feed</span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5 max-h-[580px] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/30">
          {entries.length === 0 && (
            <div className="flex items-center justify-center py-8 text-white/30 text-[11px]">
              Your team's communications will show up here
            </div>
          )}
          {entries.map((entry) => (
            <div key={entry.id} className="animate-[fadeIn_0.3s_ease-out]">
              <div className="flex items-start gap-1.5">
                <div
                  className="w-2 h-2 rounded-full shrink-0 mt-1"
                  style={{ backgroundColor: entry.authorColor }}
                />
                <div className="min-w-0">
                  <span className="text-[11px] font-semibold text-white">
                    {entry.authorType === 'user' ? 'You' : entry.authorName}
                  </span>
                  <div className="text-[11px] text-white/60 mt-0.5 overflow-hidden [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={feedComponents}>
                      {entry.content}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-2 py-2 border-t border-white/10">
          <div className="flex gap-1.5">
            <input
              id="team-feed-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit();
                if (e.key === 'Escape') (e.target as HTMLInputElement).blur();
              }}
              placeholder="Broadcast to team…  (/)"
              className="flex-1 px-2 py-1 rounded-md bg-white/5 border border-white/10 text-white text-[11px] placeholder:text-white/30 focus:outline-none focus:border-white/30"
            />
            <button
              onClick={handleSubmit}
              disabled={!input.trim()}
              className="px-2 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-white text-[10px] font-medium"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
