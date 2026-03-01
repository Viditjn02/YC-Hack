import { useEffect } from 'react';
import { TIMEOUTS } from '@bossroom/shared-utils';
import type { ChatMessage } from '@/stores/chatStore';

interface OnboardingParams {
  step: number;
  nearestAgent: string | null;
  chatPanelOpen: boolean;
  chatMessages: Record<string, ChatMessage[]>;
  advance: () => void;
  complete: () => void;
}

export function useOnboardingSteps({
  step,
  nearestAgent,
  chatPanelOpen,
  chatMessages,
  advance,
  complete,
}: OnboardingParams) {
  // Step 0 -> 1: auto-advance after intro delay
  useEffect(() => {
    if (step !== 0) return;
    const t = setTimeout(() => advance(), TIMEOUTS.ONBOARDING_INTRO_MS);
    return () => clearTimeout(t);
  }, [step, advance]);

  // Step 1 -> 2: when player is near an agent
  useEffect(() => {
    if (step === 1 && nearestAgent) advance();
  }, [step, nearestAgent, advance]);

  // Step 2 -> 3: when chat panel opens
  useEffect(() => {
    if (step === 2 && chatPanelOpen) advance();
  }, [step, chatPanelOpen, advance]);

  // Step 3 -> 4: when a message is sent
  useEffect(() => {
    const hasMessages = Object.values(chatMessages).some((m) => m.length > 0);
    if (step === 3 && hasMessages) advance();
  }, [step, chatMessages, advance]);

  // Step 4 -> done: auto-complete after delay
  useEffect(() => {
    if (step !== 4) return;
    const t = setTimeout(() => complete(), TIMEOUTS.ONBOARDING_COMPLETE_MS);
    return () => clearTimeout(t);
  }, [step, complete]);
}
