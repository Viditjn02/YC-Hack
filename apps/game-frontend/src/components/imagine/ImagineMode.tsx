'use client';

import { useChatStore } from '@/stores/chatStore';
import { ImagineBackground } from './ImagineBackground';
import { ImagineTopBar } from './ImagineTopBar';
import { WelcomeDashboard } from './WelcomeDashboard';
import { ChatPanel } from '../ui/ChatPanel';
import { EmbedPanel } from '../ui/EmbedPanel';
import { ProductCanvas } from '../ui/ProductCanvas';
import { ScratchpadFeed } from '../ui/ScratchpadFeed';
import { WorkspaceBar } from '../ui/WorkspaceBar';
import { PushToTalkOverlay } from '../ui/PushToTalkOverlay';
import { TTSAudioPlayer } from '../ui/TTSAudioPlayer';
import { GameToolbar } from '../ui/GameToolbar';

interface Props {
  user: { uid: string; displayName: string | null; email: string };
}

export function ImagineMode({ user }: Props) {
  const chatPanelOpen = useChatStore((s) => s.chatPanelOpen);
  const activeAgent = useChatStore((s) => s.activeAgent);
  const chatMessages = useChatStore((s) => s.chatMessages);

  const hasMessages =
    activeAgent && (chatMessages[activeAgent]?.length ?? 0) > 0;

  // Canvas mode (lavender bg) when welcome; chat mode (dark) when ChatPanel is open
  const isCanvasMode = !chatPanelOpen && !hasMessages;

  return (
    <div className="w-full h-full relative">
      <ImagineBackground canvasMode={isCanvasMode} />
      <ImagineTopBar canvasMode={isCanvasMode} />

      {/* Welcome screen only when no chat is open */}
      {isCanvasMode && <WelcomeDashboard />}

      {/* Original BossRoom overlays for full functionality */}
      <ChatPanel />
      <EmbedPanel />
      <ProductCanvas />
      <ScratchpadFeed />
      <WorkspaceBar />
      <PushToTalkOverlay />
      <TTSAudioPlayer />
      <GameToolbar />
    </div>
  );
}
