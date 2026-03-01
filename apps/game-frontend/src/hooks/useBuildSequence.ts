'use client';

import { useEffect } from 'react';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const DELAY_BETWEEN_ZONES_MS = 2500;
const COMPLETION_BUFFER_MS = 1000;

/**
 * Orchestrates the timed construction sequence.
 * When buildQueue changes (workspace:build received), this hook
 * fires timed events to materialize zones one by one.
 */
export function useBuildSequence() {
  const buildQueue = useWorkspaceStore((s) => s.buildQueue);
  const phase = useWorkspaceStore((s) => s.phase);

  useEffect(() => {
    if (phase !== 'building' || buildQueue.length === 0) return;

    const timers: ReturnType<typeof setTimeout>[] = [];

    buildQueue.forEach((agentId, i) => {
      timers.push(
        setTimeout(() => {
          useWorkspaceStore.getState().markZoneBuilt(agentId);
        }, i * DELAY_BETWEEN_ZONES_MS),
      );
    });

    // Complete after all built + buffer
    timers.push(
      setTimeout(() => {
        useWorkspaceStore.getState().completeBuild();
      }, buildQueue.length * DELAY_BETWEEN_ZONES_MS + COMPLETION_BUFFER_MS),
    );

    return () => timers.forEach(clearTimeout);
  }, [buildQueue, phase]);
}
