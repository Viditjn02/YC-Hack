import { env } from '../env.js';
import { log } from '../logger.js';

interface TTSResult {
  audioBase64: string;
  mimeType: string;
}

interface MiniMaxResponse {
  data?: { audio?: string; status?: number };
  extra_info?: Record<string, unknown>;
  trace_id?: string;
  base_resp?: { status_code: number; status_msg: string };
}

export async function synthesizeSpeech(text: string, voiceId?: string): Promise<TTSResult | null> {
  const apiKey = env.MINIMAX_API_KEY;
  const effectiveVoiceId = voiceId ?? env.MINIMAX_TTS_VOICE_ID;

  if (!apiKey) {
    log.warn('[tts] MINIMAX_API_KEY not configured, skipping TTS');
    return null;
  }

  try {
    const res = await fetch('https://api.minimax.io/v1/t2a_v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.MINIMAX_TTS_MODEL,
        text,
        stream: false,
        language_boost: 'auto',
        output_format: 'hex',
        voice_setting: {
          voice_id: effectiveVoiceId,
          speed: 1,
          vol: 1,
          pitch: 0,
        },
        audio_setting: {
          sample_rate: 32000,
          bitrate: 128000,
          format: 'mp3',
          channel: 1,
        },
      }),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      log.error(`[tts] MiniMax TTS failed: ${res.status} ${res.statusText} body: ${errorBody}`);
      return null;
    }

    const data = (await res.json()) as MiniMaxResponse;

    if (data.base_resp && data.base_resp.status_code !== 0) {
      log.error(`[tts] MiniMax TTS error: ${data.base_resp.status_msg}`);
      return null;
    }

    const hexAudio = data.data?.audio;
    if (!hexAudio) {
      log.error('[tts] No audio in MiniMax response, keys:', data.data ? Object.keys(data.data) : 'null');
      return null;
    }

    const audioBase64 = Buffer.from(hexAudio, 'hex').toString('base64');
    log.info(`[tts] MiniMax TTS success, audio base64 length=${audioBase64.length}`);
    return { audioBase64, mimeType: 'audio/mpeg' };
  } catch (err) {
    log.error('[tts] MiniMax TTS synthesis error:', err);
    return null;
  }
}
