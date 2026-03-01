'use client';

import { useModeStore } from '@/stores/modeStore';

interface Props {
  canvasMode?: boolean;
}

export function ModeToggle({ canvasMode }: Props) {
  const mode = useModeStore((s) => s.mode);
  const transitioning = useModeStore((s) => s.transitioning);
  const startTransition = useModeStore((s) => s.startTransition);

  const handleToggle = () => {
    if (transitioning) return;
    const target = mode === 'imagine' ? 'game' : 'imagine';
    startTransition(target);
  };

  const isImagine = mode === 'imagine';

  return (
    <button
      onClick={handleToggle}
      disabled={transitioning}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer ${
        canvasMode
          ? 'bg-imagine-terracotta text-white hover:bg-imagine-terracotta-hover'
          : 'bg-indigo-600 text-white hover:bg-indigo-500'
      } disabled:opacity-50`}
    >
      {isImagine ? 'Enter Game' : 'Imagine Mode'}
    </button>
  );
}
