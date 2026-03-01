/**
 * YC Building easter egg: surrounds the office but only becomes
 * visible once the player crosses through the transparent walls.
 *
 * Model downloaded from Meshy at 10 m height, scaled up 4× in scene.
 * Origin = Bottom so base sits at y=0.
 */
'use client';

import { useRef } from 'react';
import { useGLTF, Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Group } from 'three';
import { playerPositionRef } from './Player';

/** Distance from center at which the building becomes visible (just past office walls). */
const SHOW_THRESHOLD = 26;

/** Y offset to align building base with the office floor (y ≈ 0). */
const BUILDING_Y = -3;

/** Scale factor: Meshy model is 10 m tall, we want ~40 m to match old campus footprint. */
const MODEL_SCALE = 1.4;

function YCBuildingInner() {
  const { scene } = useGLTF('/models/yc-building.glb');
  const groupRef = useRef<Group>(null);

  useFrame(() => {
    if (!groupRef.current) return;

    const [px, , pz] = playerPositionRef.current;
    const dist = Math.sqrt(px * px + pz * pz);

    groupRef.current.visible = dist > SHOW_THRESHOLD;
  });

  return (
    <group ref={groupRef} position={[-3, BUILDING_Y, -25]} visible={false}>
      <primitive object={scene} scale={[MODEL_SCALE, MODEL_SCALE, MODEL_SCALE]} />

      <Text
        position={[0, 45, 0]}
        fontSize={5}
        color="#ff6600"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.12}
        outlineColor="#000000"
        letterSpacing={0.15}
      >
        Y COMBINATOR
      </Text>
    </group>
  );
}

export function StanfordCampus() {
  return <YCBuildingInner />;
}

useGLTF.preload('/models/yc-building.glb');
