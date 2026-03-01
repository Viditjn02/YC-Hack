'use client';

import { useRef } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { useEmbedStore } from '@/stores/embedStore';

/** 3D floating screen near the receptionist that shows embedded docs. */
export function EmbedScreen() {
  const embeds = useEmbedStore((s) => s.embeds);
  const activeEmbedId = useEmbedStore((s) => s.activeEmbedId);
  const panelOpen = useEmbedStore((s) => s.panelOpen);
  const openPanel = useEmbedStore((s) => s.openPanel);
  const setActiveEmbed = useEmbedStore((s) => s.setActiveEmbed);
  const groupRef = useRef<Group>(null);

  // Gentle hover animation
  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.position.y = 0.8 + Math.sin(Date.now() * 0.001) * 0.03;
    }
  });

  const activeEmbed = embeds.find((e) => e.id === activeEmbedId);

  // Don't render if no embeds or sidebar is already open
  if (embeds.length === 0 || panelOpen) return null;

  return (
    <group ref={groupRef} position={[0, 0.8, -2]}>
      <Html
        transform
        distanceFactor={6}
        className="pointer-events-auto"
        style={{ pointerEvents: 'auto' }}
      >
        <div
          className="bg-gray-950/95 rounded-xl border border-white/15 overflow-hidden shadow-2xl backdrop-blur-sm origin-center"
          style={{ width: '1280px', height: '800px', transform: 'scale(0.8)' }}
        >
          {/* Header bar */}
          <div className="flex items-center justify-between px-5 py-2.5 bg-black/60 border-b border-white/10">
            {/* Expand to sidebar (left) */}
            <button
              onClick={openPanel}
              className="p-2 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors shrink-0"
              title="Expand to sidebar"
            >
              <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="2" width="12" height="12" rx="2" />
                <path d="M9 2v12M13 6l-2-2-2 2M13 10l-2 2-2-2" />
              </svg>
            </button>
            {/* Tabs */}
            <div className="flex items-center gap-2 flex-1 overflow-x-auto scrollbar-none mx-3">
              {embeds.map((embed) => (
                <button
                  key={embed.id}
                  onClick={() => setActiveEmbed(embed.id)}
                  className={`px-3 py-1 rounded text-sm whitespace-nowrap transition-colors ${
                    activeEmbedId === embed.id
                      ? 'bg-white/15 text-white'
                      : 'text-white/40 hover:text-white/60'
                  }`}
                >
                  {embed.title}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {/* Open in new tab */}
              {activeEmbed && (
                <a
                  href={activeEmbed.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                  title="Open in new tab"
                >
                  <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M7 3H4a1 1 0 00-1 1v8a1 1 0 001 1h8a1 1 0 001-1V9" />
                    <path d="M10 3h3v3M13 3L7 9" />
                  </svg>
                </a>
              )}
              {/* Close */}
              <button
                onClick={() => useEmbedStore.getState().clearAll()}
                className="p-2 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                title="Close"
              >
                <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>
          </div>

          {/* Iframe */}
          <div className="w-full bg-white" style={{ height: 'calc(100% - 44px)' }}>
            {activeEmbed ? (
              <iframe
                key={activeEmbed.id}
                src={activeEmbed.url}
                title={activeEmbed.title}
                sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
                className="w-full h-full border-0"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-xs">
                No document loaded
              </div>
            )}
          </div>
        </div>
      </Html>
    </group>
  );
}
