'use client';

import { useEffect, useRef } from 'react';
import { useVoiceStore } from '@/stores/voiceStore';
import { SPATIAL_AUDIO } from '@/data/gameConfig';
import { getAudioContext, setActivePanner, setActiveSource } from '@/lib/spatialAudio';

export function TTSAudioPlayer() {
  const queue = useVoiceStore((s) => s.ttsQueue);
  const dequeue = useVoiceStore((s) => s.dequeueTTS);
  const playingRef = useRef(false);

  useEffect(() => {
    if (playingRef.current || queue.length === 0) return;

    const item = queue[0];
    playingRef.current = true;

    const ctx = getAudioContext();
    const byteChars = atob(item.audioBase64);
    const bytes = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);

    ctx.decodeAudioData(bytes.buffer.slice(0) as ArrayBuffer)
      .then((audioBuffer) => {
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;

        const panner = ctx.createPanner();
        panner.panningModel = 'HRTF';
        panner.distanceModel = 'linear';
        panner.refDistance = SPATIAL_AUDIO.refDistance;
        panner.maxDistance = SPATIAL_AUDIO.maxDistance;
        panner.rolloffFactor = SPATIAL_AUDIO.rolloffFactor;

        source.connect(panner);
        panner.connect(ctx.destination);
        setActivePanner(panner, item.agentId);
        setActiveSource(source);

        source.onended = () => {
          setActiveSource(null);
          setActivePanner(null, null);
          useVoiceStore.getState().setTTSPlaying(false);
          playingRef.current = false;
          dequeue();
        };

        source.start();
        useVoiceStore.getState().setTTSPlaying(true);
      })
      .catch((err) => {
        console.error('[TTS] decodeAudioData failed:', err);
        setActiveSource(null);
        setActivePanner(null, null);
        useVoiceStore.getState().setTTSPlaying(false);
        playingRef.current = false;
        dequeue();
      });
  }, [queue, dequeue]);

  return null;
}
