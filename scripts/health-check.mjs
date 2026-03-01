import 'dotenv/config';
import pg from 'pg';
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

const results = [];

function ok(name, detail) {
  results.push({ name, status: 'OK', detail });
  console.info(`  ✓ ${name}: ${detail}`);
}

function fail(name, detail) {
  results.push({ name, status: 'FAIL', detail });
  console.error(`  ✗ ${name}: ${detail}`);
}

// --- 1. Check required env vars ---
console.info('\n[ENV VARS]');
const required = [
  'DATABASE_URL',
  'AI_GATEWAY_API_KEY',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
];
const optional = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
];

for (const key of required) {
  if (process.env[key]) {
    ok(key, 'set');
  } else {
    fail(key, 'MISSING (required)');
  }
}

for (const key of optional) {
  if (process.env[key]) {
    ok(key, 'set');
  } else {
    console.info(`  - ${key}: not set (optional)`);
  }
}

// --- 2. Database connection ---
console.info('\n[DATABASE]');
if (process.env.DATABASE_URL) {
  try {
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 10000,
      ssl: false,
    });
    const res = await pool.query('SELECT NOW() as time, current_database() as db');
    ok('Cloud SQL', `Connected to "${res.rows[0].db}" at ${res.rows[0].time}`);
    await pool.end();
  } catch (err) {
    fail('Cloud SQL', err.message);
  }
} else {
  fail('Cloud SQL', 'DATABASE_URL not set');
}

// --- 3. Vercel AI Gateway ---
console.info('\n[AI GATEWAY]');
const aiGatewayKey = process.env.AI_GATEWAY_API_KEY;

if (aiGatewayKey) {
  try {
    const gateway = createOpenAI({
      apiKey: aiGatewayKey,
      baseURL: 'https://ai-gateway.vercel.sh/v1',
    });

    const res = await generateText({
      model: gateway.chat('google/gemini-2.5-flash'),
      prompt: 'Say "ok" and nothing else.',
      maxTokens: 5,
    });

    ok('AI Gateway (Gemini)', `Response: "${res.text.trim()}"`);
  } catch (err) {
    fail('AI Gateway (Gemini)', err.message);
  }
} else {
  fail('AI Gateway', 'AI_GATEWAY_API_KEY not set');
}

// --- 4. Firebase ---
console.info('\n[FIREBASE]');

// 4a. Client config (env vars)
if (process.env.NEXT_PUBLIC_FIREBASE_API_KEY && process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
  ok('Firebase Client Config', `Project: ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}`);
} else {
  fail('Firebase Client Config', 'NEXT_PUBLIC_FIREBASE_API_KEY or PROJECT_ID not set');
}

// 4b. Admin SDK (actually initialize and list users to verify credentials)
const fbProjectId = process.env.FIREBASE_PROJECT_ID;
const fbClientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const fbPrivateKey = process.env.FIREBASE_PRIVATE_KEY;

if (fbProjectId && fbClientEmail && fbPrivateKey) {
  try {
    const { initializeApp, cert } = await import('firebase-admin/app');
    const { getAuth } = await import('firebase-admin/auth');

    initializeApp({
      credential: cert({
        projectId: fbProjectId,
        clientEmail: fbClientEmail,
        privateKey: fbPrivateKey.replace(/\\n/g, '\n'),
      }),
    });

    // listUsers with maxResults=1 is the cheapest call that proves credentials work
    const listResult = await getAuth().listUsers(1);
    ok('Firebase Admin SDK', `Initialized (${listResult.users.length} user(s) found)`);
  } catch (err) {
    fail('Firebase Admin SDK', err.message);
  }
} else {
  const missing = [
    !fbProjectId && 'FIREBASE_PROJECT_ID',
    !fbClientEmail && 'FIREBASE_CLIENT_EMAIL',
    !fbPrivateKey && 'FIREBASE_PRIVATE_KEY',
  ].filter(Boolean).join(', ');
  fail('Firebase Admin SDK', `Missing: ${missing}`);
}

// --- 5. WebSocket (production) ---
console.info('\n[WEBSOCKET]');
const wsUrl = process.env.NEXT_PUBLIC_WS_URL;

if (wsUrl) {
  try {
    const { default: WebSocket } = await import('ws');
    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { ws.close(); reject(new Error('Connection timed out (5s)')); }, 5000);
      ws.on('open', () => { clearTimeout(timeout); ws.close(); resolve(); });
      ws.on('error', (err) => { clearTimeout(timeout); reject(err); });
    });
    ok('WebSocket', `Connected to ${wsUrl}`);
  } catch (err) {
    fail('WebSocket', `${wsUrl} — ${err.message}`);
  }
} else {
  console.info('  - NEXT_PUBLIC_WS_URL: not set (skipping — set to test prod WebSocket)');
}

// --- Summary ---
const failed = results.filter((r) => r.status === 'FAIL');
console.info('\n' + '='.repeat(50));
if (failed.length === 0) {
  console.info('All systems operational!');
} else {
  console.info(`${failed.length} check(s) failed:`);
  for (const f of failed) {
    console.info(`  - ${f.name}: ${f.detail}`);
  }
}
console.info('='.repeat(50) + '\n');

process.exit(failed.length > 0 ? 1 : 0);
