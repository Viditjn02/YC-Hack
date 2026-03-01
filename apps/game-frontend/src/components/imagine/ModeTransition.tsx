'use client';

import { useEffect, useRef } from 'react';
import { useModeStore } from '@/stores/modeStore';

export function ModeTransition() {
  const ref = useRef<HTMLDivElement>(null);
  const targetMode = useModeStore((s) => s.targetMode);
  const setMode = useModeStore((s) => s.setMode);
  const completeTransition = useModeStore((s) => s.completeTransition);

  const isToGame = targetMode === 'game';

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Phase 1: circle wipe expands (0-500ms)
    el.style.animation = 'modeTransitionWipe 500ms cubic-bezier(0.4, 0, 0.2, 1) forwards';

    // Phase 2: at 400ms, swap the underlying mode (hidden by overlay)
    const swapTimer = setTimeout(() => {
      if (targetMode) setMode(targetMode);
    }, 400);

    // Phase 3: fade out overlay (500-900ms)
    const fadeTimer = setTimeout(() => {
      el.style.animation = 'modeTransitionFadeOut 400ms ease-out forwards';
    }, 550);

    // Done
    const doneTimer = setTimeout(() => {
      completeTransition();
    }, 950);

    return () => {
      clearTimeout(swapTimer);
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [targetMode, setMode, completeTransition]);

  return (
    <div
      ref={ref}
      className="fixed inset-0 z-[100]"
      style={{
        background: isToGame
          ? 'radial-gradient(circle at 50% 50%, #0a0a1a 0%, #1a1a3e 50%, #0a0a1a 100%)'
          : 'radial-gradient(circle at 50% 50%, #C5C8D8 0%, #D5D8E8 50%, #C5C8D8 100%)',
        clipPath: 'circle(0% at 50% 50%)',
      }}
    >
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className={`text-5xl font-light tracking-wider ${isToGame ? 'text-indigo-400' : 'text-[#2D2D2D]'}`}>
            {isToGame ? 'Game Mode' : 'Imagine'}
          </div>
          <div className={`text-sm mt-3 opacity-60 ${isToGame ? 'text-white' : 'text-[#2D2D2D]'}`}>
            {isToGame ? 'Entering BossRoom...' : 'Professional workspace'}
          </div>
        </div>
      </div>
    </div>
  );
}
