import { env } from '../env.js';
import { log } from '../logger.js';

interface TTSResult {
  audioBase64: string;
  mimeType: string;
}

export async function synthesizeSpeech(text: string, voiceId?: string): Promise<TTSResult | null> {
  const apiKey = env.INWORLD_API_KEY;
  const effectiveVoiceId = voiceId ?? env.INWORLD_VOICE_ID;
  log.info(`[DEBUG-FIX] synthesizeSpeech called, text length=${text.length}, INWORLD_API_KEY=${apiKey ? 'SET' : 'NOT SET'}, voiceId=${effectiveVoiceId} (passed: ${voiceId ?? 'default'}), modelId=${env.INWORLD_TTS_MODEL_ID}`);
  if (!apiKey) {
    log.warn('[tts] INWORLD_API_KEY not configured, skipping TTS');
    return null;
  }

  try {
    log.info('[DEBUG-FIX] Calling Inworld TTS API...');
    const res = await fetch('https://api.inworld.ai/tts/v1/voice', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        voiceId: effectiveVoiceId,
        modelId: env.INWORLD_TTS_MODEL_ID,
        audioConfig: {
          audioEncoding: 'MP3',
        },
      }),
    });

    log.info(`[DEBUG-FIX] Inworld TTS response: ${res.status} ${res.statusText}`);
    if (!res.ok) {
      const errorBody = await res.text();
      log.error(`[tts] Inworld TTS failed: ${res.status} ${res.statusText} body: ${errorBody}`);
      return null;
    }

    const data = await res.json() as { audioContent?: string };
    if (!data.audioContent) {
      log.error('[DEBUG-FIX] No audioContent in Inworld response, keys:', Object.keys(data));
      return null;
    }

    log.info(`[DEBUG-FIX] TTS audioContent received, length=${data.audioContent.length}`);
    return { audioBase64: data.audioContent, mimeType: 'audio/mpeg' };
  } catch (err) {
    log.error('[DEBUG-FIX] TTS synthesis error:', err);
    return null;
  }
}
