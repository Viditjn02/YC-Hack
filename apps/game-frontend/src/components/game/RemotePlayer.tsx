'use client';

import { Suspense, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import { Vector3 } from 'three';
import type { Group } from 'three';
import { CharacterModel } from './CharacterModel';
import { getAvatarModelUrl } from '@/data/avatars';
import type { RemotePlayer as RemotePlayerData } from '@/stores/worldStore';
import { useWorldStore } from '@/stores/worldStore';
import { playerSpatialAudio } from '@/lib/playerSpatialAudio';

interface RemotePlayerProps {
  player: RemotePlayerData;
}

export function RemotePlayer({ player }: RemotePlayerProps) {
  const groupRef = useRef<Group>(null);
  const targetPos = useRef(new Vector3(...player.position));
  const targetRot = useRef(player.rotation);
  const talkingPlayers = useWorldStore((s) => s.talkingPlayers);
  const isTalking = talkingPlayers[player.id] === true;

  // Update targets — use individual values to avoid array reference issues
  useEffect(() => {
    targetPos.current.set(player.position[0], player.position[1], player.position[2]);
    targetRot.current = player.rotation;
  }, [player.position[0], player.position[1], player.position[2], player.rotation]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    // Frame-rate independent smoothing (smoothing constant ≈ 0.0001)
    const t = 1 - Math.pow(0.0001, delta);
    // Lerp position
    groupRef.current.position.lerp(targetPos.current, t);
    // Interpolate rotation with angle wrapping
    const currentY = groupRef.current.rotation.y;
    let diff = targetRot.current - currentY;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    groupRef.current.rotation.y += diff * t;

    // Update spatial audio for this player's voice
    playerSpatialAudio.updatePeerPosition(
      player.id,
      groupRef.current.position.x,
      groupRef.current.position.y,
      groupRef.current.position.z,
    );
  });

  return (
    <group ref={groupRef} position={player.position}>
      <group position={[0, -0.8, 0]}>
        <Suspense fallback={null}>
          <CharacterModel url={getAvatarModelUrl(player.avatarId)} animation={player.animation} />
        </Suspense>
      </group>
      {isTalking && (
        <Billboard position={[0, 2.6, 0]}>
          <Text
            fontSize={0.3}
            color="#22d3ee"
            anchorX="center"
            anchorY="middle"
          >
            🔊
          </Text>
        </Billboard>
      )}
      <Billboard position={[0, 2.2, 0]}>
        <Text
          fontSize={0.25}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#000000"
        >
          {player.username}
        </Text>
      </Billboard>
    </group>
  );
}
