'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { refreshResults } from '@/app/lib/actions';

export default function RefreshResultsButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleClick() {
    setBusy(true);
    setMessage(null);
    const result = await refreshResults();
    setBusy(false);

    if (!result.success) {
      setMessage(result.error ?? 'Failed to refresh');
      return;
    }
    setMessage(result.changed > 0 ? `Updated ${result.changed} pick${result.changed === 1 ? '' : 's'}.` : 'Already up to date.');
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-600 px-2.5 py-1 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
        </svg>
        {busy ? 'Refreshing…' : 'Refresh Results'}
      </button>
      {message && <span className="text-xs text-gray-500 dark:text-gray-400">{message}</span>}
    </div>
  );
}
