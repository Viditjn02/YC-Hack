'use client';
import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';

export function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const signIn = useAuthStore((s) => s.signIn);

  const handleSignIn = async () => {
    setError(null);
    try {
      await signIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a1a] flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <h1 className="text-5xl font-bold text-white mb-2">BossBot</h1>
          <p className="text-indigo-300 text-lg">Agent-first 3D workspace</p>
        </div>

        <div className="space-y-4">
          <button
            onClick={handleSignIn}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 shadow-lg hover:shadow-indigo-500/50"
          >
            Sign in with Google
          </button>

          {error && (
            <div className="bg-red-900/20 border border-red-500 text-red-300 rounded-lg p-3 text-sm">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
