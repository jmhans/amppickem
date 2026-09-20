'use client';

import { useState, useEffect, useTransition } from 'react';
import { updateMyParticipant, savePushSubscription, removePushSubscription } from '@/app/lib/actions';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

type PushStatus = 'checking' | 'unsupported' | 'subscribed' | 'unsubscribed' | 'denied';

export default function ParticipantSettings({
  participantId,
  initialName,
  initialEmail,
  initialNotificationsEnabled,
  initialNotificationChannel,
}: {
  participantId: number;
  initialName: string;
  initialEmail: string;
  initialNotificationsEnabled: boolean;
  initialNotificationChannel: string;
}) {
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [notificationsEnabled, setNotificationsEnabled] = useState(initialNotificationsEnabled);
  const [notificationChannel, setNotificationChannel] = useState<'email' | 'push'>(
    initialNotificationChannel === 'push' ? 'push' : 'email',
  );
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const [pushStatus, setPushStatus] = useState<PushStatus>('checking');
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [isIosNotStandalone, setIsIosNotStandalone] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as { standalone?: boolean }).standalone === true;
    setIsIosNotStandalone(isIos && !isStandalone);

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushStatus('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setPushStatus('denied');
      return;
    }
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => registration.pushManager.getSubscription())
      .then((sub) => setPushStatus(sub ? 'subscribed' : 'unsubscribed'))
      .catch(() => setPushStatus('unsubscribed'));
  }, []);

  function handleSave() {
    setMessage(null);
    startTransition(async () => {
      const result = await updateMyParticipant(participantId, { name, email, notificationsEnabled, notificationChannel });
      setMessage(result.success ? 'Saved.' : (result.error ?? 'Failed to save'));
    });
  }

  async function handleEnablePush() {
    setPushError(null);
    setPushBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setPushStatus('denied');
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        setPushError('Push notifications are not configured on this deployment yet.');
        return;
      }
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        // Uint8Array's ArrayBufferLike generic vs. BufferSource's stricter ArrayBuffer is a
        // lib.dom.d.ts/TS-version mismatch, not a real type error — cast through unknown.
        applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
      });
      const result = await savePushSubscription(participantId, subscription.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } });
      if (!result.success) {
        setPushError(result.error ?? 'Failed to save subscription');
        return;
      }
      setPushStatus('subscribed');
    } catch {
      setPushError('Could not enable push notifications — please try again.');
    } finally {
      setPushBusy(false);
    }
  }

  async function handleDisablePush() {
    setPushError(null);
    setPushBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await removePushSubscription(participantId, subscription.endpoint);
        await subscription.unsubscribe();
      }
      setPushStatus('unsubscribed');
    } catch {
      setPushError('Could not disable push notifications — please try again.');
    } finally {
      setPushBusy(false);
    }
  }

  return (
    <details className="mb-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <summary className="cursor-pointer select-none px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200">
        Entry Settings
      </summary>
      <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">Entry name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white px-2 py-1.5 text-sm"
            />
          </label>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
            <input
              type="checkbox"
              checked={notificationsEnabled}
              onChange={(e) => setNotificationsEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            Remind me when I still have picks left before games start
          </label>

          {notificationsEnabled && (
            <div className="mt-2 ml-6 space-y-2">
              <div className="flex gap-4 text-sm text-gray-700 dark:text-gray-200">
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="notificationChannel"
                    checked={notificationChannel === 'email'}
                    onChange={() => setNotificationChannel('email')}
                  />
                  Email
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="notificationChannel"
                    checked={notificationChannel === 'push'}
                    onChange={() => setNotificationChannel('push')}
                  />
                  Push notification
                </label>
              </div>

              {notificationChannel === 'push' && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {pushStatus === 'checking' ? null : pushStatus === 'unsupported' || isIosNotStandalone ? (
                    <p>
                      This browser doesn&apos;t support push. On iPhone: Share → Add to Home Screen, then open the
                      app from your home screen and try again from there.
                    </p>
                  ) : pushStatus === 'denied' ? (
                    <p>Notifications are blocked for this site — enable them in your browser/device settings.</p>
                  ) : pushStatus === 'subscribed' ? (
                    <div>
                      <p className="mb-1">Push is enabled on this device.</p>
                      <button
                        type="button"
                        onClick={handleDisablePush}
                        disabled={pushBusy}
                        className="rounded border border-gray-300 dark:border-gray-600 px-2 py-1 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                      >
                        Turn off on this device
                      </button>
                    </div>
                  ) : (
                    <div>
                      <p className="mb-1">If this fails, you&apos;ll still get emailed as a fallback.</p>
                      <button
                        type="button"
                        onClick={handleEnablePush}
                        disabled={pushBusy}
                        className="rounded bg-blue-600 hover:bg-blue-700 px-2 py-1 text-xs text-white disabled:opacity-50"
                      >
                        {pushBusy ? 'Enabling…' : 'Enable push on this device'}
                      </button>
                    </div>
                  )}
                  {pushError && <p className="mt-1 text-red-600">{pushError}</p>}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={isPending}
            className="rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-50 px-3 py-1.5 text-sm font-medium text-white transition-colors"
          >
            {isPending ? 'Saving…' : 'Save Settings'}
          </button>
          {message && <span className="text-sm text-gray-600 dark:text-gray-300">{message}</span>}
        </div>
      </div>
    </details>
  );
}
