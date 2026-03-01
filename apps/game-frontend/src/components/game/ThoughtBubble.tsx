/** Thought bubble: shows idle thoughts when idle, live tool activity when busy. */
'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text, RoundedBox } from '@react-three/drei';
import { MathUtils } from 'three';
import type { Group, MeshBasicMaterial } from 'three';
import { THOUGHT_BUBBLE, agentThoughts, defaultThoughts } from '@/data/agentThoughts';
import { useActivityStore } from '@/stores/activityStore';

type Phase = 'hidden' | 'fadeIn' | 'visible' | 'fadeOut';

interface ThoughtBubbleProps {
  agentId: string;
  isBusy: boolean;
}

function formatToolName(raw: string): string {
  const parts = raw.split('_');
  if (parts.length > 1) {
    return parts
      .slice(1)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }
  return raw.replace(/([A-Z])/g, ' $1').trim();
}

export function ThoughtBubble({ agentId, isBusy }: ThoughtBubbleProps) {
  const thoughts = agentThoughts[agentId] ?? defaultThoughts;
  const groupRef = useRef<Group>(null);
  const textRef = useRef<{ fillOpacity: number } | null>(null);
  const bgRef = useRef<MeshBasicMaterial>(null);
  const tailRef = useRef<MeshBasicMaterial>(null);
  const stateRef = useRef({
    phase: 'hidden' as Phase,
    timer: randomInterval(),
    text: '',
    opacity: 0,
    lastBusyText: '',
    wasBusy: false,
  });

  useFrame((_, delta) => {
    const s = stateRef.current;
    const group = groupRef.current;
    if (!group) return;

    if (isBusy) {
      const events = useActivityStore.getState().events;
      const latestTool = events
        .filter((e) => e.agentId === agentId && e.type === 'tool' && e.toolStatus === 'started')
        .at(-1);

      const busyText = latestTool
        ? `${formatToolName(latestTool.toolName!)}...`
        : 'Working...';

      if (busyText !== s.lastBusyText || !s.wasBusy) {
        s.lastBusyText = busyText;
        s.text = busyText;
        s.phase = 'visible';
        s.opacity = 1;
        s.timer = 999;
        s.wasBusy = true;
        if (textRef.current) {
          (textRef.current as unknown as { text: string }).text = s.text;
        }
      }

      group.visible = true;
      if (bgRef.current) bgRef.current.opacity = 0.92;
      if (tailRef.current) tailRef.current.opacity = 0.92;
      if (textRef.current) textRef.current.fillOpacity = 1;
      return;
    }

    // Transitioning from busy to idle: fade out
    if (s.wasBusy) {
      s.wasBusy = false;
      s.phase = 'fadeOut';
      s.timer = THOUGHT_BUBBLE.fadeDuration;
    }

    if (thoughts.length === 0 && s.phase === 'hidden') {
      group.visible = false;
      return;
    }

    switch (s.phase) {
      case 'hidden':
        s.timer -= delta;
        group.visible = false;
        if (s.timer <= 0 && thoughts.length > 0) {
          s.text = thoughts[Math.floor(Math.random() * thoughts.length)];
          s.phase = 'fadeIn';
          s.timer = THOUGHT_BUBBLE.fadeDuration;
          s.opacity = 0;
          if (textRef.current) {
            (textRef.current as unknown as { text: string }).text = s.text;
          }
        }
        break;

      case 'fadeIn':
        s.timer -= delta;
        s.opacity = MathUtils.clamp(
          1 - s.timer / THOUGHT_BUBBLE.fadeDuration,
          0,
          1,
        );
        group.visible = true;
        if (s.timer <= 0) {
          s.phase = 'visible';
          s.timer = THOUGHT_BUBBLE.displayDuration;
          s.opacity = 1;
        }
        break;

      case 'visible':
        s.timer -= delta;
        if (s.timer <= 0) {
          s.phase = 'fadeOut';
          s.timer = THOUGHT_BUBBLE.fadeDuration;
        }
        break;

      case 'fadeOut':
        s.timer -= delta;
        s.opacity = MathUtils.clamp(
          s.timer / THOUGHT_BUBBLE.fadeDuration,
          0,
          1,
        );
        if (s.timer <= 0) {
          s.phase = 'hidden';
          s.timer = randomInterval();
          s.opacity = 0;
          group.visible = false;
        }
        break;
    }

    if (bgRef.current) bgRef.current.opacity = s.opacity * 0.92;
    if (tailRef.current) tailRef.current.opacity = s.opacity * 0.92;
    if (textRef.current) textRef.current.fillOpacity = s.opacity;
  });

  return (
    <group ref={groupRef} visible={false}>
      <Billboard position={[0, 3.2, 0]}>
        <group>
          <RoundedBox args={[2.6, 0.5, 0.05]} radius={0.1} smoothness={4}>
            <meshBasicMaterial
              ref={bgRef}
              color={isBusy ? '#1e1e2e' : '#ffffff'}
              transparent
              opacity={0}
            />
          </RoundedBox>

          <Text
            ref={textRef}
            position={[0, 0, 0.03]}
            fontSize={0.16}
            color={isBusy ? '#89b4fa' : '#333333'}
            anchorX="center"
            anchorY="middle"
            maxWidth={2.3}
            fillOpacity={0}
          >
            {''}
          </Text>

          <mesh position={[0, -0.32, 0]} rotation={[0, 0, Math.PI]}>
            <coneGeometry args={[0.1, 0.15, 3]} />
            <meshBasicMaterial
              ref={tailRef}
              color={isBusy ? '#1e1e2e' : '#ffffff'}
              transparent
              opacity={0}
            />
          </mesh>
        </group>
      </Billboard>
    </group>
  );
}

function randomInterval(): number {
  return MathUtils.lerp(
    THOUGHT_BUBBLE.intervalMin,
    THOUGHT_BUBBLE.intervalMax,
    Math.random(),
  );
}
