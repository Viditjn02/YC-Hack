/** NPC agent: Kenney character model + floating name label + status orb + sparkles + click-to-chat + wander + thought bubbles. */
'use client';

import { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { Billboard, Text, Sparkles } from '@react-three/drei';
import { CharacterModel } from './CharacterModel';
import { ThoughtBubble } from './ThoughtBubble';
import { SpeechBubble } from './SpeechBubble';
import { BrowsingIndicator } from './BrowsingIndicator';
import { useChatStore } from '@/stores/chatStore';
import { useWorldStore } from '@/stores/worldStore';
import { useFrame } from '@react-three/fiber';
import { useAgentWander } from '@/hooks/useAgentWander';
import { statusColors, statusLabels, type AgentData } from '@/data/agents';
import { PUNCH } from '@/data/gameConfig';

interface AgentProps {
  agent: AgentData;
}

export function Agent({ agent }: AgentProps) {
  const openChat = useChatStore((s) => s.openChat);
  const hasLink = useChatStore((s) => s.agentsWithLinks.has(agent.id));
  const isActive = agent.status !== 'idle';
  const isBusy = agent.status !== 'idle';
  const punchedAgentId = useWorldStore((s) => s.punchedAgentId);
  const punchReaction = useWorldStore((s) => s.punchReaction);

  const { animation: wanderAnimation, groupRef } = useAgentWander(agent.id, agent.position, isBusy);

  const [reactionAnim, setReactionAnim] = useState<string | null>(null);
  const punchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (punchedAgentId === agent.id && punchReaction) {
      setReactionAnim(punchReaction);
      if (punchTimer.current) clearTimeout(punchTimer.current);
      punchTimer.current = setTimeout(() => setReactionAnim(null), PUNCH.reactionDuration);
    }
  }, [punchedAgentId, punchReaction, agent.id]);

  const isPunched = reactionAnim !== null;
  const animation = reactionAnim ?? wanderAnimation;

  return (
    <group position={agent.position}>
      <group
        ref={groupRef}
        onClick={(e) => {
          e.stopPropagation();
          openChat(agent.id);
        }}
        onPointerOver={() => {
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'default';
        }}
      >
        <CharacterModel url={agent.modelUrl} animation={animation} />

        {/* Floating name label */}
        <Billboard position={[0, 2.2, 0]}>
          <Text
            fontSize={0.25}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.02}
            outlineColor="#000000"
          >
            {agent.name}
          </Text>
        </Billboard>

        {/* Status label when active */}
        {isActive && (
          <Billboard position={[0, 2.8, 0]}>
            <Text
              fontSize={0.15}
              color={statusColors[agent.status]}
              anchorX="center"
              anchorY="middle"
            >
              {statusLabels[agent.status]}
            </Text>
          </Billboard>
        )}

        {/* Status orb */}
        <mesh position={[0, 2.55, 0]}>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshStandardMaterial
            color={statusColors[agent.status]}
            emissive={statusColors[agent.status]}
            emissiveIntensity={isActive ? 2.5 : 1.5}
          />
        </mesh>

        {/* Sparkle effects for thinking/working */}
        {(agent.status === 'thinking' || agent.status === 'working') && (
          <Sparkles
            count={agent.status === 'working' ? 30 : 12}
            scale={2}
            size={agent.status === 'working' ? 4 : 2}
            speed={agent.status === 'working' ? 2 : 0.5}
            color={agent.color}
            position={[0, 1, 0]}
          />
        )}

        {/* Error effect */}
        {agent.status === 'error' && (
          <Sparkles
            count={20}
            scale={1.5}
            size={3}
            speed={3}
            color="#ff4444"
            position={[0, 1, 0]}
          />
        )}

        {/* Punch reaction effect */}
        {isPunched && (
          <Sparkles
            count={25}
            scale={2}
            size={5}
            speed={4}
            color="#ff2222"
            position={[0, 1, 0]}
          />
        )}

        {/* Thought bubble */}
        <ThoughtBubble agentId={agent.id} isBusy={isBusy} />

        {/* Speech bubble (streamed agent response) */}
        <SpeechBubble agentId={agent.id} />

        {/* Hologram indicator when agent is browsing the web */}
        <BrowsingIndicator agentId={agent.id} />

        {/* Link alert — pulsing blue rings + yellow sparkles */}
        {hasLink && <LinkAlert />}
      </group>
    </group>
  );
}

/** Pulsing blue rings + yellow particles around an agent that has an unseen link. */
function LinkAlert() {
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const mat1Ref = useRef<THREE.MeshBasicMaterial>(null);
  const mat2Ref = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;

    // Ring 1: expands 1→2.5 then resets, fades out
    const phase1 = (t * 0.8) % 1;
    const scale1 = 1 + phase1 * 1.5;
    if (ring1Ref.current) {
      ring1Ref.current.scale.set(scale1, scale1, 1);
    }
    if (mat1Ref.current) {
      mat1Ref.current.opacity = (1 - phase1) * 0.6;
    }

    // Ring 2: same but offset by half a cycle
    const phase2 = (t * 0.8 + 0.5) % 1;
    const scale2 = 1 + phase2 * 1.5;
    if (ring2Ref.current) {
      ring2Ref.current.scale.set(scale2, scale2, 1);
    }
    if (mat2Ref.current) {
      mat2Ref.current.opacity = (1 - phase2) * 0.6;
    }
  });

  return (
    <group position={[0, 0.05, 0]}>
      {/* Pulsing ring 1 */}
      <mesh ref={ring1Ref} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.8, 0.9, 32]} />
        <meshBasicMaterial ref={mat1Ref} color="#3B82F6" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>

      {/* Pulsing ring 2 (offset phase) */}
      <mesh ref={ring2Ref} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.8, 0.9, 32]} />
        <meshBasicMaterial ref={mat2Ref} color="#60A5FA" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>

      {/* Yellow sparkles floating around */}
      <Sparkles
        count={20}
        scale={2.5}
        size={3}
        speed={1.5}
        color="#FBBF24"
        position={[0, 1, 0]}
      />
    </group>
  );
}
