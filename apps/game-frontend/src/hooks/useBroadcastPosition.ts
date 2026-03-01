'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { gameSocket } from '@/lib/websocket';
import type { RapierRigidBody } from '@react-three/rapier';

const SEND_INTERVAL_MS = 50; // 20Hz

export function useBroadcastPosition(
  rigidBodyRef: React.RefObject<RapierRigidBody | null>,
  animation: string,
  facingAngleRef?: React.RefObject<number>,
) {
  const lastSendTime = useRef(0);

  useFrame(() => {
    const now = performance.now();
    if (now - lastSendTime.current < SEND_INTERVAL_MS) return;

    const rb = rigidBodyRef.current;
    if (!rb) return;

    const pos = rb.translation();
    const position: [number, number, number] = [pos.x, pos.y, pos.z];

    // Normalize to [-π, π] so server validation accepts it
    let rotation = facingAngleRef?.current ?? 0;
    rotation = ((rotation % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;

    gameSocket.send({
      type: 'player:move',
      payload: { position, rotation, animation },
    });

    lastSendTime.current = now;
  });
}
