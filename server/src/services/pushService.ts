import { Types } from 'mongoose';
import { DeviceToken } from '../models/DeviceToken';

// Firebase Cloud Messaging. Set FIREBASE_SERVICE_ACCOUNT to the service-account JSON (plain JSON or base64).
// Without it, push is simply switched off and everything else keeps working.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let messagingPromise: Promise<any | null> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getMessaging(): Promise<any | null> {
  if (!messagingPromise) {
    messagingPromise = (async () => {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
      if (!raw) return null;
      try {
        const json = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
        const admin = await import('firebase-admin');
        const app = admin.apps.length ? admin.app() : admin.initializeApp({ credential: admin.credential.cert(JSON.parse(json)) });
        return admin.messaging(app);
      } catch (err) {
        console.error('[push] Firebase could not start:', (err as Error).message);
        return null;
      }
    })();
  }
  return messagingPromise;
}

export interface PushPayload {
  title: string;
  body: string;
  /** Extra values the app uses to open the right screen when the alert is tapped (strings only). */
  data?: Record<string, string>;
}

const DEAD_TOKEN_CODES = ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token', 'messaging/invalid-argument'];

export async function sendPushToUser(userId: Types.ObjectId | string, payload: PushPayload): Promise<void> {
  const messaging = await getMessaging();
  if (!messaging) return;
  const devices = await DeviceToken.find({ user: userId }).select('token');
  if (!devices.length) return;
  const tokens = devices.map((d) => d.token);

  const result = await messaging.sendEachForMulticast({
    tokens,
    notification: { title: payload.title, body: payload.body },
    data: payload.data || {},
    android: { priority: 'high', notification: { channelId: 'updates' } }
  });

  // Forget phones that uninstalled the app or whose token expired.
  const dead: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result.responses.forEach((r: any, i: number) => {
    if (!r.success && DEAD_TOKEN_CODES.includes(r.error?.code)) dead.push(tokens[i]);
  });
  if (dead.length) await DeviceToken.deleteMany({ token: { $in: dead } });
}
