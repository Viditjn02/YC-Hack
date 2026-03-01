/** One-time "Press V to switch view" hint — shows shortly after the player starts moving. */
'use client';

import { useEffect, useState, useRef } from 'react';

const SHOW_DELAY = 4000; // ms after mount before showing
const HINT_DURATION = 4000; // ms visible before auto-fade

export function ViewHint() {
  const [visible, setVisible] = useState(false);
  const shown = useRef(false);

  useEffect(() => {
    if (shown.current) return;
    shown.current = true;

    const showTimer = setTimeout(() => {
      setVisible(true);
      setTimeout(() => setVisible(false), HINT_DURATION);
    }, SHOW_DELAY);

    return () => clearTimeout(showTimer);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed top-28 left-1/2 -translate-x-1/2 z-50
        px-5 py-2.5 rounded-lg bg-black/60 backdrop-blur-sm border border-white/10
        text-white text-xs font-medium pointer-events-none"
      style={{
        animation: 'fadeIn 0.3s ease-out, fadeOut 0.5s ease-in 3.5s forwards',
      }}
    >
      Press{' '}
      <kbd className="px-1.5 py-0.5 mx-0.5 rounded bg-white/15 border border-white/20 text-[10px] font-mono">
        V
      </kbd>{' '}
      to switch to first-person view
    </div>
  );
}
