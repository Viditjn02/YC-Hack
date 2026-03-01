'use client';

import { useRef, useState, useCallback } from 'react';

const DEEPGRAM_WS_URL =
  'wss://api.deepgram.com/v1/listen?model=nova-3&language=en-US&interim_results=true&smart_format=true&punctuate=true';

interface UseVoiceInputReturn {
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string>;
  isRecording: boolean;
  transcript: string;
  error: string | null;
}

export function useVoiceInput(): UseVoiceInputReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const finalTranscriptRef = useRef('');
  const resolveStopRef = useRef<((transcript: string) => void) | null>(null);

  const startRecording = useCallback(async () => {
    setError(null);
    setTranscript('');
    finalTranscriptRef.current = '';

    try {
      // 1. Get short-lived token from server
      const tokenUrl = `${process.env.NEXT_PUBLIC_WS_URL?.replace('ws', 'http')}/api/deepgram/token`;
      console.log('[DEBUG-FIX] Fetching Deepgram token from:', tokenUrl);
      const tokenRes = await fetch(tokenUrl);
      console.log('[DEBUG-FIX] Token response status:', tokenRes.status);
      if (!tokenRes.ok) throw new Error('Failed to get Deepgram token');
      const tokenData = await tokenRes.json();
      const { access_token } = tokenData;
      console.log('[DEBUG-FIX] Got Deepgram token:', access_token ? `${access_token.substring(0, 10)}...` : 'EMPTY');

      // 2. Open Deepgram WebSocket with token subprotocol
      console.log('[DEBUG-FIX] Opening Deepgram WebSocket:', DEEPGRAM_WS_URL);
      const ws = new WebSocket(DEEPGRAM_WS_URL, ['token', access_token]);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('[DEBUG-FIX] Deepgram message:', data.type, data.is_final ? '(FINAL)' : '(interim)', data.channel?.alternatives?.[0]?.transcript);
        if (data.type === 'Results') {
          const alt = data.channel?.alternatives?.[0];
          if (!alt) return;
          if (data.is_final && alt.transcript) {
            finalTranscriptRef.current += (finalTranscriptRef.current ? ' ' : '') + alt.transcript;
            console.log('[DEBUG-FIX] Final transcript so far:', finalTranscriptRef.current);
            setTranscript(finalTranscriptRef.current);
          } else if (!data.is_final && alt.transcript) {
            // Show interim: final so far + current interim
            setTranscript(
              finalTranscriptRef.current +
                (finalTranscriptRef.current ? ' ' : '') +
                alt.transcript
            );
          }
        }
      };

      ws.onerror = (e) => {
        console.error('[DEBUG-FIX] Deepgram WebSocket error:', e);
        setError('Voice connection error');
      };

      ws.onclose = (e) => {
        console.log('[DEBUG-FIX] Deepgram WebSocket closed, code:', e.code, 'reason:', e.reason);
        console.log('[DEBUG-FIX] Final transcript at WS close:', finalTranscriptRef.current);
        // Resolve the stop promise with final transcript
        if (resolveStopRef.current) {
          console.log('[DEBUG-FIX] Resolving stop promise with:', finalTranscriptRef.current);
          resolveStopRef.current(finalTranscriptRef.current);
          resolveStopRef.current = null;
        }
      };

      // 3. Wait for WS to open, then start mic
      await new Promise<void>((resolve, reject) => {
        ws.onopen = () => {
          console.log('[DEBUG-FIX] Deepgram WebSocket OPEN');
          resolve();
        };
        ws.onerror = () => reject(new Error('WebSocket connection failed'));
      });

      console.log('[DEBUG-FIX] Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('[DEBUG-FIX] Microphone access granted, tracks:', stream.getAudioTracks().map(t => ({ label: t.label, enabled: t.enabled, readyState: t.readyState })));
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });
      recorderRef.current = recorder;

      let chunkCount = 0;
      recorder.ondataavailable = (e) => {
        chunkCount++;
        if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
          if (chunkCount <= 3 || chunkCount % 10 === 0) {
            console.log(`[DEBUG-FIX] Sending audio chunk #${chunkCount}, size: ${e.data.size} bytes, ws.readyState: ${ws.readyState}`);
          }
          ws.send(e.data);
        } else {
          console.warn(`[DEBUG-FIX] Skipping chunk #${chunkCount}: data.size=${e.data.size}, ws.readyState=${ws.readyState}`);
        }
      };

      recorder.start(250); // Send chunks every 250ms
      console.log('[DEBUG-FIX] MediaRecorder started (250ms intervals)');
      setIsRecording(true);
    } catch (err) {
      console.error('[DEBUG-FIX] startRecording ERROR:', err);
      setError(err instanceof Error ? err.message : 'Failed to start recording');
      setIsRecording(false);
    }
  }, []);

  const stopRecording = useCallback((): Promise<string> => {
    console.log('[DEBUG-FIX] stopRecording called');
    return new Promise((resolve) => {
      resolveStopRef.current = resolve;

      // Stop MediaRecorder
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        console.log('[DEBUG-FIX] Stopping MediaRecorder, state:', recorderRef.current.state);
        recorderRef.current.stop();
      } else {
        console.log('[DEBUG-FIX] MediaRecorder already inactive or null');
      }
      recorderRef.current = null;

      // Stop mic tracks
      if (streamRef.current) {
        console.log('[DEBUG-FIX] Stopping mic tracks');
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      streamRef.current = null;

      // Tell Deepgram to finalize and close
      const ws = wsRef.current;
      console.log('[DEBUG-FIX] Deepgram WS readyState:', ws?.readyState, '(OPEN=1, CLOSED=3)');
      if (ws && ws.readyState === WebSocket.OPEN) {
        console.log('[DEBUG-FIX] Sending CloseStream to Deepgram');
        ws.send(JSON.stringify({ type: 'CloseStream' }));
        // Give Deepgram a moment to send final results before closing
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            console.log('[DEBUG-FIX] Force-closing Deepgram WS after 500ms');
            ws.close();
          }
        }, 500);
      } else {
        // WS already closed, resolve immediately
        console.log('[DEBUG-FIX] WS already closed, resolving immediately with:', finalTranscriptRef.current);
        resolve(finalTranscriptRef.current);
        resolveStopRef.current = null;
      }

      setIsRecording(false);
    });
  }, []);

  return { startRecording, stopRecording, isRecording, transcript, error };
}
