/**
 * Stanford Campus easter egg: surrounds the office but only becomes
 * visible once the player crosses through the transparent walls.
 *
 * Raw model bounds: X ±56, Y 0→40, Z ±58.
 * Scale 1 (original). Y offset sinks the base slab so the campus
 * walkable surface aligns with the office floor (y ≈ 0).
 */
'use client';

import { useRef } from 'react';
import { useGLTF, Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Group } from 'three';
import { playerPositionRef } from './Player';

/** Distance from center at which the campus becomes visible (just past office walls). */
const SHOW_THRESHOLD = 26;

/**
 * Y offset: the model's green ground surface is ~10 units above y=0
 * (thick base slab). Drop the model so that surface sits at y=0,
 * matching the office floor.
 */
const CAMPUS_Y = -2.8;

function StanfordCampusInner() {
  const { scene } = useGLTF('/models/stanford-campus.glb');
  const groupRef = useRef<Group>(null);

  useFrame(() => {
    if (!groupRef.current) return;

    const [px, , pz] = playerPositionRef.current;
    const dist = Math.sqrt(px * px + pz * pz);

    groupRef.current.visible = dist > SHOW_THRESHOLD;
  });

  return (
    <group ref={groupRef} position={[-3, CAMPUS_Y, -25]} visible={false}>
      <primitive object={scene} />

      <Text
        position={[0, 45, 0]}
        fontSize={5}
        color="#c4a35a"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.12}
        outlineColor="#000000"
        letterSpacing={0.15}
      >
        STANFORD UNIVERSITY
      </Text>
    </group>
  );
}

export function StanfordCampus() {
  return <StanfordCampusInner />;
}

useGLTF.preload('/models/stanford-campus.glb');
