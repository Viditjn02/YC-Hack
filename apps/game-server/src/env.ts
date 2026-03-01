import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  DATABASE_URL: z.string().min(1),
  LOG_LEVEL: z.enum(['ERROR', 'WARN', 'INFO', 'DEBUG']).default('DEBUG'),
  ALLOWED_ORIGIN: z.string().default('*'),

  // Firebase Admin
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_CLIENT_EMAIL: z.string().min(1),
  FIREBASE_PRIVATE_KEY: z.string().min(1),

  // Vercel AI Gateway
  AI_GATEWAY_API_KEY: z.string().min(1),

  // Optional: Composio for agent tools
  COMPOSIO_API_KEY: z.string().optional(),

  // Voice: Deepgram STT (server-only token minting)
  DEEPGRAM_API_KEY: z.string().optional(),

  // Voice: Inworld TTS
  INWORLD_API_KEY: z.string().optional(),
  INWORLD_VOICE_ID: z.string().default('Dominus'),
  INWORLD_TTS_MODEL_ID: z.string().default('inworld-tts-1.5-mini'),

  // Google AI
  GOOGLE_AI_API_KEY: z.string().optional(),

  // Browser-use Cloud API
  BROWSER_USE_API_KEY: z.string().optional(),

  // Supermemory — agent long-term memory
  SUPERMEMORY_API_KEY: z.string().optional(),

  // Retell AI — agent phone calling
  RETELL_API_KEY: z.string().optional(),
  RETELL_AGENT_ID: z.string().optional(),
  RETELL_FROM_NUMBER: z.string().optional(),

  // Visa Intelligent Commerce (VIC) MCP
  VISA_VIC_API_KEY: z.string().optional(),
  VISA_VIC_API_KEY_SS: z.string().optional(),
  VISA_EXTERNAL_CLIENT_ID: z.string().optional(),
  VISA_EXTERNAL_APP_ID: z.string().optional(),
  VISA_MCP_BASE_URL: z.string().default('https://sandbox.mcp.visa.com'),
});

export type Env = z.infer<typeof envSchema>;

// Parse once at startup — crash with clear error if invalid
export const env = envSchema.parse(process.env);
