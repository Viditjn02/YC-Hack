/** Loads a Kenney Mini Character GLB and plays an animation clip. */
'use client';

import { useRef, useEffect, useMemo } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { useGraph } from '@react-three/fiber';
import { SkeletonUtils } from 'three-stdlib';
import { Color, LoopOnce, LoopRepeat } from 'three';
import type { Group } from 'three';

/** Animations that should loop. Everything else plays once and clamps on last frame. */
const LOOPING_ANIMS = new Set(['idle', 'walk', 'run']);

/** Crossfade durations: longer blend when recovering from a one-shot (e.g., die → idle). */
const FADE_IN_NORMAL = 0.2;
const FADE_IN_RECOVERY = 0.6;

interface CharacterModelProps {
  url: string;
  animation?: string;
  color?: string;
  scale?: number;
}

export function CharacterModel({
  url,
  animation = 'idle',
  color,
  scale = 2.2,
}: CharacterModelProps) {
  const group = useRef<Group>(null);
  const prevAnimation = useRef(animation);
  const { scene, animations } = useGLTF(url);
  
  const clone = useMemo(() => {
    try {
      const cloned = SkeletonUtils.clone(scene);
      // Ensure all geometries have proper attributes
      cloned.traverse((node: any) => {
        if (node.isMesh && node.geometry) {
          const geom = node.geometry;
          
          // Compute bounding volumes
          if (!geom.boundingBox) geom.computeBoundingBox();
          if (!geom.boundingSphere) geom.computeBoundingSphere();
          
          // Validate morph targets
          if (geom.morphAttributes && geom.morphAttributes.position) {
            const baseCount = geom.attributes.position?.count || 0;
            geom.morphAttributes.position = geom.morphAttributes.position.filter(
              (attr: any) => attr.count === baseCount
            );
          }
          
          // Ensure vertex normals exist
          if (!geom.attributes.normal) {
            geom.computeVertexNormals();
          }
        }
      });
      return cloned;
    } catch (error) {
      console.error('Failed to clone character model:', error);
      return scene;
    }
  }, [scene]);
  
  const { materials } = useGraph(clone);
  const { actions } = useAnimations(animations, group);
  
  // Debug: Log available animations once
  useEffect(() => {
    if (animations.length > 0) {
      const animNames = animations.map(a => a.name).join(', ');
      console.log(`[CharacterModel] Available animations for ${url}:`, animNames);
    }
  }, [animations, url]);

  useEffect(() => {
    if (!actions || Object.keys(actions).length === 0) return;
    
    const action = actions[animation];
    if (!action) {
      // Fallback to first available animation if requested one doesn't exist
      const firstAction = Object.values(actions)[0];
      if (firstAction) {
        try {
          firstAction.reset().fadeIn(0.2).play();
        } catch (err) {
          console.warn(`Failed to play fallback animation:`, err);
        }
        return () => {
          try {
            firstAction.fadeOut(0.2);
          } catch (err) {
            // Ignore cleanup errors
          }
        };
      }
      return;
    }
    
    try {
      // Stop all other actions (including clamped one-shot anims like 'die')
      Object.values(actions).forEach(a => {
        if (a && a !== action) {
          try {
            a.fadeOut(0.1).stop();
          } catch (err) {
            // Ignore stop errors
          }
        }
      });
      
      // One-shot animations (attacks, die, emotes) play once and hold last frame
      if (LOOPING_ANIMS.has(animation)) {
        action.setLoop(LoopRepeat, Infinity);
      } else {
        action.setLoop(LoopOnce, 1);
        action.clampWhenFinished = true;
      }

      // Use a longer crossfade when recovering from a one-shot (e.g., die → idle)
      const wasOneShot = !LOOPING_ANIMS.has(prevAnimation.current);
      const fadeIn = wasOneShot && LOOPING_ANIMS.has(animation) ? FADE_IN_RECOVERY : FADE_IN_NORMAL;
      prevAnimation.current = animation;

      action.reset().fadeIn(fadeIn).play();
    } catch (err) {
      console.warn(`Failed to play animation "${animation}":`, err);
    }
    
    return () => {
      try {
        action.fadeOut(0.1).stop();
      } catch (err) {
        // Ignore cleanup errors
      }
    };
  }, [actions, animation]);

  useEffect(() => {
    if (!color) return;
    const mat = materials['colormap'];
    if (mat && 'color' in mat) {
      (mat as unknown as { color: Color }).color.set(color);
    }
  }, [color, materials]);

  return (
    <group ref={group} scale={scale} dispose={null}>
      <primitive object={clone} />
    </group>
  );
}
