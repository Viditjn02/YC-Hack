/** Scene composition: lighting, fog, office environment, agents, player, post-processing. */
'use client';

import { Suspense } from 'react';
import { Physics } from '@react-three/rapier';
import { Sky } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { Office } from './Office';
import { Terrain } from './Terrain';
import { StanfordCampus } from './StanfordCampus';
import { Agent } from './Agent';
import { Player } from './Player';
import { CameraRig } from './CameraRig';
import { SpatialAudioListener } from './SpatialAudioListener';
import { RemotePlayer } from './RemotePlayer';
import { EmbedScreen } from './EmbedScreen';
import { MissionControlSky } from './MissionControlSky';
import { useWorldStore } from '@/stores/worldStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useBuildSequence } from '@/hooks/useBuildSequence';
import { toDynamicAgentData } from '@/data/agents';
import { LIGHTING, POST_PROCESSING } from '@/data/gameConfig';

/** Isolated component — only re-renders when workspace store changes, not the whole Scene. */
function DynamicAgents() {
  const dynamicAgents = useWorkspaceStore((s) => s.dynamicAgents);
  const builtAgentIds = useWorkspaceStore((s) => s.builtAgentIds);

  return (
    <>
      {dynamicAgents
        .filter((a) => builtAgentIds.has(a.agentId))
        .map((a) => (
          <Agent key={a.agentId} agent={toDynamicAgentData(a)} />
        ))}
    </>
  );
}

export function Scene() {
  const agents = useWorldStore((s) => s.agents);
  const remotePlayers = useWorldStore((s) => s.remotePlayers);

  // Activate the build sequence timer
  useBuildSequence();

  return (
    <>
      <ambientLight
        intensity={LIGHTING.ambient.intensity}
        color={LIGHTING.ambient.color}
      />
      <directionalLight
        position={LIGHTING.directional.position}
        intensity={LIGHTING.directional.intensity}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />
      <pointLight
        position={LIGHTING.point.position}
        intensity={LIGHTING.point.intensity}
        color={LIGHTING.point.color}
      />

      <Sky sunPosition={[100, 60, 100]} turbidity={0.8} rayleigh={0.5} />
      <CameraRig />
      <SpatialAudioListener />

      <fog
        attach="fog"
        args={[LIGHTING.fog.color, LIGHTING.fog.near, LIGHTING.fog.far]}
      />

      <Terrain />
      <MissionControlSky />
      {/* Easter egg: Stanford campus hidden in the terrain */}
      <Suspense fallback={null}>
        <StanfordCampus />
      </Suspense>

      <Physics gravity={[0, -30, 0]}>
        <Suspense fallback={null}>
          <Office />

          {/* Static agents (Receptionist) from world store */}
          {agents.map((agent) => (
            <Agent key={agent.id} agent={agent} />
          ))}

          {/* Dynamic agents — isolated to avoid re-rendering Scene */}
          <DynamicAgents />

          {Object.values(remotePlayers).map((player) => (
            <RemotePlayer key={player.id} player={player} />
          ))}

          <Player />
        </Suspense>
      </Physics>

      {/* 3D embed screen — outside Physics, purely visual */}
      <EmbedScreen />

      <EffectComposer>
        <Bloom
          luminanceThreshold={POST_PROCESSING.bloom.threshold}
          luminanceSmoothing={POST_PROCESSING.bloom.smoothing}
          intensity={POST_PROCESSING.bloom.intensity}
        />
        <Vignette
          eskil={false}
          offset={POST_PROCESSING.vignette.offset}
          darkness={POST_PROCESSING.vignette.darkness}
        />
      </EffectComposer>
    </>
  );
}
