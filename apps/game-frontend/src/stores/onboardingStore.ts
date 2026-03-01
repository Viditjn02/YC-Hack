import { create } from 'zustand';

interface OnboardingState {
  onboardingStep: number;
  onboardingComplete: boolean;
  advanceOnboarding: () => void;
  setOnboardingStep: (step: number) => void;
  completeOnboarding: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  onboardingStep: 0,
  onboardingComplete:
    typeof window !== 'undefined'
      ? localStorage.getItem('bossroom-onboarding') === 'done'
      : false,

  advanceOnboarding: () =>
    set((state) => ({ onboardingStep: state.onboardingStep + 1 })),

  setOnboardingStep: (step) => set({ onboardingStep: step }),

  completeOnboarding: () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('bossroom-onboarding', 'done');
    }
    set({ onboardingComplete: true });
  },
}));
