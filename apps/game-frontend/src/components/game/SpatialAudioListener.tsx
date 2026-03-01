'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { peekAudioContext, getActivePanner, getActiveAgentId } from '@/lib/spatialAudio';
import { useAgentBehaviorStore } from '@/stores/agentBehaviorStore';
import { useWorldStore } from '@/stores/worldStore';
import { playerPositionRef } from './Player';

const _forward = new Vector3();

export function SpatialAudioListener() {
  const { camera } = useThree();

  useFrame(() => {
    const ctx = peekAudioContext();
    if (!ctx || ctx.state !== 'running') return;

    const listener = ctx.listener;
    const [px, py, pz] = playerPositionRef.current;
    listener.setPosition(px, py, pz);

    camera.getWorldDirection(_forward);
    listener.setOrientation(_forward.x, _forward.y, _forward.z, 0, 1, 0);

    const panner = getActivePanner();
    const agentId = getActiveAgentId();
    if (panner && agentId) {
      const runtime = useAgentBehaviorStore.getState().runtimes[agentId];
      const agent = useWorldStore.getState().agents.find((a) => a.id === agentId);
      const pos = runtime?.currentPosition ?? agent?.position ?? [0, 0, 0];
      panner.setPosition(pos[0], pos[1], pos[2]);
    }
  });

  return null;
}
