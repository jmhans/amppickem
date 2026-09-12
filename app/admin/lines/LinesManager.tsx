'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type Game = {
  id: number;
  homeTeam: string;
  awayTeam: string;
  spread: number | null;
  overUnder: number | null;
  homeScore: number | null;
  awayScore: number | null;
  status: string | null;
  isFinal: boolean;
  linesLockedAt: string | null;
  gameTime: string | null;
};

export default function LinesManager({ weeks, initialWeek }: { weeks: number[]; initialWeek: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const week = Number(searchParams.get('week')) || initialWeek;

  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [edits, setEdits] = useState<Record<number, { spread: string; overUnder: string }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/lines?week=${week}`);
    const data = await res.json();
    setGames(data.games ?? []);
    setEdits({});
    setLoading(false);
  }, [week]);

  useEffect(() => {
    load();
  }, [load]);

  function handleWeekChange(newWeek: number) {
    router.push(`/admin/lines?week=${newWeek}`);
  }

  function handleSync() {
    setMessage(null);
    startTransition(async () => {
      const res = await fetch('/api/admin/sync-games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage(
          `Synced: ${data.sync.inserted} new, ${data.sync.updated} updated, ${data.sync.linesFilled} lines filled.` +
          (data.lock.locked ? ` Locked ${data.lock.gamesLocked} games (threshold passed).` : ''),
        );
        load();
      } else {
        setMessage(data.error ?? 'Sync failed');
      }
    });
  }

  function handleLockToggle(action: 'lock' | 'unlock') {
    setMessage(null);
    startTransition(async () => {
      const res = await fetch('/api/admin/lines/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week, action }),
      });
      const data = await res.json();
      if (data.success) {
        load();
      } else {
        setMessage(data.error ?? 'Failed');
      }
    });
  }

  function handleSaveLine(gameId: number) {
    const edit = edits[gameId];
    if (!edit) return;
    startTransition(async () => {
      await fetch('/api/admin/lines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, spread: edit.spread, overUnder: edit.overUnder }),
      });
      load();
    });
  }

  const anyLocked = games.some((g) => g.linesLockedAt);
  const allLocked = games.length > 0 && games.every((g) => g.linesLockedAt);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={week}
          onChange={(e) => handleWeekChange(Number(e.target.value))}
          className="rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white px-3 py-2 text-sm"
        >
          {weeks.map((w) => (
            <option key={w} value={w}>Week {w}</option>
          ))}
        </select>

        <button
          onClick={handleSync}
          disabled={isPending}
          className="flex h-10 items-center rounded-lg bg-green-600 px-4 text-sm font-medium text-white transition-colors hover:bg-green-500 disabled:opacity-50"
        >
          Sync from ESPN
        </button>

        {!allLocked && (
          <button
            onClick={() => handleLockToggle('lock')}
            disabled={isPending || games.length === 0}
            className="flex h-10 items-center rounded-lg bg-orange-600 px-4 text-sm font-medium text-white transition-colors hover:bg-orange-500 disabled:opacity-50"
          >
            Lock Now
          </button>
        )}
        {anyLocked && (
          <button
            onClick={() => handleLockToggle('unlock')}
            disabled={isPending}
            className="flex h-10 items-center rounded-lg bg-gray-600 px-4 text-sm font-medium text-white transition-colors hover:bg-gray-500 disabled:opacity-50"
          >
            Unlock
          </button>
        )}
      </div>

      {message && <p className="text-sm text-gray-700 dark:text-gray-300">{message}</p>}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="hidden md:block bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Matchup</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Spread (home)</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">O/U</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {games.map((g) => {
                const edit = edits[g.id] ?? { spread: g.spread != null ? String(g.spread) : '', overUnder: g.overUnder != null ? String(g.overUnder) : '' };
                return (
                  <tr key={g.id}>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{g.awayTeam} @ {g.homeTeam}</td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        step="0.5"
                        value={edit.spread}
                        onChange={(e) => setEdits((prev) => ({ ...prev, [g.id]: { ...edit, spread: e.target.value } }))}
                        className="w-24 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        step="0.5"
                        value={edit.overUnder}
                        onChange={(e) => setEdits((prev) => ({ ...prev, [g.id]: { ...edit, overUnder: e.target.value } }))}
                        className="w-24 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {g.linesLockedAt ? (
                        <span className="text-orange-600">Locked</span>
                      ) : (
                        <span className="text-gray-400">Unlocked</span>
                      )}
                      {g.isFinal && <span className="ml-2 text-green-600">Final {g.awayScore}-{g.homeScore}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleSaveLine(g.id)}
                        disabled={!edits[g.id] || isPending}
                        className="text-blue-600 hover:text-blue-500 text-sm font-medium disabled:opacity-40"
                      >
                        Save
                      </button>
                    </td>
                  </tr>
                );
              })}
              {games.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">
                    No games synced for this week yet — click &quot;Sync from ESPN&quot;.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
