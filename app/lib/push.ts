import webpush from 'web-push';
import { db } from '@/app/lib/db';
import { pushSubscriptions } from '@/app/lib/db/schema';
import { eq } from 'drizzle-orm';

let configured = false;

function ensureConfigured(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return false;

  if (!configured) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  }
  return true;
}

/**
 * Sends a push notification to every subscribed browser/device for one participant.
 * Best-effort — no subscriptions, missing VAPID config, or a send failure should never throw
 * and block whatever triggered it (a reminder cron run, etc.). A 404/410 response means the
 * browser unsubscribed or the subscription expired — that row gets cleaned up automatically.
 */
export async function sendPushToParticipant(
  participantId: number,
  payload: { title: string; body: string; url?: string },
): Promise<{ sent: number; failed: number }> {
  if (!ensureConfigured()) {
    console.warn('Push not sent — NEXT_PUBLIC_VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT not configured.');
    return { sent: 0, failed: 0 };
  }

  const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.participantId, participantId));

  let sent = 0;
  let failed = 0;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
        );
        sent += 1;
      } catch (error) {
        failed += 1;
        const statusCode = (error as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
        } else {
          console.error('Push send failed:', error);
        }
      }
    }),
  );

  return { sent, failed };
}
