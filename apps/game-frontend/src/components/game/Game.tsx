/** Canvas root: R3F canvas and HTML overlay wiring. */
'use client';

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Scene } from './Scene';
import { ChatPanel } from '../ui/ChatPanel';
import { EmbedPanel } from '../ui/EmbedPanel';
import { ProductCanvas } from '../ui/ProductCanvas';
import { InteractionPrompt } from './InteractionPrompt';
import { PushToTalkOverlay } from '../ui/PushToTalkOverlay';
import { TTSAudioPlayer } from '../ui/TTSAudioPlayer';
import { HUD } from '../ui/HUD';
import { OnboardingOverlay } from '../ui/OnboardingOverlay';
import { PunchHint } from './PunchHint';
import { ViewHint } from './ViewHint';

import { BrowserUseOverlay } from '../ui/BrowserUseOverlay';
import { ScratchpadFeed } from '../ui/ScratchpadFeed';
import { BackgroundMusic } from '../ui/BackgroundMusic';
import { GameToolbar } from '../ui/GameToolbar';
import { WorkspaceBar } from '../ui/WorkspaceBar';
import { CAMERA, WORLD } from '@/data/gameConfig';

interface GameProps {
  user: { uid: string; displayName: string | null; email: string };
}

export function Game({ user }: GameProps) {
  // WebSocket is initialized by ModeRouter — shared across modes

  return (
    <div className="w-screen h-screen relative">
      <Canvas
        shadows
        camera={{ fov: CAMERA.fov }}
        style={{ background: WORLD.background }}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
      <HUD />
      <BrowserUseOverlay />
      <ChatPanel />
      <EmbedPanel />
      <ProductCanvas />
      <InteractionPrompt />
      <PunchHint />
      <ViewHint />
      <PushToTalkOverlay />
      <TTSAudioPlayer />
      <OnboardingOverlay />
      <ScratchpadFeed />
      <BackgroundMusic />
      <GameToolbar />
      <WorkspaceBar />
    </div>
  );
}
