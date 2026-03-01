/** GTA-style onboarding: bottom text box + step-by-step tutorial with navigation buttons. */
'use client';

import { useOnboardingStore } from '@/stores/onboardingStore';
import { useWorldStore } from '@/stores/worldStore';
import { useChatStore } from '@/stores/chatStore';
import { useOnboardingSteps } from '@/hooks/useOnboardingSteps';

const STEPS = [
  {
    text: 'Welcome to BossBot! Use WASD to walk around your virtual office.',
    hint: 'Try moving around',
  },
  {
    text: 'Walk up to an agent to discover what they can do.',
    hint: 'Approach the nearest glowing character',
  },
  {
    text: 'Press E or click on an agent to start a conversation.',
    hint: 'Interact with an agent',
  },
  {
    text: 'Type a task or click a suggestion to delegate real work.',
    hint: 'Send your first message',
  },
  {
    text: 'Explore the office to find more agents! Each one has unique skills.',
    hint: "You're all set!",
  },
];

export function OnboardingOverlay() {
  const step = useOnboardingStore((s) => s.onboardingStep);
  const complete = useOnboardingStore((s) => s.onboardingComplete);
  const advance = useOnboardingStore((s) => s.advanceOnboarding);
  const finish = useOnboardingStore((s) => s.completeOnboarding);
  const setStep = useOnboardingStore((s) => s.setOnboardingStep);
  const nearestAgent = useWorldStore((s) => s.nearestAgent);
  const chatPanelOpen = useChatStore((s) => s.chatPanelOpen);
  const chatMessages = useChatStore((s) => s.chatMessages);

  useOnboardingSteps({
    step: complete ? -1 : step,
    nearestAgent,
    chatPanelOpen,
    chatMessages,
    advance,
    complete: finish,
  });

  if (complete || step >= STEPS.length) return null;

  const current = STEPS[step];
  const isLastStep = step === STEPS.length - 1;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
      <div
        className="bg-black/80 backdrop-blur-md border border-white/10 rounded-2xl
          px-8 py-4 max-w-lg text-center animate-[fadeIn_0.4s_ease-out]"
      >
        <p className="text-white text-sm font-medium">{current.text}</p>
        <p className="text-white/40 text-xs mt-1.5">{current.hint}</p>

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 mt-3">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                i <= step ? 'bg-indigo-400' : 'bg-white/20'
              }`}
            />
          ))}
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-center gap-3 mt-3 pointer-events-auto">
          {step > 0 && (
            <button
              onClick={() => setStep(step - 1)}
              className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20
                text-white/60 hover:text-white text-xs transition-colors"
            >
              ← Back
            </button>
          )}
          {isLastStep ? (
            <button
              onClick={finish}
              className="px-4 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500
                text-white text-xs font-medium transition-colors"
            >
              Got it!
            </button>
          ) : (
            <button
              onClick={advance}
              className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20
                text-white/60 hover:text-white text-xs transition-colors"
            >
              Next →
            </button>
          )}
        </div>

        {/* Skip button */}
        <button
          onClick={finish}
          className="pointer-events-auto mt-2 text-[10px] text-white/30 hover:text-white/60 transition-colors"
        >
          Skip tutorial
        </button>
      </div>
    </div>
  );
}
