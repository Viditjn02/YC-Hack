/** A desk workstation composed of Kenney furniture GLBs. */
'use client';

import { useGLTF } from '@react-three/drei';

import { FURNITURE_SCALE } from '@/data/gameConfig';

export function Workstation({
  position,
}: {
  position: [number, number, number];
}) {
  const desk = useGLTF('/models/furniture/desk.glb');
  const chair = useGLTF('/models/furniture/chairDesk.glb');
  const screen = useGLTF('/models/furniture/computerScreen.glb');
  const keyboard = useGLTF('/models/furniture/computerKeyboard.glb');
  const mouse = useGLTF('/models/furniture/computerMouse.glb');

  const [x, , z] = position;

  return (
    <group position={[x, 0, z - 1.8]}>
      {/* Desk */}
      <primitive
        object={desk.scene.clone()}
        scale={FURNITURE_SCALE}
        position={[0, 0, 0]}
        castShadow
        receiveShadow
      />
      {/* Chair */}
      <primitive
        object={chair.scene.clone()}
        scale={FURNITURE_SCALE}
        position={[0, 0, 1.2]}
        rotation={[0, Math.PI, 0]}
        castShadow
      />
      {/* Monitor */}
      <primitive
        object={screen.scene.clone()}
        scale={FURNITURE_SCALE}
        position={[0, 0, -0.2]}
        castShadow
      />
      {/* Keyboard */}
      <primitive
        object={keyboard.scene.clone()}
        scale={FURNITURE_SCALE}
        position={[0, 0, 0.15]}
        castShadow
      />
      {/* Mouse */}
      <primitive
        object={mouse.scene.clone()}
        scale={FURNITURE_SCALE}
        position={[0.35, 0, 0.15]}
        castShadow
      />
    </group>
  );
}

useGLTF.preload('/models/furniture/desk.glb');
useGLTF.preload('/models/furniture/chairDesk.glb');
useGLTF.preload('/models/furniture/computerScreen.glb');
useGLTF.preload('/models/furniture/computerKeyboard.glb');
useGLTF.preload('/models/furniture/computerMouse.glb');
