/** Per-agent wander hook: idle/walking state machine near home position. */
'use client';

import { useRef, useCallback, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { MathUtils } from 'three';
import type { Group } from 'three';
import { AGENT_WANDER } from '@/data/gameConfig';
import { useAgentBehaviorStore } from '@/stores/agentBehaviorStore';

type WanderPhase = 'idle' | 'walking';

interface WanderState {
  phase: WanderPhase;
  timer: number;
  /** Local-space offset targets (relative to parent group at home). */
  targetX: number;
  targetZ: number;
  targetRotY: number;
  frameCount: number;
}

export function useAgentWander(
  agentId: string,
  home: [number, number, number],
  isBusy: boolean,
) {
  const groupRef = useRef<Group>(null);
  const state = useRef<WanderState>({
    phase: 'idle',
    timer: randomIdleTime(),
    targetX: 0,
    targetZ: 0,
    targetRotY: 0,
    frameCount: 0,
  });
  const [animation, setAnimation] = useState<'idle' | 'walk'>('idle');
  const animRef = useRef<'idle' | 'walk'>('idle');
  const setPosition = useAgentBehaviorStore((s) => s.setPosition);

  const updateAnimation = useCallback(
    (next: 'idle' | 'walk') => {
      if (animRef.current !== next) {
        animRef.current = next;
        setAnimation(next);
      }
    },
    [],
  );

  /** Pick a local-space wander offset, avoiding the workstation exclusion zone. */
  const pickNewTarget = useCallback(() => {
    const { exclusion, exclusionRetries } = AGENT_WANDER;
    for (let i = 0; i < exclusionRetries; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * AGENT_WANDER.radius;
      const ox = Math.cos(angle) * dist;
      const oz = Math.sin(angle) * dist;

      if (
        Math.abs(ox) < exclusion.xHalf &&
        oz > exclusion.zMin &&
        oz < exclusion.zMax
      ) {
        continue; // inside workstation — reject
      }

      state.current.targetX = ox;
      state.current.targetZ = oz;
      return;
    }
    // All retries landed in the exclusion zone — stay at home (local origin)
    state.current.targetX = 0;
    state.current.targetZ = 0;
  }, []);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;

    const s = state.current;

    // Check if player is nearby — agent should return home to greet them
    const playerPos = useAgentBehaviorStore.getState().playerPosition;
    const pDx = playerPos[0] - home[0];
    const pDz = playerPos[2] - home[2];
    const playerNear =
      Math.sqrt(pDx * pDx + pDz * pDz) < AGENT_WANDER.playerSenseRadius;

    // Return to home when busy (in conversation) OR when player is nearby
    if (isBusy || playerNear) {
      const dx = 0 - group.position.x;
      const dz = 0 - group.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist > AGENT_WANDER.arrivalThreshold) {
        const step = Math.min(AGENT_WANDER.walkSpeed * delta, dist);
        group.position.x += (dx / dist) * step;
        group.position.z += (dz / dist) * step;

        const targetRot = Math.atan2(dx, dz);
        group.rotation.y = MathUtils.lerp(group.rotation.y, targetRot, 0.1);
        updateAnimation('walk');
      } else {
        group.position.x = 0;
        group.position.z = 0;
        updateAnimation('idle');
      }

      s.phase = 'idle';
      s.timer = randomIdleTime();
      syncPosition(s, group, setPosition, agentId, home);
      return;
    }

    if (s.phase === 'idle') {
      s.timer -= delta;
      updateAnimation('idle');

      if (s.timer <= 0) {
        pickNewTarget();
        const dx = s.targetX - group.position.x;
        const dz = s.targetZ - group.position.z;
        s.targetRotY = Math.atan2(dx, dz);
        s.phase = 'walking';
      }
    } else {
      // walking
      const dx = s.targetX - group.position.x;
      const dz = s.targetZ - group.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < AGENT_WANDER.arrivalThreshold) {
        group.position.x = s.targetX;
        group.position.z = s.targetZ;
        s.phase = 'idle';
        s.timer = randomIdleTime();
        updateAnimation('idle');
      } else {
        const step = Math.min(AGENT_WANDER.walkSpeed * delta, dist);
        group.position.x += (dx / dist) * step;
        group.position.z += (dz / dist) * step;
        group.rotation.y = MathUtils.lerp(group.rotation.y, s.targetRotY, 0.1);
        updateAnimation('walk');
      }
    }

    syncPosition(s, group, setPosition, agentId, home);
  });

  return { animation, groupRef };
}

function randomIdleTime(): number {
  return MathUtils.lerp(
    AGENT_WANDER.idleTimeMin,
    AGENT_WANDER.idleTimeMax,
    Math.random(),
  );
}

/** Sync world-space position to the behavior store (local offset + home). */
function syncPosition(
  s: WanderState,
  group: Group,
  setPosition: (id: string, pos: [number, number, number]) => void,
  agentId: string,
  home: [number, number, number],
) {
  s.frameCount++;
  if (s.frameCount % 6 === 0) {
    setPosition(agentId, [
      home[0] + group.position.x,
      home[1],
      home[2] + group.position.z,
    ]);
  }
}
