'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import { useEmbedStore } from '@/stores/embedStore';

const components: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  a: ({ href, children }) => {
    // Composio connect links must navigate so the user can complete OAuth
    const isConnectLink = href?.includes('connect.composio.dev');
    if (isConnectLink && href) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 cursor-pointer"
        >
          {children}
        </a>
      );
    }
    return (
      <a
        href={href}
        onClick={(e) => {
          e.preventDefault();
          if (!href) return;
          const title = typeof children === 'string' ? children : (Array.isArray(children) ? children.join('') : 'Link');
          useEmbedStore.getState().addEmbed({
            id: `chat-${Date.now()}`,
            url: href,
            title: String(title).slice(0, 60),
            type: 'other',
            agentId: 'chat',
            agentName: 'Chat',
          });
        }}
        className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 cursor-pointer"
      >
        {children}
      </a>
    );
  },
  ul: ({ children }) => <ul className="mb-2 ml-4 list-disc last:mb-0 space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal last:mb-0 space-y-1">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  code: ({ className, children }) => {
    const isBlock = className?.includes('language-');
    if (isBlock) {
      return (
        <code className="block my-2 p-3 rounded-lg bg-black/30 text-xs font-mono overflow-x-auto whitespace-pre">
          {children}
        </code>
      );
    }
    return (
      <code className="px-1 py-0.5 rounded bg-white/10 text-xs font-mono">
        {children}
      </code>
    );
  },
  pre: ({ children }) => <pre className="my-2 last:my-0">{children}</pre>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-white/20 pl-3 my-2 text-white/60 italic">
      {children}
    </blockquote>
  ),
  h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
  h2: ({ children }) => <h2 className="text-base font-bold mb-1.5">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-bold mb-1">{children}</h3>,
  hr: () => <hr className="border-white/10 my-2" />,
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="min-w-full text-xs border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-white/10 px-2 py-1 text-left font-semibold bg-white/5">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border border-white/10 px-2 py-1">{children}</td>
  ),
};

export function Markdown({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  );
}
