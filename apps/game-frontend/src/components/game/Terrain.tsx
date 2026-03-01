/**
 * Procedural terrain: chunk-based blocky heightmap surrounding the office.
 * Loads/unloads chunks imperatively around the player for performance.
 */
'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  createChunkGeometry,
  createDecorationGeometry,
  TERRAIN,
} from '@/lib/terrain';
import { playerPositionRef } from './Player';

const terrainMaterial = new THREE.MeshLambertMaterial({
  vertexColors: true,
  polygonOffset: true,
  polygonOffsetFactor: 1,
  polygonOffsetUnits: 1,
});

type ChunkData = {
  terrain: THREE.Mesh;
  deco: THREE.Mesh | null;
};

export function Terrain() {
  const groupRef = useRef<THREE.Group>(null);
  const chunksRef = useRef(new Map<string, ChunkData>());
  const lastCX = useRef(NaN);
  const lastCZ = useRef(NaN);

  useFrame(() => {
    const [px, , pz] = playerPositionRef.current;
    const cx = Math.floor(px / TERRAIN.chunkSize);
    const cz = Math.floor(pz / TERRAIN.chunkSize);

    // Only recalculate when the player crosses a chunk boundary
    if (cx === lastCX.current && cz === lastCZ.current) return;
    lastCX.current = cx;
    lastCZ.current = cz;

    const group = groupRef.current;
    if (!group) return;

    const chunks = chunksRef.current;
    const needed = new Set<string>();

    for (let dx = -TERRAIN.loadRadius; dx <= TERRAIN.loadRadius; dx++) {
      for (let dz = -TERRAIN.loadRadius; dz <= TERRAIN.loadRadius; dz++) {
        const ccx = cx + dx;
        const ccz = cz + dz;
        const key = `${ccx},${ccz}`;
        needed.add(key);

        if (!chunks.has(key)) {
          const dist = Math.max(Math.abs(dx), Math.abs(dz));
          const isNear = dist <= TERRAIN.nearLodRadius;
          const resolution = isNear ? TERRAIN.chunkSize : TERRAIN.farResolution;

          // Terrain mesh
          const terrainGeo = createChunkGeometry(ccx, ccz, resolution);
          const terrainMesh = new THREE.Mesh(terrainGeo, terrainMaterial);
          terrainMesh.position.set(ccx * TERRAIN.chunkSize, 0, ccz * TERRAIN.chunkSize);
          terrainMesh.receiveShadow = true;
          group.add(terrainMesh);

          // Decoration mesh (near chunks only)
          let decoMesh: THREE.Mesh | null = null;
          if (isNear) {
            const decoGeo = createDecorationGeometry(ccx, ccz);
            if (decoGeo) {
              decoMesh = new THREE.Mesh(decoGeo, terrainMaterial);
              decoMesh.position.set(ccx * TERRAIN.chunkSize, 0, ccz * TERRAIN.chunkSize);
              group.add(decoMesh);
            }
          }

          chunks.set(key, { terrain: terrainMesh, deco: decoMesh });
        }
      }
    }

    // Remove chunks that are now too far
    for (const [key, chunk] of chunks) {
      if (!needed.has(key)) {
        group.remove(chunk.terrain);
        chunk.terrain.geometry.dispose();
        if (chunk.deco) {
          group.remove(chunk.deco);
          chunk.deco.geometry.dispose();
        }
        chunks.delete(key);
      }
    }
  });

  return <group ref={groupRef} />;
}
