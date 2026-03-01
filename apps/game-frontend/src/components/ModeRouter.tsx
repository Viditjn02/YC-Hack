'use client';

import { useEffect } from 'react';
import { useModeStore } from '@/stores/modeStore';
import { useAuthStore } from '@/stores/authStore';
import { initWebSocket } from '@/lib/messageHandler';
import { Game } from '@/components/game/Game';
import { ImagineMode } from '@/components/imagine/ImagineMode';
import { ModeTransition } from '@/components/imagine/ModeTransition';

interface ModeRouterProps {
  user: { uid: string; displayName: string | null; email: string };
}

export function ModeRouter({ user }: ModeRouterProps) {
  const mode = useModeStore((s) => s.mode);
  const transitioning = useModeStore((s) => s.transitioning);

  // Initialize WebSocket ONCE — shared by both modes
  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const token = await useAuthStore.getState().getToken();
        if (!cancelled) {
          initWebSocket(
            user.displayName ?? user.email,
            token,
            useAuthStore.getState().getToken,
            user.uid,
          );
        }
      } catch {
        // Auth token fetch can fail if not yet signed in
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <div className="w-screen h-screen relative overflow-hidden">
      {mode === 'imagine' && <ImagineMode user={user} />}
      {mode === 'game' && <Game user={user} />}
      {transitioning && <ModeTransition />}
    </div>
  );
}
