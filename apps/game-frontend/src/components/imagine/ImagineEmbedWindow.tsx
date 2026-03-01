'use client';

import { useState, useRef, useCallback } from 'react';
import { useEmbedStore } from '@/stores/embedStore';

export function ImagineEmbedWindow() {
  const embeds = useEmbedStore((s) => s.embeds);
  const activeEmbedId = useEmbedStore((s) => s.activeEmbedId);
  const setActiveEmbed = useEmbedStore((s) => s.setActiveEmbed);
  const removeEmbed = useEmbedStore((s) => s.removeEmbed);

  const activeEmbed = embeds.find((e) => e.id === activeEmbedId);

  const [position, setPosition] = useState({ x: 80, y: 80 });
  const [size] = useState({ w: 640, h: 480 });
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startPosX: position.x,
        startPosY: position.y,
      };

      const handleMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        setPosition({
          x: dragRef.current.startPosX + (ev.clientX - dragRef.current.startX),
          y: dragRef.current.startPosY + (ev.clientY - dragRef.current.startY),
        });
      };

      const handleUp = () => {
        dragRef.current = null;
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
      };

      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    },
    [position],
  );

  if (!activeEmbed || embeds.length === 0) return null;

  return (
    <div
      className="fixed z-25"
      style={{
        left: position.x,
        top: position.y,
        width: size.w,
        height: size.h,
        animation: 'imagineFadeScale 350ms ease-out',
      }}
    >
      {/* Shadow layers */}
      <div className="absolute -inset-2 rounded-[18px] bg-black/10 blur-md" />
      <div className="absolute -inset-3 rounded-[20px] bg-black/[0.06] blur-xl" />

      <div className="relative w-full h-full bg-imagine-window-warm rounded-2xl border border-black/[0.06] overflow-hidden flex flex-col">
        {/* Title bar */}
        <div
          className="flex items-center justify-between h-10 px-4 border-b border-black/[0.06] cursor-move shrink-0"
          onMouseDown={handleDragStart}
        >
          <div className="flex items-center gap-2 overflow-hidden">
            {/* Tab pills */}
            {embeds.map((embed) => (
              <button
                key={embed.id}
                onClick={() => setActiveEmbed(embed.id)}
                className={`text-[11px] px-2 py-0.5 rounded-md truncate max-w-[120px] cursor-pointer ${
                  embed.id === activeEmbedId
                    ? 'bg-imagine-terracotta/10 text-imagine-terracotta font-medium'
                    : 'text-imagine-canvas-text-sec hover:bg-black/[0.04]'
                }`}
              >
                {embed.title}
              </button>
            ))}
          </div>
          <button
            onClick={() => removeEmbed(activeEmbed.id)}
            className="text-imagine-canvas-text-dim hover:text-imagine-canvas-text text-sm cursor-pointer"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0">
          <iframe
            src={activeEmbed.url}
            className="w-full h-full border-0"
            title={activeEmbed.title}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        </div>
      </div>
    </div>
  );
}
