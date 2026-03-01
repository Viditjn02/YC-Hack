/**
 * Camera rig with first/third-person toggle (V key).
 *
 * Third-person: Roblox-style follow cam — drag to orbit, scroll to zoom.
 * First-person: Pointer-locked FPS camera, WASD is camera-relative.
 */
'use client';

import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3, MathUtils } from 'three';
import { playerPositionRef, punchCameraRef } from './Player';

/* ── Shared refs so Player can read camera state ── */
export const cameraYawRef = { current: 0 };
export const isFirstPersonRef = { current: false };

/* ── Third-person constants ── */
const DEFAULT_DISTANCE = 10;
const MIN_DISTANCE = 5;
const MAX_DISTANCE = 25;
const TP_MIN_POLAR = 0.3;
const TP_MAX_POLAR = Math.PI / 2.2;

/* ── First-person constants ── */
const FP_MIN_POLAR = 0.3;                // look almost straight up
const FP_MAX_POLAR = Math.PI - 0.3;      // look almost straight down
const FP_EYE_HEIGHT = 1.0;

/* ── Shared constants ── */
const FOLLOW_LERP = 0.08;
const LOOK_LERP = 0.12;
const ROTATE_SPEED = 0.005;
const ZOOM_SPEED = 1.5;

/** Cinematic punch camera constants */
const PUNCH_SIDE_DISTANCE = 6;     // how far the camera sits from the midpoint
const PUNCH_HEIGHT_OFFSET = 2.5;   // extra height for the cinematic view
const PUNCH_BLEND_IN = 0.1;        // lerp speed toward cinematic view
const PUNCH_BLEND_OUT = 0.04;      // lerp speed returning to normal (slower)

export function CameraRig() {
  const { camera, gl } = useThree();

  const yaw = useRef(0);
  const polar = useRef(1.1);
  const distance = useRef(DEFAULT_DISTANCE);
  const isDragging = useRef(false);
  const smoothTarget = useRef(new Vector3());
  const smoothPos = useRef(new Vector3());
  const initialized = useRef(false);
  const punchBlend = useRef(0);

  // Pointer + scroll + toggle handlers
  useEffect(() => {
    const canvas = gl.domElement;

    const onPointerDown = () => {
      isDragging.current = true;
      // Re-lock pointer if in FP mode but unlocked (e.g. after Escape)
      if (isFirstPersonRef.current && document.pointerLockElement !== canvas) {
        canvas.requestPointerLock();
      }
    };
    const onPointerUp = () => { isDragging.current = false; };
    const onPointerMove = (e: PointerEvent) => {
      // FP: require pointer lock. TP: require drag.
      if (isFirstPersonRef.current) {
        if (document.pointerLockElement !== canvas) return;
      } else {
        if (!isDragging.current) return;
      }
      yaw.current -= e.movementX * ROTATE_SPEED;
      const [minP, maxP] = isFirstPersonRef.current
        ? [FP_MIN_POLAR, FP_MAX_POLAR]
        : [TP_MIN_POLAR, TP_MAX_POLAR];
      polar.current = MathUtils.clamp(
        polar.current - e.movementY * ROTATE_SPEED,
        minP,
        maxP,
      );
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (isFirstPersonRef.current) return;
      distance.current = MathUtils.clamp(
        distance.current + (e.deltaY > 0 ? ZOOM_SPEED : -ZOOM_SPEED),
        MIN_DISTANCE,
        MAX_DISTANCE,
      );
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'v' && e.key !== 'V') return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;

      isFirstPersonRef.current = !isFirstPersonRef.current;
      // Clamp polar to the new mode's range
      const [minP, maxP] = isFirstPersonRef.current
        ? [FP_MIN_POLAR, FP_MAX_POLAR]
        : [TP_MIN_POLAR, TP_MAX_POLAR];
      polar.current = MathUtils.clamp(polar.current, minP, maxP);

      // Lock/unlock pointer
      if (isFirstPersonRef.current) {
        canvas.requestPointerLock();
      } else {
        document.exitPointerLock();
      }
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown);

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      // Release pointer lock on unmount
      if (document.pointerLockElement === canvas) document.exitPointerLock();
    };
  }, [gl]);

  useFrame(() => {
    const [px, py, pz] = playerPositionRef.current;
    cameraYawRef.current = yaw.current;

    if (isFirstPersonRef.current) {
      /* ── First-person: camera at eye level, no lerp ── */
      const p = polar.current;
      const y = yaw.current;
      const eyePos = new Vector3(px, py + FP_EYE_HEIGHT, pz);
      const lookTarget = new Vector3(
        px - Math.sin(p) * Math.sin(y),
        py + FP_EYE_HEIGHT - Math.cos(p),
        pz - Math.sin(p) * Math.cos(y),
      );

      camera.position.copy(eyePos);
      camera.lookAt(lookTarget);
      // Keep smooth refs in sync so switching back to TP doesn't jerk
      smoothPos.current.copy(eyePos);
      smoothTarget.current.copy(lookTarget);
      initialized.current = true;
    } else {
      /* ── Third-person: Roblox-style follow cam ── */
      const targetPoint = new Vector3(px, py + 1.5, pz);

      const d = distance.current;
      const p = polar.current;
      const y = yaw.current;
      const desiredPos = new Vector3(
        px + d * Math.sin(p) * Math.sin(y),
        py + d * Math.cos(p),
        pz + d * Math.sin(p) * Math.cos(y),
      );

      if (!initialized.current) {
        smoothTarget.current.copy(targetPoint);
        smoothPos.current.copy(desiredPos);
        camera.position.copy(desiredPos);
        camera.lookAt(targetPoint);
        initialized.current = true;
        return;
      }

      // --- Cinematic punch camera blend (TP only) ---
      const blendTarget = punchCameraRef.active ? 1 : 0;
      const blendSpeed = punchCameraRef.active ? PUNCH_BLEND_IN : PUNCH_BLEND_OUT;
      punchBlend.current = MathUtils.lerp(punchBlend.current, blendTarget, blendSpeed);

      if (punchBlend.current > 0.005) {
        const ap = punchCameraRef.agentPos;
        const midX = (px + ap[0]) / 2;
        const midZ = (pz + ap[2]) / 2;
        const dx = ap[0] - px;
        const dz = ap[2] - pz;
        const len = Math.sqrt(dx * dx + dz * dz) || 1;
        const perpX = -dz / len;
        const perpZ = dx / len;

        const cinematicPos = new Vector3(
          midX + perpX * PUNCH_SIDE_DISTANCE,
          py + PUNCH_HEIGHT_OFFSET,
          midZ + perpZ * PUNCH_SIDE_DISTANCE,
        );
        const cinematicTarget = new Vector3(midX, py + 1, midZ);

        const b = punchBlend.current;
        desiredPos.lerp(cinematicPos, b);
        targetPoint.lerp(cinematicTarget, b);
      }

      smoothTarget.current.lerp(targetPoint, LOOK_LERP);
      smoothPos.current.lerp(desiredPos, FOLLOW_LERP);

      camera.position.copy(smoothPos.current);
      camera.lookAt(smoothTarget.current);
    }
  });

  return null;
}
