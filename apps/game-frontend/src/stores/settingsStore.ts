import { create } from 'zustand';
import { RANDOM_AVATAR_ID, randomAvatarId } from '@bossroom/shared-types';
import { gameSocket } from '@/lib/websocket';

export type PurchaseMode = 'approval' | 'autonomous';

interface SettingsState {
  /** The user's preference — may be 'random' */
  avatarPreference: string;
  /** The resolved avatar actually being rendered this session */
  avatarId: string;
  /** TTS voice preset */
  voiceId: string;

  /** Shopping: purchase mode (approval = confirm first, autonomous = buy within budget) */
  purchaseMode: PurchaseMode;
  /** Shopping: max per-purchase budget in autonomous mode (USD) */
  purchaseBudget: number;

  /** Called when server sends the player's saved setting + resolved avatar */
  setAvatarFromServer: (preference: string, resolvedAvatarId: string) => void;
  selectAvatar: (id: string) => void;
  /** Hydrate voice from server on join */
  setVoiceFromServer: (voiceId: string) => void;
  selectVoice: (id: string) => void;
  setPurchaseMode: (mode: PurchaseMode) => void;
  setPurchaseBudget: (amount: number) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  avatarPreference: RANDOM_AVATAR_ID,
  avatarId: randomAvatarId(),
  voiceId: 'Dominus',
  purchaseMode: 'approval',
  purchaseBudget: 100,

  setAvatarFromServer: (preference, resolvedAvatarId) => set({
    avatarPreference: preference,
    avatarId: resolvedAvatarId,
  }),

  selectAvatar: (id) => {
    const resolved = id === RANDOM_AVATAR_ID ? randomAvatarId() : id;
    set({ avatarPreference: id, avatarId: resolved });
    gameSocket.send({ type: 'player:updateSettings', payload: { avatarId: id } });
  },

  setVoiceFromServer: (voiceId) => set({ voiceId }),

  selectVoice: (id) => {
    set({ voiceId: id });
    gameSocket.send({ type: 'player:updateSettings', payload: { voiceId: id } });
  },

  setPurchaseMode: (mode) => set({ purchaseMode: mode }),

  setPurchaseBudget: (amount) => set({ purchaseBudget: Math.max(0, amount) }),
}));
