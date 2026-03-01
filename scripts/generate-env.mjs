import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

try {
  const raw = execSync('terraform output -json', {
    cwd: join(root, 'terraform'),
    encoding: 'utf-8',
  });
  const outputs = JSON.parse(raw);

  // Frontend .env.production
  const cloudRunUrl = outputs.cloud_run_url?.value || '';
  const firebaseConfig = outputs.firebase_config?.value || {};

  const frontendEnv = [
    `NEXT_PUBLIC_BACKEND_URL=${cloudRunUrl}`,
    `NEXT_PUBLIC_WS_URL=${cloudRunUrl.replace('https://', 'wss://')}`,
    `NEXT_PUBLIC_FIREBASE_API_KEY=${firebaseConfig.apiKey || ''}`,
    `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${firebaseConfig.authDomain || ''}`,
    `NEXT_PUBLIC_FIREBASE_PROJECT_ID=${firebaseConfig.projectId || ''}`,
    `NEXT_PUBLIC_FIREBASE_APP_ID=${firebaseConfig.appId || ''}`,
  ].join('\n');

  writeFileSync(join(root, 'apps', 'game-frontend', '.env.production'), frontendEnv);
  console.info('Wrote apps/game-frontend/.env.production');

  // Server .env.production
  const dbConnString = outputs.cloud_sql_connection_string?.value || '';
  const adminCreds = outputs.firebase_admin_credentials?.value || {};

  const serverEnv = [
    `DATABASE_URL=${dbConnString}`,
    `FIREBASE_PROJECT_ID=${adminCreds.projectId || firebaseConfig.projectId || ''}`,
    `FIREBASE_CLIENT_EMAIL=${adminCreds.clientEmail || ''}`,
    `FIREBASE_PRIVATE_KEY=${JSON.stringify(adminCreds.privateKey || '')}`,
    `PORT=8080`,
  ].join('\n');

  writeFileSync(join(root, 'apps', 'game-server', '.env.production'), serverEnv);
  console.info('Wrote apps/game-server/.env.production');
} catch (err) {
  console.error('Failed to generate env files. Is Terraform initialized?');
  console.error(err.message);
  process.exit(1);
}
