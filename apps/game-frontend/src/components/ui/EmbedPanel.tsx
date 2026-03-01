'use client';

import { useEmbedStore } from '@/stores/embedStore';

export function EmbedPanel() {
  const embeds = useEmbedStore((s) => s.embeds);
  const activeEmbedId = useEmbedStore((s) => s.activeEmbedId);
  const panelOpen = useEmbedStore((s) => s.panelOpen);
  const setActiveEmbed = useEmbedStore((s) => s.setActiveEmbed);
  const removeEmbed = useEmbedStore((s) => s.removeEmbed);
  const closePanel = useEmbedStore((s) => s.closePanel);

  const activeEmbed = embeds.find((e) => e.id === activeEmbedId);

  if (embeds.length === 0) return null;

  return (
    <div
      className={`fixed top-0 left-0 h-full w-[min(60vw,800px)] z-50
        bg-gray-950/95 backdrop-blur-md border-r border-white/10
        flex flex-col transition-transform duration-300 ease-out
        ${panelOpen ? 'translate-x-0' : '-translate-x-full'}`}
    >
      {/* Header with tabs */}
      <div className="flex items-center justify-between border-b border-white/10">
        <div className="flex-1 flex items-center gap-1 px-3 py-2 overflow-x-auto scrollbar-none">
          {embeds.map((embed) => (
            <button
              key={embed.id}
              onClick={() => setActiveEmbed(embed.id)}
              className={`group flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs whitespace-nowrap transition-colors shrink-0
                ${activeEmbedId === embed.id
                  ? 'bg-white/15 text-white'
                  : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70'
                }`}
            >
              <TypeIcon type={embed.type} />
              <span className="max-w-[120px] truncate">{embed.title}</span>
              <span className="text-white/30 text-[10px]">{embed.agentName}</span>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  removeEmbed(embed.id);
                }}
                className="ml-0.5 text-white/30 hover:text-white/60 leading-none rounded-sm px-0.5
                  opacity-0 group-hover:opacity-100 transition-opacity"
              >
                &times;
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 shrink-0 pr-2">
          {/* Minimize — back to 3D screen */}
          <button
            onClick={closePanel}
            className="text-white/50 hover:text-white p-1.5 rounded hover:bg-white/10 transition-colors"
            title="Minimize to 3D screen"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 12h8M2 8l6 4 6-4" />
            </svg>
          </button>
          {/* Close — remove all */}
          <button
            onClick={() => useEmbedStore.getState().clearAll()}
            className="text-white/50 hover:text-white text-lg leading-none p-1.5 rounded hover:bg-white/10 transition-colors"
            title="Close all"
          >
            &times;
          </button>
        </div>
      </div>

      {/* Iframe body */}
      <div className="flex-1 bg-white">
        {activeEmbed ? (
          <iframe
            key={activeEmbed.id}
            src={activeEmbed.url}
            title={activeEmbed.title}
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
            className="w-full h-full border-0"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            No embed selected
          </div>
        )}
      </div>
    </div>
  );
}

function TypeIcon({ type }: { type: string }) {
  const icons: Record<string, string> = {
    document: '\u{1F4C4}',
    board: '\u{1F3A8}',
    spreadsheet: '\u{1F4CA}',
    presentation: '\u{1F4CA}',
    other: '\u{1F517}',
  };
  return <span className="text-xs">{icons[type] ?? icons.other}</span>;
}
