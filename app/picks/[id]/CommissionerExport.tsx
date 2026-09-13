'use client';

import { useState } from 'react';

export default function CommissionerExport({ participantId, week }: { participantId: number; week: number }) {
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  async function handleEmail() {
    setSending(true);
    setStatus(null);
    try {
      const res = await fetch('/api/picks/email-commissioner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId, week }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to send');
      setStatus({ type: 'success', message: 'Emailed to the commissioner.' });
    } catch (err) {
      setStatus({ type: 'error', message: err instanceof Error ? err.message : 'Failed to send' });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <a
        href={`/api/picks/export?participantId=${participantId}&week=${week}`}
        className="rounded-lg border border-gray-300 dark:border-gray-600 px-2.5 py-1 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        Download xlsx
      </a>
      <button
        onClick={handleEmail}
        disabled={sending}
        className="rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-50 px-2.5 py-1 text-xs text-white transition-colors"
      >
        {sending ? 'Sending…' : 'Email to Commissioner'}
      </button>
      {status && (
        <span className={`text-xs ${status.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
          {status.message}
        </span>
      )}
    </div>
  );
}
