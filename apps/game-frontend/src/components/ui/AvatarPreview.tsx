/** Tiny 3D avatar preview for the avatar picker grid. */
'use client';

import { useRef, useEffect, useMemo, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import { SkeletonUtils } from 'three-stdlib';
import type { Group } from 'three';

/* ------------------------------------------------------------------ */
/*  MiniCharacter — runs inside an R3F Canvas, renders one avatar     */
/* ------------------------------------------------------------------ */

function MiniCharacter({ url }: { url: string }) {
  const group = useRef<Group>(null);
  const { scene, animations } = useGLTF(url);

  const clone = useMemo(() => {
    try {
      const cloned = SkeletonUtils.clone(scene);
      cloned.traverse((node: unknown) => {
        const mesh = node as { isMesh?: boolean; geometry?: { boundingBox: unknown; boundingSphere: unknown; computeBoundingBox: () => void; computeBoundingSphere: () => void } };
        if (mesh.isMesh && mesh.geometry) {
          if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
          if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
        }
      });
      return cloned;
    } catch {
      return scene;
    }
  }, [scene]);

  const { actions } = useAnimations(animations, group);

  useEffect(() => {
    const idle = actions['idle'];
    if (idle) idle.reset().play();
  }, [actions]);

  return (
    <group ref={group} scale={2.2} position={[0, -1.35, 0]} rotation={[0, 0.3, 0]}>
      <primitive object={clone} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  AvatarPreview — wraps MiniCharacter in a self-contained Canvas    */
/* ------------------------------------------------------------------ */

export function AvatarPreview({ url, size = 52 }: { url: string; size?: number }) {
  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-lg overflow-hidden"
    >
      <Canvas
        gl={{ alpha: true, antialias: true }}
        camera={{ position: [0, 0.3, 2.2], fov: 35 }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={2} />
        <directionalLight position={[2, 3, 2]} intensity={1.5} />
        <Suspense fallback={null}>
          <MiniCharacter url={url} />
        </Suspense>
      </Canvas>
    </div>
  );
}
