'use client';

import { useVoiceStore } from '@/stores/voiceStore';

export function PushToTalkOverlay() {
  const isRecording = useVoiceStore((s) => s.isRecording);
  const transcript = useVoiceStore((s) => s.voiceTranscript);

  if (!isRecording) return null;

  return (
    <div
      className="fixed top-8 left-1/2 -translate-x-1/2 z-50
        px-6 py-4 rounded-xl bg-red-900/80 backdrop-blur-sm border border-red-500/30
        text-white text-sm font-medium pointer-events-none
        animate-[fadeIn_0.15s_ease-out]"
    >
      <div className="flex items-center gap-3 mb-2">
        <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
        <span className="text-red-200 text-xs uppercase tracking-wider">Recording</span>
        <span className="text-white/50 text-xs">Release T to send</span>
      </div>
      {transcript && (
        <p className="text-white/90 text-base max-w-md">{transcript}</p>
      )}
    </div>
  );
}
