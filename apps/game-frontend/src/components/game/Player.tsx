/**
 * Player character: WASD movement + CharacterModel + third-person camera.
 */
'use client';

import { Suspense, useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { CapsuleCollider, RigidBody } from '@react-three/rapier';
import type { Group } from 'three';
import { CharacterModel } from './CharacterModel';
import { useWorldStore } from '@/stores/worldStore';
import { useChatStore } from '@/stores/chatStore';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { useVoiceStore } from '@/stores/voiceStore';
import { useAgentBehaviorStore } from '@/stores/agentBehaviorStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useBroadcastPosition } from '@/hooks/useBroadcastPosition';
import { useProximityVoice } from '@/hooks/useProximityVoice';
import { playerSpatialAudio } from '@/lib/playerSpatialAudio';
import { INTERACTION, SPATIAL_AUDIO, PUNCH } from '@/data/gameConfig';
import { getAvatarModelUrl } from '@/data/avatars';
import { cameraYawRef, isFirstPersonRef } from './CameraRig';

const MOVE_SPEED = 5;
const SPAWN: [number, number, number] = [0, 2, 6];
const ROTATION_LERP = 0.15;

/** Shared ref so CameraRig can track the player position. */
export const playerPositionRef = { current: SPAWN as [number, number, number] };

/** Shared ref so CameraRig can swing to a cinematic side view during punches. */
export const punchCameraRef = {
  active: false,
  agentPos: [0, 0, 0] as [number, number, number],
};

export function Player() {
  const rigidBodyRef = useRef<any>(null);
  const modelGroupRef = useRef<Group>(null);
  const facingAngle = useRef(Math.PI); // default facing camera (away from camera)
  const keys = useRef<Record<string, boolean>>({});
  const [animation, setAnimation] = useState('idle');

  const agents = useWorldStore((s) => s.agents);
  const remotePlayers = useWorldStore((s) => s.remotePlayers);
  const setNearestAgent = useWorldStore((s) => s.setNearestAgent);
  const setNearestTarget = useWorldStore((s) => s.setNearestTarget);
  const nearestAgent = useWorldStore((s) => s.nearestAgent);
  const openChat = useChatStore((s) => s.openChat);
  const chatPanelOpen = useChatStore((s) => s.chatPanelOpen);
  const setPlayerPosition = useAgentBehaviorStore((s) => s.setPlayerPosition);
  const avatarId = useSettingsStore((s) => s.avatarId);

  const { startRecording, stopRecording, transcript: voiceTranscript } = useVoiceInput();
  const recordingRef = useRef(false);
  const startPromiseRef = useRef<Promise<void> | null>(null);
  const targetTypeRef = useRef<'agent' | 'player' | null>(null);
  const punchCooldown = useRef(false);
  const attackIndex = useRef(0);
  const reactionIndex = useRef(0);
  const punchAgent = useWorldStore((s) => s.punchAgent);
  const { startPlayerVoice, stopPlayerVoice } = useProximityVoice();

  useBroadcastPosition(rigidBodyRef, animation, facingAngle);

  // Sync voice transcript to store
  useEffect(() => {
    useVoiceStore.getState().setVoiceTranscript(voiceTranscript);
  }, [voiceTranscript]);

  // Keyboard input
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // When typing in an input, ignore WASD/E/T but still allow arrow keys
      const tag = (e.target as HTMLElement)?.tagName;
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;
      if (isTyping) {
        // Still track arrow keys for movement while typing
        if (e.code.startsWith('Arrow')) keys.current[e.code] = true;
        return;
      }

      keys.current[e.code] = true;

      if (e.code === 'KeyE' && nearestAgent && !chatPanelOpen) {
        openChat(nearestAgent);
      }

      if (e.code === 'KeyG') {
        const state = useChatStore.getState();
        if (state.activeAgent) {
          useChatStore.setState({ chatPanelOpen: !state.chatPanelOpen });
        }
      }

      if (e.code === 'KeyT' && !e.repeat) {
        const target = useWorldStore.getState().nearestTarget;
        if (!target) return;

        targetTypeRef.current = target.type; // Lock in the target type

        if (target.type === 'agent') {
          // Voice interaction — use interactAgent (no ChatPanel)
          if (recordingRef.current) return;
          const chatState = useChatStore.getState();
          if (!chatState.activeAgent) chatState.interactAgent(target.id);
          useVoiceStore.getState().stopTTS();
          recordingRef.current = true;
          useVoiceStore.getState().setRecording(true);
          startPromiseRef.current = startRecording();
        } else {
          // Player voice flow (new)
          startPlayerVoice(target.id);
        }
      }

      if (e.code === 'KeyF' && !e.repeat && nearestAgent && !punchCooldown.current) {
        punchCooldown.current = true;
        const attack = PUNCH.attacks[attackIndex.current % PUNCH.attacks.length];
        attackIndex.current++;
        const reaction = PUNCH.reactions[reactionIndex.current % PUNCH.reactions.length];
        reactionIndex.current++;
        setAnimation(attack);
        punchAgent(nearestAgent, reaction);

        // Cinematic side-view camera
        const agentData = useWorldStore.getState().agents.find((a) => a.id === nearestAgent);
        if (agentData) {
          punchCameraRef.active = true;
          punchCameraRef.agentPos = [...agentData.position] as [number, number, number];
          setTimeout(() => { punchCameraRef.active = false; }, PUNCH.reactionDuration);
        }

        setTimeout(() => setAnimation('idle'), PUNCH.attackDuration);
        setTimeout(() => { punchCooldown.current = false; }, PUNCH.cooldown);
      }

      if (e.code === 'KeyR' && !chatPanelOpen) {
        // Open receptionist with a new conversation (additive — keeps existing workspaces)
        useChatStore.getState().newConversation();
        openChat('receptionist');
      }

      // / — focus Team Feed input (Minecraft-style)
      if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        const feedInput = document.getElementById('team-feed-input');
        if (feedInput) {
          e.preventDefault();
          feedInput.focus();
        }
      }

      // Ctrl+1-9 or Cmd+1-9: switch workspace tabs
      if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        const tabs = useChatStore.getState().workspaceTabs;
        if (index < tabs.length) {
          useChatStore.getState().switchWorkspace(tabs[index].id);
          // Just open the panel — workspace:snapshot will set the active agent
          useChatStore.setState({ chatPanelOpen: true });
        } else if (index === tabs.length) {
          useChatStore.getState().newConversation();
          useChatStore.setState({ chatPanelOpen: true, activeAgent: 'receptionist' });
        }
      }
    }

    function handleKeyUp(e: KeyboardEvent) {
      keys.current[e.code] = false;

      // Skip interaction key handling when typing in an input
      const tag = (e.target as HTMLElement)?.tagName;
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;
      if (isTyping) return;

      if (e.code === 'KeyT') {
        if (targetTypeRef.current === 'agent' && recordingRef.current) {
          // Existing agent flow (unchanged)
          recordingRef.current = false;
          const doStop = async () => {
            if (startPromiseRef.current) {
              await startPromiseRef.current;
              startPromiseRef.current = null;
            }
            const transcript = await stopRecording();
            useVoiceStore.getState().setRecording(false);
            useVoiceStore.getState().setVoiceTranscript('');
            const agent = useChatStore.getState().activeAgent;
            if (transcript.trim() && agent) {
              useChatStore.getState().sendMessage(agent, transcript.trim(), 'voice');
            }
          };
          doStop();
        } else if (targetTypeRef.current === 'player') {
          // Player voice flow
          stopPlayerVoice();
        }
        targetTypeRef.current = null; // Reset for next press
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [nearestAgent, chatPanelOpen, openChat, startRecording, stopRecording, startPlayerVoice, stopPlayerVoice]);

  useFrame(() => {
    if (!rigidBodyRef.current) return;

    const rb = rigidBodyRef.current;
    const pos = rb.translation();

    // Movement
    const forward = (keys.current['KeyW'] || keys.current['ArrowUp']) ? 1 : 0;
    const backward = (keys.current['KeyS'] || keys.current['ArrowDown']) ? 1 : 0;
    const left = (keys.current['KeyA'] || keys.current['ArrowLeft']) ? 1 : 0;
    const right = (keys.current['KeyD'] || keys.current['ArrowRight']) ? 1 : 0;

    let moveX = right - left;
    let moveZ = backward - forward;
    const isMoving = moveX !== 0 || moveZ !== 0;

    if (isMoving) {
      // Normalize diagonal movement so strafing isn't faster
      const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
      moveX /= len;
      moveZ /= len;

      if (isFirstPersonRef.current) {
        // Rotate input into world space using camera yaw
        // Forward (-sin(y), -cos(y)) and right (cos(y), -sin(y))
        const cosY = Math.cos(cameraYawRef.current);
        const sinY = Math.sin(cameraYawRef.current);
        const rotX = moveX * cosY + moveZ * sinY;
        const rotZ = -moveX * sinY + moveZ * cosY;
        moveX = rotX;
        moveZ = rotZ;
      }

      rb.setLinvel({ x: moveX * MOVE_SPEED, y: 0, z: moveZ * MOVE_SPEED }, true);
      setAnimation('walk');

      if (isFirstPersonRef.current) {
        // In first person, always face camera direction
        facingAngle.current = cameraYawRef.current + Math.PI;
      } else {
        // Face movement direction
        const targetAngle = Math.atan2(moveX, moveZ);
        let delta = targetAngle - facingAngle.current;
        while (delta > Math.PI) delta -= 2 * Math.PI;
        while (delta < -Math.PI) delta += 2 * Math.PI;
        facingAngle.current += delta * ROTATION_LERP;
      }
    } else {
      rb.setLinvel({ x: 0, y: rb.linvel().y, z: 0 }, true);
      setAnimation('idle');

      if (isFirstPersonRef.current) {
        facingAngle.current = cameraYawRef.current + Math.PI;
      }
    }

    // Apply visual rotation + visibility to model group
    if (modelGroupRef.current) {
      modelGroupRef.current.visible = !isFirstPersonRef.current;
      modelGroupRef.current.rotation.y = facingAngle.current;
    }

    // Expose position for CameraRig
    playerPositionRef.current = [pos.x, pos.y, pos.z];

    // Broadcast player position so agents can sense proximity
    setPlayerPosition([pos.x, pos.y, pos.z]);

    // Find nearest target (agent or player) using facing direction
    const forwardX = Math.sin(facingAngle.current);
    const forwardZ = Math.cos(facingAngle.current);

    let bestTarget: { type: 'agent' | 'player'; id: string } | null = null;
    let bestScore = -Infinity;

    // Score agents
    for (const agent of agents) {
      const dx = agent.position[0] - pos.x;
      const dz = agent.position[2] - pos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist >= INTERACTION.proximityRadius || dist < 0.01) continue;

      const dirX = dx / dist;
      const dirZ = dz / dist;
      const dot = forwardX * dirX + forwardZ * dirZ;
      if (dot < INTERACTION.facingThreshold) continue;
      const score = dot * 2 + (1 - dist / INTERACTION.proximityRadius);
      if (score > bestScore) {
        bestScore = score;
        bestTarget = { type: 'agent', id: agent.id };
      }
    }

    // Score remote players
    for (const player of Object.values(remotePlayers)) {
      const dx = player.position[0] - pos.x;
      const dz = player.position[2] - pos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist >= INTERACTION.proximityRadius || dist < 0.01) continue;

      const dirX = dx / dist;
      const dirZ = dz / dist;
      const dot = forwardX * dirX + forwardZ * dirZ;
      if (dot < INTERACTION.facingThreshold) continue;
      const score = dot * 2 + (1 - dist / INTERACTION.proximityRadius);
      if (score > bestScore) {
        bestScore = score;
        bestTarget = { type: 'player', id: player.id };
      }
    }

    setNearestTarget(bestTarget);
    setNearestAgent(bestTarget?.type === 'agent' ? bestTarget.id : null);

    // Auto-reopen chat when returning to a walk-away agent
    const lastWalkAway = useChatStore.getState().lastWalkAwayAgent;
    const nearestAgentId = bestTarget?.type === 'agent' ? bestTarget.id : null;
    if (nearestAgentId && nearestAgentId === lastWalkAway && !useChatStore.getState().chatPanelOpen) {
      useChatStore.getState().openChat(nearestAgentId);
    }

    // Auto-close chat when player walks too far from the active agent
    const activeAgent = useChatStore.getState().activeAgent;
    if (activeAgent) {
      const agent = agents.find((a) => a.id === activeAgent);
      if (agent) {
        const dx = pos.x - agent.position[0];
        const dz = pos.z - agent.position[2];
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > SPATIAL_AUDIO.maxDistance) {
          useChatStore.getState().closeChat('walkAway');
        }
      }
    }

    // Update spatial audio listener for player voice chat
    playerSpatialAudio.updateListenerPosition(pos.x, pos.y, pos.z);
    playerSpatialAudio.updateListenerOrientation(
      Math.sin(facingAngle.current),
      0,
      Math.cos(facingAngle.current),
    );
  });

  return (
    <RigidBody
      ref={rigidBodyRef}
      position={SPAWN}
      enabledRotations={[false, false, false]}
      lockRotations
      colliders={false}
      ccd
    >
      <CapsuleCollider args={[0.5, 0.3]} />
      <group ref={modelGroupRef} position={[0, -0.8, 0]} rotation={[0, Math.PI, 0]}>
        <Suspense fallback={null}>
          <CharacterModel url={getAvatarModelUrl(avatarId)} animation={animation} />
        </Suspense>
      </group>
    </RigidBody>
  );
}
