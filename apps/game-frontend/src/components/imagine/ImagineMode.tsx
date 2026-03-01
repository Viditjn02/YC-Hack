'use client';

import { useChatStore } from '@/stores/chatStore';
import { ImagineBackground } from './ImagineBackground';
import { ImagineTopBar } from './ImagineTopBar';
import { WelcomeDashboard } from './WelcomeDashboard';
import { ImagineChat } from './ImagineChat';
import { ImaginePromptBar } from './ImaginePromptBar';
import { ImagineThinkingBubble } from './ImagineThinkingBubble';
import { ImagineActivitySidebar } from './ImagineActivitySidebar';
import { ImagineEmbedWindow } from './ImagineEmbedWindow';

interface Props {
  user: { uid: string; displayName: string | null; email: string };
}

export function ImagineMode({ user }: Props) {
  const activeAgent = useChatStore((s) => s.activeAgent);
  const chatMessages = useChatStore((s) => s.chatMessages);

  const hasMessages =
    activeAgent && (chatMessages[activeAgent]?.length ?? 0) > 0;

  // Canvas mode (lavender bg) when welcome; chat mode (dark) when conversation active
  const isCanvasMode = !hasMessages;

  return (
    <div className="w-full h-full relative">
      <ImagineBackground canvasMode={isCanvasMode} />
      <ImagineTopBar canvasMode={isCanvasMode} />

      {!hasMessages ? <WelcomeDashboard /> : <ImagineChat />}

      <ImagineThinkingBubble />
      <ImagineActivitySidebar />
      <ImagineEmbedWindow />

      {/* Floating prompt bar in canvas mode only (chat mode has it embedded) */}
      {isCanvasMode && activeAgent && <ImaginePromptBar />}
    </div>
  );
}
