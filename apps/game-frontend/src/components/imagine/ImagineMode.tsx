'use client';

import { useChatStore } from '@/stores/chatStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { ImagineBackground } from './ImagineBackground';
import { ImagineTopBar } from './ImagineTopBar';
import { WelcomeDashboard } from './WelcomeDashboard';
import { DesktopOS } from './DesktopOS';
import { EmbedPanel } from '../ui/EmbedPanel';
import { PushToTalkOverlay } from '../ui/PushToTalkOverlay';
import { TTSAudioPlayer } from '../ui/TTSAudioPlayer';

interface Props {
  user: { uid: string; displayName: string | null; email: string };
}

export function ImagineMode({ user }: Props) {
  const activeAgent = useChatStore((s) => s.activeAgent);
  const chatMessages = useChatStore((s) => s.chatMessages);
  const phase = useWorkspaceStore((s) => s.phase);
  const dynamicAgents = useWorkspaceStore((s) => s.dynamicAgents);

  const hasMessages =
    activeAgent && (chatMessages[activeAgent]?.length ?? 0) > 0;

  const hasWorkspace = phase !== 'reception' && dynamicAgents.length > 0;

  // Always canvas mode (lavender bg + contours) — this IS the desktop
  const isCanvasMode = true;

  return (
    <div className="w-full h-full relative">
      <ImagineBackground canvasMode={isCanvasMode} />
      <ImagineTopBar canvasMode={isCanvasMode} />

      {/* Welcome screen when nothing is going on */}
      {!hasWorkspace && !hasMessages && <WelcomeDashboard />}

      {/* Desktop OS — floating windows over the contour background */}
      {hasWorkspace && <DesktopOS />}

      {/* Keep minimal overlays */}
      <EmbedPanel />
      <PushToTalkOverlay />
      <TTSAudioPlayer />
    </div>
  );
}
