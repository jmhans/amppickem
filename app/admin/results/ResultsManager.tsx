'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { setGameResult } from '@/app/lib/actions';

type Game = {
  id: number;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  isFinal: boolean;
  status: string | null;
};

export default function ResultsManager({ weeks, initialWeek }: { weeks: number[]; initialWeek: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const week = Number(searchParams.get('week')) || initialWeek;

  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [edits, setEdits] = useState<Record<number, { homeScore: string; awayScore: string; isFinal: boolean }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    // Reuses the lines-list endpoint — same shape (game rows for a week), and it already
    // resolves the active season server-side.
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
    router.push(`/admin/results?week=${newWeek}`);
  }

  function handleSaveResult(gameId: number) {
    const edit = edits[gameId];
    if (!edit) return;
    startTransition(async () => {
      await setGameResult(
        gameId,
        edit.homeScore === '' ? null : Number(edit.homeScore),
        edit.awayScore === '' ? null : Number(edit.awayScore),
        edit.isFinal,
      );
      load();
    });
  }

  function handleRegrade(scope: 'week' | 'season') {
    setMessage(null);
    startTransition(async () => {
      const res = await fetch('/api/admin/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scope === 'week' ? { week } : {}),
      });
      const data = await res.json();
      if (data.success) {
        const r = data.result;
        setMessage(
          scope === 'week'
            ? `Graded ${r.graded} picks, ${r.changed} changed. W:${r.byResult.win} L:${r.byResult.loss} P:${r.byResult.push} pending:${r.byResult.pending}`
            : `Graded ${r.graded} picks across the season, ${r.changed} changed.`,
        );
        load();
      } else {
        setMessage(data.error ?? 'Grading failed');
      }
    });
  }

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
          onClick={() => handleRegrade('week')}
          disabled={isPending}
          className="flex h-10 items-center rounded-lg bg-purple-600 px-4 text-sm font-medium text-white transition-colors hover:bg-purple-500 disabled:opacity-50"
        >
          Re-grade Week
        </button>
        <button
          onClick={() => handleRegrade('season')}
          disabled={isPending}
          className="flex h-10 items-center rounded-lg bg-gray-600 px-4 text-sm font-medium text-white transition-colors hover:bg-gray-500 disabled:opacity-50"
        >
          Re-grade Whole Season
        </button>
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
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Away Score</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Home Score</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Final</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {games.map((g) => {
                const edit = edits[g.id] ?? {
                  homeScore: g.homeScore != null ? String(g.homeScore) : '',
                  awayScore: g.awayScore != null ? String(g.awayScore) : '',
                  isFinal: g.isFinal,
                };
                return (
                  <tr key={g.id}>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{g.awayTeam} @ {g.homeTeam}</td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={edit.awayScore}
                        onChange={(e) => setEdits((prev) => ({ ...prev, [g.id]: { ...edit, awayScore: e.target.value } }))}
                        className="w-20 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={edit.homeScore}
                        onChange={(e) => setEdits((prev) => ({ ...prev, [g.id]: { ...edit, homeScore: e.target.value } }))}
                        className="w-20 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={edit.isFinal}
                        onChange={(e) => setEdits((prev) => ({ ...prev, [g.id]: { ...edit, isFinal: e.target.checked } }))}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleSaveResult(g.id)}
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
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">No games for this week.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
