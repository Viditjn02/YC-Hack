import { initializeApp, cert, type ServiceAccount } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { env } from '../env.js';
import { log } from '../logger.js';

const serviceAccount: ServiceAccount = {
  projectId: env.FIREBASE_PROJECT_ID,
  clientEmail: env.FIREBASE_CLIENT_EMAIL,
  privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
};

initializeApp({ credential: cert(serviceAccount) });
log.info('Firebase Admin SDK initialized');

export async function verifyToken(token: string) {
  const decoded = await getAuth().verifyIdToken(token);
  return {
    uid: decoded.uid,
    email: decoded.email ?? '',
    displayName: decoded.name ?? null,
    photoURL: decoded.picture ?? null,
  };
}
