/** One-time "Press F to punch" hint — shows briefly when the player first approaches an agent. */
'use client';

import { useEffect, useState, useRef } from 'react';
import { useWorldStore } from '@/stores/worldStore';

const HINT_DURATION = 3000; // ms before auto-fade

export function PunchHint() {
  const nearestAgent = useWorldStore((s) => s.nearestAgent);
  const [visible, setVisible] = useState(false);
  const shown = useRef(false);

  useEffect(() => {
    // Show exactly once: the first time the player gets near any agent
    if (nearestAgent && !shown.current) {
      shown.current = true;
      setVisible(true);
      setTimeout(() => setVisible(false), HINT_DURATION);
    }
  }, [nearestAgent]);

  if (!visible) return null;

  return (
    <div
      className="fixed top-20 left-1/2 -translate-x-1/2 z-50
        px-5 py-2.5 rounded-lg bg-black/60 backdrop-blur-sm border border-white/10
        text-white text-xs font-medium pointer-events-none
        animate-[fadeIn_0.3s_ease-out]"
      style={{
        animation: visible
          ? 'fadeIn 0.3s ease-out, fadeOut 0.5s ease-in 2.5s forwards'
          : undefined,
      }}
    >
      Press{' '}
      <kbd className="px-1.5 py-0.5 mx-0.5 rounded bg-white/15 border border-white/20 text-[10px] font-mono">
        F
      </kbd>{' '}
      to punch nearby agents
    </div>
  );
}
