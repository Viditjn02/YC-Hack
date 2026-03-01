'use client';

import { useState, useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import { AVATARS } from '@/data/avatars';
import { MUSIC } from '@/data/gameConfig';
import { VOICE_OPTIONS } from '@bossroom/shared-types';
import { useSettingsStore } from '@/stores/settingsStore';
import { useMusicStore } from '@/stores/musicStore';
import { AvatarPreview } from './AvatarPreview';

export function GameToolbar() {
  const [activeTab, setActiveTab] = useState<'avatar' | 'music' | 'voice' | null>(null);

  // Settings store
  const avatarPreference = useSettingsStore((state) => state.avatarPreference);
  const selectAvatar = useSettingsStore((state) => state.selectAvatar);
  const voiceId = useSettingsStore((state) => state.voiceId);
  const selectVoice = useSettingsStore((state) => state.selectVoice);

  // Music store
  const trackId = useMusicStore((state) => state.trackId);
  const volume = useMusicStore((state) => state.volume);
  const isPlaying = useMusicStore((state) => state.isPlaying);
  const setTrack = useMusicStore((state) => state.setTrack);
  const setVolume = useMusicStore((state) => state.setVolume);
  const togglePlay = useMusicStore((state) => state.togglePlay);

  // Preload avatar models
  useEffect(() => {
    AVATARS.forEach((avatar) => {
      if (avatar.id !== 'random') {
        useGLTF.preload(avatar.modelUrl);
      }
    });
  }, []);

  // Close popover on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeTab) {
        setActiveTab(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab]);

  return (
    <>
      {/* Backdrop for click-outside-to-close */}
      {activeTab && (
        <div className="fixed inset-0 z-30" onClick={() => setActiveTab(null)} />
      )}

      {/* Popover panel */}
      {activeTab && (
        <div className="fixed bottom-16 left-4 z-40 bg-black/80 backdrop-blur-md rounded-xl border border-white/10 p-4 w-72 pointer-events-auto">
          {activeTab === 'avatar' && (
            <div>
              <h3 className="text-white font-semibold mb-3">Choose Avatar</h3>
              <div className="grid grid-cols-4 gap-2">
                {AVATARS.map((avatar) => (
                  <button
                    key={avatar.id}
                    onClick={() => selectAvatar(avatar.id)}
                    className={`
                      flex flex-col items-center justify-center p-1.5 rounded-lg
                      transition-all cursor-pointer
                      ${
                        avatarPreference === avatar.id
                          ? 'bg-indigo-500/30 ring-2 ring-indigo-400'
                          : 'bg-white/5 hover:bg-white/10'
                      }
                    `}
                  >
                    {avatar.id === 'random' ? (
                      <div className="w-[52px] h-[52px] flex items-center justify-center">
                        <span className="text-2xl">🎲</span>
                      </div>
                    ) : (
                      <AvatarPreview url={avatar.modelUrl} size={52} />
                    )}
                    <span className="text-[10px] text-white/70 text-center leading-tight mt-0.5">
                      {avatar.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'music' && (
            <div>
              <h3 className="text-white font-semibold mb-3">Background Music</h3>

              {/* Play/Pause Toggle */}
              <button
                onClick={togglePlay}
                className="w-full mb-3 px-4 py-2 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/30 text-white transition-all"
              >
                {isPlaying ? '⏸ Pause Music' : '▶ Play Music'}
              </button>

              {/* Track Selector */}
              <div className="mb-3">
                <label className="text-white/60 text-sm mb-2 block">Track</label>
                <div className="grid grid-cols-2 gap-2">
                  {MUSIC.tracks.map((track) => (
                    <button
                      key={track.id}
                      onClick={() => setTrack(track.id)}
                      className={`
                        px-3 py-2 rounded-lg text-sm transition-all
                        ${
                          trackId === track.id
                            ? 'bg-indigo-500/30 ring-2 ring-indigo-400 text-white'
                            : 'bg-white/5 hover:bg-white/10 text-white/70'
                        }
                      `}
                    >
                      {track.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Volume Slider */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-white/50">Vol</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className="flex-1 accent-indigo-400"
                />
                <span className="text-[10px] text-white/50 w-8 text-right">
                  {volume}%
                </span>
              </div>
            </div>
          )}

          {activeTab === 'voice' && (
            <div>
              <h3 className="text-white font-semibold mb-3">Voice Selection</h3>
              <div className="grid grid-cols-2 gap-2">
                {VOICE_OPTIONS.map((voice) => (
                  <button
                    key={voice}
                    onClick={() => selectVoice(voice)}
                    className={`
                      flex flex-col items-center justify-center p-3 rounded-lg
                      transition-all cursor-pointer
                      ${
                        voiceId === voice
                          ? 'bg-indigo-500/30 ring-2 ring-indigo-400'
                          : 'bg-white/5 hover:bg-white/10'
                      }
                    `}
                  >
                    <span className="text-2xl mb-1">🎤</span>
                    <span className="text-sm text-white/70">{voice}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Toolbar button row */}
      <div className="fixed bottom-4 left-4 z-40 pointer-events-auto flex gap-2">
        {/* Avatar Button */}
        <button
          onClick={() => setActiveTab(activeTab === 'avatar' ? null : 'avatar')}
          className={`
            bg-black/50 backdrop-blur-sm rounded-full p-2 transition-all cursor-pointer
            ${
              activeTab === 'avatar'
                ? 'opacity-100 ring-2 ring-indigo-400 hover:bg-black/70'
                : 'opacity-70 hover:opacity-100 hover:bg-black/70'
            }
          `}
          title="Avatar"
        >
          <svg
            className="w-6 h-6 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        </button>

        {/* Music Button */}
        <button
          onClick={() => setActiveTab(activeTab === 'music' ? null : 'music')}
          className={`
            bg-black/50 backdrop-blur-sm rounded-full p-2 transition-all cursor-pointer
            ${
              activeTab === 'music'
                ? 'opacity-100 ring-2 ring-indigo-400 hover:bg-black/70'
                : 'opacity-70 hover:opacity-100 hover:bg-black/70'
            }
          `}
          title="Music"
        >
          <svg
            className="w-6 h-6 text-white"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
          </svg>
        </button>

        {/* Voice Button */}
        <button
          onClick={() => setActiveTab(activeTab === 'voice' ? null : 'voice')}
          className={`
            bg-black/50 backdrop-blur-sm rounded-full p-2 transition-all cursor-pointer
            ${
              activeTab === 'voice'
                ? 'opacity-100 ring-2 ring-indigo-400 hover:bg-black/70'
                : 'opacity-70 hover:opacity-100 hover:bg-black/70'
            }
          `}
          title="Voice"
        >
          <svg
            className="w-6 h-6 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
            />
          </svg>
        </button>
      </div>
    </>
  );
}
