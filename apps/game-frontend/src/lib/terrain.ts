/**
 * Procedural terrain generation: seeded simplex noise → blocky heightmap
 * with vertex colors, side faces, and small decorations (flowers, grass tufts).
 */
import { createNoise2D } from 'simplex-noise';
import * as THREE from 'three';

// ── Configuration ──────────────────────────────────────────────────────────

export const TERRAIN = {
  /** World-space size of each chunk (in units). */
  chunkSize: 32,
  /** Chunks loaded in each direction around the player. */
  loadRadius: 5,
  /** Chunks within this radius use full resolution. */
  nearLodRadius: 2,
  /** Resolution (cells per side) for far-LOD chunks. */
  farResolution: 8,
  /** World seed for deterministic generation. */
  seed: 'bossroom-world-42',
  /** Distance from world center where terrain is flat (under office). */
  clearingRadius: 52,
  /** Distance where terrain reaches full natural height. */
  transitionEnd: 65,
} as const;

// Height → color mapping (muted natural palette)
const COLOR_BANDS: { maxHeight: number; color: THREE.Color }[] = [
  { maxHeight: 0, color: new THREE.Color(0x4a7c59) }, // Dark forest green
  { maxHeight: 4, color: new THREE.Color(0x6ab04c) }, // Grass green
  { maxHeight: 8, color: new THREE.Color(0x8fbe7a) }, // Light grass
  { maxHeight: 13, color: new THREE.Color(0x8b8b7a) }, // Rocky tan
  { maxHeight: 18, color: new THREE.Color(0x9e9e9e) }, // Stone gray
  { maxHeight: Infinity, color: new THREE.Color(0xd4d4d4) }, // Snow cap
];

const SIDE_DARKEN = 0.65;

// Decoration colors (pre-computed top + side variants)
const FLOWER_COLORS = [
  new THREE.Color(0xe74c3c), // Red
  new THREE.Color(0xf39c12), // Gold
  new THREE.Color(0xe67e22), // Orange
  new THREE.Color(0x9b59b6), // Purple
  new THREE.Color(0xecf0f1), // White
  new THREE.Color(0x3498db), // Blue
];
const FLOWER_SIDE = FLOWER_COLORS.map((c) => c.clone().multiplyScalar(0.75));

const GRASS_COLORS = [
  new THREE.Color(0x55a630), // Bright green
  new THREE.Color(0x2d6a4f), // Dark green
  new THREE.Color(0x80b918), // Lime green
];
const GRASS_SIDE = GRASS_COLORS.map((c) => c.clone().multiplyScalar(0.8));

// ── Seedable PRNG (mulberry32) ─────────────────────────────────────────────

function seedHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Noise setup ────────────────────────────────────────────────────────────

const noise2D = createNoise2D(mulberry32(seedHash(TERRAIN.seed)));
const jitterNoise = createNoise2D(
  mulberry32(seedHash(TERRAIN.seed + '-color')),
);

// ── Easter egg campus clearing ────────────────────────────────────────────

/**
 * Stanford campus surrounds the office at center [0,0].
 * Model footprint at scale 1: ±58 units from center.
 * Clearing keeps terrain flat under the entire campus.
 */
const CAMPUS_CLEARING_RADIUS = 62;
/** Distance where terrain reaches full height beyond campus edge. */
const CAMPUS_TRANSITION_END = 78;

// ── Height sampling ────────────────────────────────────────────────────────

/** Sample terrain height at a world-space position. */
export function sampleHeight(worldX: number, worldZ: number): number {
  const dist = Math.sqrt(worldX * worldX + worldZ * worldZ);

  // Under the office: flush with floor (polygonOffset prevents z-fighting)
  if (dist < TERRAIN.clearingRadius) return 0;

  // Under the Stanford campus (surrounds office at center): flat clearing
  if (dist < CAMPUS_CLEARING_RADIUS) return 0;

  // Multi-octave simplex noise
  let h = 0;
  h += noise2D(worldX / 120, worldZ / 120) * 14; // Broad rolling hills
  h += noise2D(worldX / 50, worldZ / 50) * 7; // Medium features
  h += noise2D(worldX / 25, worldZ / 25) * 3; // Fine detail

  // Smooth transition from clearing edge (0) to full terrain
  if (dist < TERRAIN.transitionEnd) {
    const t =
      (dist - TERRAIN.clearingRadius) /
      (TERRAIN.transitionEnd - TERRAIN.clearingRadius);
    h = Math.max(0, h) * t * t; // Quadratic ease-in, clamped ≥ 0
  }

  // Smooth transition around Stanford campus (extends beyond office transition)
  if (dist < CAMPUS_TRANSITION_END) {
    const t =
      (dist - CAMPUS_CLEARING_RADIUS) /
      (CAMPUS_TRANSITION_END - CAMPUS_CLEARING_RADIUS);
    h = Math.max(0, h) * t * t;
  }

  return Math.floor(h); // Quantize for blocky look
}

// ── Color with per-cell variation ──────────────────────────────────────────

const tmpColor = new THREE.Color();
const tmpSideColor = new THREE.Color();

function getColor(
  height: number,
  worldX: number,
  worldZ: number,
): THREE.Color {
  let base = COLOR_BANDS[COLOR_BANDS.length - 1].color;
  for (const band of COLOR_BANDS) {
    if (height <= band.maxHeight) {
      base = band.color;
      break;
    }
  }
  // Subtle per-cell brightness jitter for Minecraft-like variation
  const jitter = jitterNoise(worldX * 0.5, worldZ * 0.5) * 0.07;
  tmpColor.setRGB(
    Math.max(0, Math.min(1, base.r + jitter)),
    Math.max(0, Math.min(1, base.g + jitter)),
    Math.max(0, Math.min(1, base.b + jitter)),
  );
  return tmpColor;
}

// ── Chunk geometry builder ─────────────────────────────────────────────────

/**
 * Build chunk mesh geometry: flat top faces + vertical side faces
 * where height drops, colored by height band with per-cell variation.
 */
export function createChunkGeometry(
  chunkX: number,
  chunkZ: number,
  resolution: number = TERRAIN.chunkSize,
): THREE.BufferGeometry {
  const cellSize = TERRAIN.chunkSize / resolution;
  const positions: number[] = [];
  const colors: number[] = [];
  const normals: number[] = [];

  // Sample heights including a 1-cell border for side-face detection
  const heights: number[][] = [];
  for (let x = -1; x <= resolution; x++) {
    heights[x + 1] = [];
    for (let z = -1; z <= resolution; z++) {
      const worldX = chunkX * TERRAIN.chunkSize + (x + 0.5) * cellSize;
      const worldZ = chunkZ * TERRAIN.chunkSize + (z + 0.5) * cellSize;
      heights[x + 1][z + 1] = sampleHeight(worldX, worldZ);
    }
  }

  for (let x = 0; x < resolution; x++) {
    for (let z = 0; z < resolution; z++) {
      const h = heights[x + 1][z + 1];

      const lx = x * cellSize;
      const lz = z * cellSize;
      const worldX = chunkX * TERRAIN.chunkSize + (x + 0.5) * cellSize;
      const worldZ = chunkZ * TERRAIN.chunkSize + (z + 0.5) * cellSize;
      const color = getColor(h, worldX, worldZ);

      // ── Top face (quad = 2 triangles, CCW winding for upward normal) ──
      pushQuad(
        positions, normals, colors,
        lx, h, lz,
        lx, h, lz + cellSize,
        lx + cellSize, h, lz + cellSize,
        lx + cellSize, h, lz,
        0, 1, 0,
        color,
      );

      // ── Side faces where this cell is taller than its neighbor ──
      tmpSideColor.copy(tmpColor).multiplyScalar(SIDE_DARKEN);

      const sides: [number, number, number, number, number, number, number, number][] = [
        [1, 0, 1, 0, lx + cellSize, lz, lx + cellSize, lz + cellSize], // +X
        [-1, 0, -1, 0, lx, lz + cellSize, lx, lz], // -X
        [0, 1, 0, 1, lx + cellSize, lz + cellSize, lx, lz + cellSize], // +Z
        [0, -1, 0, -1, lx, lz, lx + cellSize, lz], // -Z
      ];

      for (const [dx, dz, nx, nz, sx1, sz1, sx2, sz2] of sides) {
        const bottom = heights[x + 1 + dx][z + 1 + dz];
        if (bottom < h) {
          pushQuad(
            positions, normals, colors,
            sx1, h, sz1,
            sx2, h, sz2,
            sx2, bottom, sz2,
            sx1, bottom, sz1,
            nx, 0, nz,
            tmpSideColor,
          );
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();

  return geometry;
}

// ── Decoration geometry (flowers + grass tufts) ────────────────────────────

/** Deterministic hash for decoration placement. */
function cellHash(x: number, z: number): number {
  let h = (x * 374761393 + z * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Generate small voxel decorations (flowers, grass tufts) for a chunk.
 * Only call for near-LOD chunks. Returns null if no decorations.
 */
export function createDecorationGeometry(
  chunkX: number,
  chunkZ: number,
): THREE.BufferGeometry | null {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];

  for (let x = 0; x < TERRAIN.chunkSize; x++) {
    for (let z = 0; z < TERRAIN.chunkSize; z++) {
      const worldX = chunkX * TERRAIN.chunkSize + x + 0.5;
      const worldZ = chunkZ * TERRAIN.chunkSize + z + 0.5;
      const h = sampleHeight(worldX, worldZ);

      // Only decorate grass-height blocks
      if (h < 1 || h > 8) continue;

      const hash = cellHash(Math.floor(worldX), Math.floor(worldZ));
      const roll = hash % 100;

      // Offset within cell for natural randomness
      const ox = ((hash >> 8) % 60) / 100 + 0.2;
      const oz = ((hash >> 16) % 60) / 100 + 0.2;

      if (roll < 6) {
        // Flower: small bright cube
        const idx = hash % FLOWER_COLORS.length;
        pushSmallBox(
          positions, normals, colors,
          x + ox, h, z + oz,
          0.1, 0.3, 0.1,
          FLOWER_COLORS[idx], FLOWER_SIDE[idx],
        );
      } else if (roll < 18) {
        // Grass tuft: thin tall green box
        const idx = hash % GRASS_COLORS.length;
        pushSmallBox(
          positions, normals, colors,
          x + ox, h, z + oz,
          0.06, 0.45, 0.06,
          GRASS_COLORS[idx], GRASS_SIDE[idx],
        );
      }
    }
  }

  if (positions.length === 0) return null;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

// ── Geometry helpers ───────────────────────────────────────────────────────

/** Push a quad (2 triangles, 6 vertices) with uniform normal and color. */
function pushQuad(
  positions: number[], normals: number[], colors: number[],
  x1: number, y1: number, z1: number,
  x2: number, y2: number, z2: number,
  x3: number, y3: number, z3: number,
  x4: number, y4: number, z4: number,
  nx: number, ny: number, nz: number,
  color: THREE.Color,
) {
  positions.push(x1, y1, z1, x2, y2, z2, x3, y3, z3);
  positions.push(x1, y1, z1, x3, y3, z3, x4, y4, z4);
  for (let i = 0; i < 6; i++) {
    normals.push(nx, ny, nz);
    colors.push(color.r, color.g, color.b);
  }
}

/** Push a small box (top + 4 sides, no bottom) for decoration voxels. */
function pushSmallBox(
  positions: number[], normals: number[], colors: number[],
  cx: number, bottomY: number, cz: number,
  halfW: number, boxH: number, halfD: number,
  topColor: THREE.Color, sideColor: THREE.Color,
) {
  const topY = bottomY + boxH;
  // Top
  pushQuad(positions, normals, colors,
    cx - halfW, topY, cz - halfD,
    cx - halfW, topY, cz + halfD,
    cx + halfW, topY, cz + halfD,
    cx + halfW, topY, cz - halfD,
    0, 1, 0, topColor);
  // +X
  pushQuad(positions, normals, colors,
    cx + halfW, bottomY, cz - halfD,
    cx + halfW, topY, cz - halfD,
    cx + halfW, topY, cz + halfD,
    cx + halfW, bottomY, cz + halfD,
    1, 0, 0, sideColor);
  // -X
  pushQuad(positions, normals, colors,
    cx - halfW, bottomY, cz + halfD,
    cx - halfW, topY, cz + halfD,
    cx - halfW, topY, cz - halfD,
    cx - halfW, bottomY, cz - halfD,
    -1, 0, 0, sideColor);
  // +Z
  pushQuad(positions, normals, colors,
    cx + halfW, bottomY, cz + halfD,
    cx + halfW, topY, cz + halfD,
    cx - halfW, topY, cz + halfD,
    cx - halfW, bottomY, cz + halfD,
    0, 0, 1, sideColor);
  // -Z
  pushQuad(positions, normals, colors,
    cx - halfW, bottomY, cz - halfD,
    cx - halfW, topY, cz - halfD,
    cx + halfW, topY, cz - halfD,
    cx + halfW, bottomY, cz - halfD,
    0, 0, -1, sideColor);
}
