/** Holographic indicator above agent when actively browsing the web. Pure 3D — no iframes. */
'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, Sparkles } from '@react-three/drei';
import type { Group } from 'three';
import { useBrowserUseStore } from '@/stores/browserUseStore';

interface BrowsingIndicatorProps {
  agentId: string;
}

export function BrowsingIndicator({ agentId }: BrowsingIndicatorProps) {
  const groupRef = useRef<Group>(null);
  const session = useBrowserUseStore((s) => s.activeSessions.get(agentId));

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 1.5) * 0.06;
  });

  if (!session) return null;

  return (
    <group ref={groupRef} position={[0, 3.6, 0]}>
      <Sparkles count={15} scale={1.8} size={3} speed={1} color="#06b6d4" />

      <Html center distanceFactor={8} style={{ pointerEvents: 'none' }}>
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full whitespace-nowrap"
          style={{
            background: 'rgba(6, 182, 212, 0.12)',
            border: '1px solid rgba(6, 182, 212, 0.3)',
            boxShadow: '0 0 20px rgba(6, 182, 212, 0.15)',
          }}
        >
          <div className="relative flex items-center justify-center w-4 h-4 shrink-0">
            <div className="absolute w-4 h-4 rounded-full bg-cyan-500/30 animate-ping" />
            <div className="w-2 h-2 rounded-full bg-cyan-400" />
          </div>
          <span className="text-[11px] text-cyan-300 font-medium">Browsing</span>
        </div>
      </Html>
    </group>
  );
}
