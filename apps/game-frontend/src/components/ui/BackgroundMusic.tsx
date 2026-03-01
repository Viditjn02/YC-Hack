'use client';

import { useEffect, useRef } from 'react';
import { useMusicStore } from '@/stores/musicStore';
import { MUSIC } from '@/data/gameConfig';

export function BackgroundMusic() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const trackId = useMusicStore((s) => s.trackId);
  const volume = useMusicStore((s) => s.volume);
  const isPlaying = useMusicStore((s) => s.isPlaying);

  // Create audio element once
  useEffect(() => {
    const audio = new Audio();
    audio.loop = true;
    audioRef.current = audio;
    return () => {
      audio.pause();
      audio.src = '';
    };
  }, []);

  // Update source when track changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const track = MUSIC.tracks.find((t) => t.id === trackId);
    if (!track) return;
    audio.src = track.url;
    audio.load();
    if (useMusicStore.getState().isPlaying) {
      audio.play().catch(() => {});
    }
  }, [trackId]);

  // Update volume
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume / 100;
  }, [volume]);

  // Play/pause with autoplay retry
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.play().catch(() => {
        const retry = () => {
          audio.play().catch(() => {});
          document.removeEventListener('click', retry);
          document.removeEventListener('keydown', retry);
        };
        document.addEventListener('click', retry);
        document.addEventListener('keydown', retry);
      });
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  return null;
}
