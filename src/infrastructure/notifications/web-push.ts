import webpush from 'web-push';
import { getServerEnv } from '@/src/infrastructure/env/server';
import type { NotificationKind } from '@/src/domain/notifications/policy';
export type PushDelivery = { endpoint: string; p256dh: string; auth: string };
export class PushEndpointError extends Error {}
export function assertPushEndpoint(value: string): string {
  if (value.length > 2048) throw new PushEndpointError('Subscription endpoint is too long.');
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new PushEndpointError('Subscription endpoint URL is invalid.');
  }
  if (url.protocol !== 'https:' || url.port || url.username || url.password || url.hash)
    throw new PushEndpointError('A secure public push service is required.');
  const host = url.hostname.toLowerCase();
  const allowed =
    host === 'fcm.googleapis.com' ||
    host === 'fcm-xm.googleapis.com' ||
    host === 'updates.push.services.mozilla.com' ||
    host === 'web.push.apple.com' ||
    (host.endsWith('.push.apple.com') && host.length < 100) ||
    (host.endsWith('.notify.windows.com') && host.length < 100);
  if (!allowed) throw new PushEndpointError('Unsupported push provider.');
  return url.href;
}
export async function sendPush(input: {
  subscription: PushDelivery;
  kind: NotificationKind;
  targetPath: string;
}): Promise<void> {
  const env = getServerEnv();
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT || !publicKey)
    throw new Error('Web Push VAPID configuration is incomplete.');
  webpush.setVapidDetails(env.VAPID_SUBJECT, publicKey, env.VAPID_PRIVATE_KEY);
  const arabic=input.targetPath.startsWith('/ar/');
  const title=arabic
    ?input.kind==='ACTIVITY_REMINDER'?'تذكير لطيف من لايف أو إس':
      input.kind==='GRADUATED_MONITORING'?'متابعة أسرية':'مراجعة أسرية متاحة'
    :input.kind==='ACTIVITY_REMINDER'?'A gentle Life OS reminder':
      input.kind==='GRADUATED_MONITORING'?'A family check-in':'Family review available';
  await webpush.sendNotification(
    {
      endpoint: assertPushEndpoint(input.subscription.endpoint),
      keys: { p256dh: input.subscription.p256dh, auth: input.subscription.auth },
    },
    JSON.stringify({
      title,
      body:arabic?'افتح التطبيق في الوقت المناسب لأسرتك.':'Open Life OS when it suits your family.',
      path: input.targetPath,
    }),
    { TTL: 900, urgency: 'normal' },
  );
}
