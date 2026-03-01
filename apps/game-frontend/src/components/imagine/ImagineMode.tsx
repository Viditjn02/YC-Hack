'use client';

import { useChatStore } from '@/stores/chatStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { ImagineBackground } from './ImagineBackground';
import { ImagineTopBar } from './ImagineTopBar';
import { WelcomeDashboard } from './WelcomeDashboard';
import { DesktopOS, StandaloneChatPanel } from './DesktopOS';
import { EmbedPanel } from '../ui/EmbedPanel';
import { PushToTalkOverlay } from '../ui/PushToTalkOverlay';
import { TTSAudioPlayer } from '../ui/TTSAudioPlayer';

interface Props {
  user: { uid: string; displayName: string | null; email: string };
}

export function ImagineMode({ user }: Props) {
  const chatMessages = useChatStore((s) => s.chatMessages);
  const phase = useWorkspaceStore((s) => s.phase);
  const dynamicAgents = useWorkspaceStore((s) => s.dynamicAgents);

  // Check if user has sent a message to the receptionist (the main interaction point)
  const receptionistMsgs = chatMessages['receptionist'] ?? [];
  const hasUserMessage = receptionistMsgs.some(m => m.role === 'user');

  const hasWorkspace = phase !== 'reception' && dynamicAgents.length > 0;

  const isCanvasMode = true;

  // Transition state: user sent a message but workspace isn't ready yet
  const isWaiting = hasUserMessage && !hasWorkspace;

  return (
    <div className="w-full h-full relative">
      <ImagineBackground canvasMode={isCanvasMode} />
      <ImagineTopBar canvasMode={isCanvasMode} />

      {/* Welcome screen — shown when no workspace is active */}
      {!hasWorkspace && !hasUserMessage && <WelcomeDashboard />}

      {/* Waiting state — message sent, workspace spinning up */}
      {isWaiting && (
        <>
          <div className="absolute inset-0 top-11 z-10 flex flex-col items-center justify-center gap-4">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-white/60 animate-bounce [animation-delay:0ms]" />
              <div className="w-3 h-3 rounded-full bg-white/60 animate-bounce [animation-delay:150ms]" />
              <div className="w-3 h-3 rounded-full bg-white/60 animate-bounce [animation-delay:300ms]" />
            </div>
            <span className="text-white/70 text-sm font-medium">Setting up your workspace...</span>
          </div>
          <StandaloneChatPanel />
        </>
      )}

      {/* Desktop OS — floating windows over the contour background */}
      {hasWorkspace && <DesktopOS />}

      {/* Keep minimal overlays */}
      <EmbedPanel />
      <PushToTalkOverlay />
      <TTSAudioPlayer />
    </div>
  );
}
