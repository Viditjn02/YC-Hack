/** Procedural office environment: floor, grid, reception area, dynamic workspace zones. */
'use client';

import { useRef } from 'react';
import { Grid, useGLTF, Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { MathUtils, Group } from 'three';
import { agents, zoneColors, zoneDisplayNames } from '@/data/agents';
import { WORLD, FURNITURE_SCALE, SHOP } from '@/data/gameConfig';
import { Workstation } from './Workstation';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import type { DynamicAgent } from '@bossroom/shared-types';

const halfBorder = WORLD.borderSize / 2;

const walls: {
  pos: [number, number, number];
  size: [number, number, number];
}[] = [
  {
    pos: [0, WORLD.wallHeight / 2, -halfBorder],
    size: [WORLD.borderSize, WORLD.wallHeight, 0.3],
  },
  {
    pos: [0, WORLD.wallHeight / 2, halfBorder],
    size: [WORLD.borderSize, WORLD.wallHeight, 0.3],
  },
  {
    pos: [-halfBorder, WORLD.wallHeight / 2, 0],
    size: [0.3, WORLD.wallHeight, WORLD.borderSize],
  },
  {
    pos: [halfBorder, WORLD.wallHeight / 2, 0],
    size: [0.3, WORLD.wallHeight, WORLD.borderSize],
  },
];

/** Neon floor strip that glows with bloom post-processing. */
function NeonStrip({
  position,
  length,
  color,
  vertical = false,
}: {
  position: [number, number, number];
  length: number;
  color: string;
  vertical?: boolean;
}) {
  return (
    <mesh
      position={position}
      rotation={vertical ? [0, Math.PI / 2, 0] : [0, 0, 0]}
    >
      <boxGeometry args={[length, 0.04, 0.06]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={2}
      />
    </mesh>
  );
}

/** Animated zone that materializes when built. Scales from 0 to 1. */
function AnimatedZone({ agent }: { agent: DynamicAgent }) {
  const scaleRef = useRef(0);
  const groupRef = useRef<Group>(null);

  useFrame((_, delta) => {
    scaleRef.current = MathUtils.lerp(scaleRef.current, 1, delta * 2);
    if (groupRef.current) {
      groupRef.current.scale.setScalar(scaleRef.current);
    }
  });

  return (
    <group
      ref={groupRef}
      position={[agent.position[0], 0, agent.position[2]]}
      scale={0}
    >
      {/* Zone plate — glowing circle */}
      <mesh
        position={[0, 0.02, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[3, 32]} />
        <meshStandardMaterial
          color={agent.color}
          transparent
          opacity={0.12}
          emissive={agent.color}
          emissiveIntensity={0.4}
        />
      </mesh>

      {/* Zone rug */}
      <mesh
        position={[0, 0.012, -0.5]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[7, 6]} />
        <meshStandardMaterial
          color={agent.color}
          transparent
          opacity={0.06}
        />
      </mesh>

      {/* Zone label */}
      <Text
        position={[0, 3.5, 0]}
        fontSize={0.35}
        color={agent.color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.015}
        outlineColor="#000000"
        letterSpacing={0.1}
      >
        {agent.zoneName.toUpperCase()}
      </Text>

      {/* Workstation */}
      <Workstation position={[0, 0, 0]} />
    </group>
  );
}

/** Shop area decor — counter + purple neon accents near the Shopkeeper. */
function ShopDecor() {
  const lamp = useGLTF('/models/furniture/lampSquareFloor.glb');

  return (
    <group position={[SHOP.position[0], 0, SHOP.position[2]]}>
      {/* Shop counter */}
      <mesh position={[0, 0.5, -2]} castShadow>
        <boxGeometry args={[3.5, 1, 0.6]} />
        <meshStandardMaterial
          color="#3a2050"
          emissive="#9B59B6"
          emissiveIntensity={0.15}
        />
      </mesh>
      {/* Counter top accent strip */}
      <mesh position={[0, 1.02, -2]}>
        <boxGeometry args={[3.6, 0.04, 0.65]} />
        <meshStandardMaterial
          color="#9B59B6"
          emissive="#9B59B6"
          emissiveIntensity={1.5}
        />
      </mesh>

      {/* Zone rug */}
      <mesh position={[0, 0.012, -0.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[7, 6]} />
        <meshStandardMaterial
          color="#9B59B6"
          transparent
          opacity={0.06}
        />
      </mesh>

      {/* Floor lamps flanking the shop */}
      <primitive
        object={lamp.scene.clone()}
        scale={FURNITURE_SCALE}
        position={[-3, 0, -1]}
        castShadow
      />
      <primitive
        object={lamp.scene.clone()}
        scale={FURNITURE_SCALE}
        position={[3, 0, -1]}
        castShadow
      />
    </group>
  );
}

/** Minimal reception decor (always visible). */
function ReceptionDecor() {
  const plant = useGLTF('/models/furniture/pottedPlant.glb');
  const lamp = useGLTF('/models/furniture/lampSquareFloor.glb');
  const deskCorner = useGLTF('/models/furniture/deskCorner.glb');
  const sofa = useGLTF('/models/furniture/loungeSofa.glb');
  const coffeeTable = useGLTF('/models/furniture/tableCoffee.glb');
  const laptop = useGLTF('/models/furniture/laptop.glb');

  return (
    <group>
      {/* Reception desk near the Receptionist */}
      <primitive
        object={deskCorner.scene.clone()}
        scale={FURNITURE_SCALE}
        position={[-2, 0, 3]}
        rotation={[0, Math.PI / 2, 0]}
        castShadow
      />

      {/* Laptop on reception desk */}
      <primitive
        object={laptop.scene.clone()}
        scale={FURNITURE_SCALE}
        position={[-1.5, 0.78, 3]}
        rotation={[0, Math.PI / 6, 0]}
        castShadow
      />

      {/* Plants around reception */}
      <primitive
        object={plant.scene.clone()}
        scale={FURNITURE_SCALE}
        position={[-3, 0, 5]}
        castShadow
      />
      <primitive
        object={plant.scene.clone()}
        scale={FURNITURE_SCALE}
        position={[3, 0, 5]}
        castShadow
      />
      <primitive
        object={plant.scene.clone()}
        scale={FURNITURE_SCALE}
        position={[-20, 0, 4]}
        castShadow
      />
      <primitive
        object={plant.scene.clone()}
        scale={FURNITURE_SCALE}
        position={[20, 0, 4]}
        castShadow
      />

      {/* Floor lamps */}
      <primitive
        object={lamp.scene.clone()}
        scale={FURNITURE_SCALE}
        position={[-5, 0, 5]}
        castShadow
      />
      <primitive
        object={lamp.scene.clone()}
        scale={FURNITURE_SCALE}
        position={[5, 0, 5]}
        castShadow
      />

      {/* Lounge area near spawn */}
      <primitive
        object={sofa.scene.clone()}
        scale={FURNITURE_SCALE}
        position={[5, 0, 2]}
        rotation={[0, -Math.PI / 2, 0]}
        castShadow
      />
      <primitive
        object={coffeeTable.scene.clone()}
        scale={FURNITURE_SCALE}
        position={[4, 0, 2]}
        castShadow
      />
    </group>
  );
}

/** Isolated component — only re-renders when workspace store changes, not the whole Office. */
function DynamicZones() {
  const dynamicAgents = useWorkspaceStore((s) => s.dynamicAgents);
  const builtAgentIds = useWorkspaceStore((s) => s.builtAgentIds);
  const phase = useWorkspaceStore((s) => s.phase);

  if (phase !== 'building' && phase !== 'ready') return null;

  return (
    <>
      {dynamicAgents.map((agent) => {
        if (!builtAgentIds.has(agent.agentId)) return null;
        return <AnimatedZone key={agent.agentId} agent={agent} />;
      })}
    </>
  );
}

export function Office() {
  return (
    <group>
      {/* Office floor with collision */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh position={[0, -0.1, 0]} receiveShadow>
          <boxGeometry args={[WORLD.floorSize, 0.2, WORLD.floorSize]} />
          <meshStandardMaterial color="#2a2e2c" flatShading />
        </mesh>
      </RigidBody>

      {/* Extended invisible ground — explicit collider so player can walk outside office */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[150, 0.5, 150]} position={[0, -0.6, 0]} />
      </RigidBody>

      {/* Grid overlay */}
      <Grid
        position={[0, 0.01, 0]}
        args={[WORLD.floorSize, WORLD.floorSize]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#2a2a4e"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#3a3a6e"
        fadeDistance={30}
        fadeStrength={1}
        infiniteGrid
      />

      {/* Static agent zone plates + labels (Receptionist, Shopkeeper, etc.) */}
      {agents.map((agent) => (
        <group key={agent.id}>
          <mesh
            position={[agent.position[0], 0.02, agent.position[2]]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <circleGeometry args={[3, 32]} />
            <meshStandardMaterial
              color={zoneColors[agent.zone] ?? '#ffffff'}
              transparent
              opacity={0.08}
              emissive={zoneColors[agent.zone] ?? '#ffffff'}
              emissiveIntensity={0.2}
            />
          </mesh>
          <Text
            position={[agent.position[0], 3.5, agent.position[2]]}
            fontSize={0.35}
            color={zoneColors[agent.zone] ?? '#ffffff'}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.015}
            outlineColor="#000000"
            letterSpacing={0.1}
          >
            {zoneDisplayNames[agent.zone] ?? agent.zone.toUpperCase()}
          </Text>
        </group>
      ))}

      {/* Reception area decor (always visible) */}
      <ReceptionDecor />

      {/* Shop area decor (always visible) */}
      <ShopDecor />

      {/* Purple neon strip around shop zone */}
      <NeonStrip
        position={[SHOP.position[0], 0.03, SHOP.position[2] + 4]}
        length={10}
        color="#9B59B6"
      />

      {/* Dynamic workspace zones — isolated to avoid re-rendering Office */}
      <DynamicZones />

      {/* ── Neon accent strips — border the floor ── */}
      <NeonStrip position={[0, 0.03, halfBorder]} length={WORLD.borderSize} color="#6366f1" />
      <NeonStrip position={[0, 0.03, -halfBorder]} length={WORLD.borderSize} color="#6366f1" />
      <NeonStrip
        position={[-halfBorder, 0.03, 0]}
        length={WORLD.borderSize}
        color="#6366f1"
        vertical
      />
      <NeonStrip
        position={[halfBorder, 0.03, 0]}
        length={WORLD.borderSize}
        color="#6366f1"
        vertical
      />
      <NeonStrip position={[0, 0.03, -2]} length={WORLD.borderSize} color="#3730a3" />

      {/* Perimeter walls */}
      {walls.map((wall, i) => (
        <mesh key={i} position={wall.pos}>
          <boxGeometry args={wall.size} />
          <meshStandardMaterial
            color="#2a2e2c"
            transparent
            opacity={0.3}
            flatShading
          />
        </mesh>
      ))}
    </group>
  );
}

useGLTF.preload('/models/furniture/pottedPlant.glb');
useGLTF.preload('/models/furniture/lampSquareFloor.glb');
useGLTF.preload('/models/furniture/deskCorner.glb');
useGLTF.preload('/models/furniture/loungeSofa.glb');
useGLTF.preload('/models/furniture/tableCoffee.glb');
useGLTF.preload('/models/furniture/laptop.glb');
