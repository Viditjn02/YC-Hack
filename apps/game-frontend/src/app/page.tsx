'use client';

import { useAuthStore } from '@/stores/authStore';
import { LoginPage } from '@/components/auth/LoginPage';
import { ModeRouter } from '@/components/ModeRouter';

export default function Home() {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);

  if (loading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-black">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return <ModeRouter user={user} />;
}
