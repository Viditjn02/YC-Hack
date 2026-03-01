'use client';
import { create } from 'zustand';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase';
import { getQueryClient } from '@/app/get-query-client';

interface AuthUser {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  getToken: () => Promise<string>;
}

// Module-level subscription — runs once when this module is first imported (client-side only)
let _subscribed = false;

export const useAuthStore = create<AuthState>((set) => {
  if (typeof window !== 'undefined' && !_subscribed) {
    _subscribed = true;
    onAuthStateChanged(firebaseAuth, (fbUser) => {
      if (fbUser) {
        set({
          user: {
            uid: fbUser.uid,
            email: fbUser.email!,
            displayName: fbUser.displayName,
            photoURL: fbUser.photoURL,
          },
          loading: false,
        });
      } else {
        set({ user: null, loading: false });
      }
    });
  }

  return {
    user: null,
    loading: true,

    signIn: async () => {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(firebaseAuth, provider);
    },

    signOut: async () => {
      await fbSignOut(firebaseAuth);
      getQueryClient().removeQueries();
    },

    getToken: async () => {
      const user = firebaseAuth.currentUser;
      if (!user) throw new Error('Not authenticated');
      return user.getIdToken();
    },
  };
});
