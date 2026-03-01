/** Self-contained thought bubble that manages its own timing via useFrame. */
'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text, RoundedBox } from '@react-three/drei';
import { MathUtils } from 'three';
import type { Group, MeshBasicMaterial } from 'three';
import { THOUGHT_BUBBLE, agentThoughts, defaultThoughts } from '@/data/agentThoughts';

type Phase = 'hidden' | 'fadeIn' | 'visible' | 'fadeOut';

interface ThoughtBubbleProps {
  agentId: string;
  isBusy: boolean;
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
  });

  useFrame((_, delta) => {
    if (thoughts.length === 0) return;
    const s = stateRef.current;
    const group = groupRef.current;
    if (!group) return;

    // Suppress during conversation
    if (isBusy) {
      if (s.phase !== 'hidden') {
        s.phase = 'hidden';
        s.opacity = 0;
        s.timer = randomInterval();
      }
      group.visible = false;
      return;
    }

    switch (s.phase) {
      case 'hidden':
        s.timer -= delta;
        group.visible = false;
        if (s.timer <= 0) {
          s.text = thoughts[Math.floor(Math.random() * thoughts.length)];
          s.phase = 'fadeIn';
          s.timer = THOUGHT_BUBBLE.fadeDuration;
          s.opacity = 0;
          // Update the text content
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

    // Apply opacity to materials
    if (bgRef.current) bgRef.current.opacity = s.opacity * 0.92;
    if (tailRef.current) tailRef.current.opacity = s.opacity * 0.92;
    if (textRef.current) textRef.current.fillOpacity = s.opacity;
  });

  if (thoughts.length === 0) return null;

  return (
    <group ref={groupRef} visible={false}>
      <Billboard position={[0, 3.2, 0]}>
        <group>
          {/* Background box */}
          <RoundedBox args={[2.6, 0.5, 0.05]} radius={0.1} smoothness={4}>
            <meshBasicMaterial
              ref={bgRef}
              color="#ffffff"
              transparent
              opacity={0}
            />
          </RoundedBox>

          {/* Thought text */}
          <Text
            ref={textRef}
            position={[0, 0, 0.03]}
            fontSize={0.16}
            color="#333333"
            anchorX="center"
            anchorY="middle"
            maxWidth={2.3}
            fillOpacity={0}
          >
            {''}
          </Text>

          {/* Tail triangle pointing down */}
          <mesh position={[0, -0.32, 0]} rotation={[0, 0, Math.PI]}>
            <coneGeometry args={[0.1, 0.15, 3]} />
            <meshBasicMaterial
              ref={tailRef}
              color="#ffffff"
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
