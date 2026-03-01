/** Floating HTML speech bubble that shows streamed agent responses above the agent's head. */
'use client';

import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type { Group } from 'three';
import { useChatStore } from '@/stores/chatStore';

type Phase = 'hidden' | 'visible' | 'fadeOut';

interface SpeechBubbleProps {
  agentId: string;
}

/** Strip basic markdown formatting for clean bubble display. */
function stripMarkdown(text: string): string {
  return text
    .replace(/[*_~`]+/g, '')     // bold, italic, strikethrough, code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links → text
    .replace(/^#+\s*/gm, '')     // headings
    .replace(/^[-*]\s+/gm, '')   // list bullets
    .replace(/\n+/g, ' ')        // collapse newlines
    .trim();
}

/** Calculate display duration based on word count (~150 WPM, min 3s, max 15s). */
function readingTime(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.min(15, Math.max(3, words / 2.5)); // ~150 WPM = 2.5 words/sec
}

export function SpeechBubble({ agentId }: SpeechBubbleProps) {
  const groupRef = useRef<Group>(null);
  const [text, setText] = useState('');
  const [opacity, setOpacity] = useState(0);

  const stateRef = useRef({
    phase: 'hidden' as Phase,
    timer: 0,
    opacity: 0,
    lastAgentMsgCount: 0,
  });

  useFrame((_, delta) => {
    const s = stateRef.current;
    const group = groupRef.current;
    if (!group) return;

    const { streamingText, chatMessages } = useChatStore.getState();
    const stream = streamingText[agentId] ?? '';
    const msgs = chatMessages[agentId] ?? [];
    const agentMsgCount = msgs.filter((m) => m.role === 'agent').length;

    switch (s.phase) {
      case 'hidden':
        if (stream) {
          s.phase = 'visible';
          s.opacity = 1;
          setText(stripMarkdown(stream));
          setOpacity(1);
        }
        break;

      case 'visible':
        s.opacity = 1;
        if (stream) {
          setText(stripMarkdown(stream));
        } else if (agentMsgCount > s.lastAgentMsgCount) {
          s.lastAgentMsgCount = agentMsgCount;
          const lastMsg = msgs.filter((m) => m.role === 'agent').pop();
          if (lastMsg && lastMsg.role === 'agent') {
            const clean = stripMarkdown(lastMsg.content);
            setText(clean);
            s.timer = readingTime(clean);
          } else {
            s.timer = 3;
          }
          s.phase = 'fadeOut';
        }
        break;

      case 'fadeOut':
        if (stream) {
          s.phase = 'visible';
          s.opacity = 1;
          setText(stripMarkdown(stream));
          setOpacity(1);
          break;
        }
        s.timer -= delta;
        if (s.timer <= 0) {
          s.opacity = Math.max(0, s.opacity - delta * 2);
          setOpacity(s.opacity);
          if (s.opacity <= 0) {
            s.phase = 'hidden';
            setText('');
          }
        }
        break;
    }

    if (s.phase === 'hidden') {
      s.lastAgentMsgCount = agentMsgCount;
    }

    // Sync opacity for visible phase
    if (s.phase === 'visible' && s.opacity !== 1) {
      setOpacity(1);
    }
  });

  if (!text) return null;

  return (
    <group ref={groupRef} position={[0, 3.2, 0]}>
      <Html center distanceFactor={8} style={{ pointerEvents: 'none' }}>
        <div
          className="relative max-w-[320px] px-3 py-2 rounded-xl bg-white/95 shadow-lg text-gray-900 text-[13px] leading-snug"
          style={{ opacity, transition: 'opacity 0.15s' }}
        >
          {text}
          {/* Tail */}
          <div
            className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-0 h-0"
            style={{
              borderLeft: '8px solid transparent',
              borderRight: '8px solid transparent',
              borderTop: '8px solid rgba(255,255,255,0.95)',
            }}
          />
        </div>
      </Html>
    </group>
  );
}
