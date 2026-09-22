'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getWeekBoardData, setPick, removePick, setGamePickLock } from '@/app/lib/actions';
import WeekBoard, { type BoardGame, type BoardPick } from './WeekBoard';
import PickCounter from './PickCounter';
import CommissionerExport from './CommissionerExport';

export default function PicksClientWrapper({
  participantId,
  seasonId,
  picksPerWeek,
  weeks,
  initialWeek,
  canEdit,
  isAdminUser,
}: {
  participantId: number;
  seasonId: number;
  picksPerWeek: number;
  weeks: number[];
  initialWeek: number;
  canEdit: boolean;
  isAdminUser: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const week = Number(searchParams.get('week')) || initialWeek;

  const [games, setGames] = useState<BoardGame[]>([]);
  const [picks, setPicksState] = useState<BoardPick[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // canEdit/isAdminUser aren't used inside load() itself — getWeekBoardData re-derives
  // visibility from the session/cookie server-side — but they're included in the dependency
  // array below so that toggling Admin Mode (which changes these props after router.refresh()
  // re-renders the server page) forces a refetch. Without them, this effect's dependency
  // (`load`) never changes identity, so the already-fetched (possibly redacted) picks would
  // stick around until the next unrelated re-fetch.
  const load = useCallback(async () => {
    setLoading(true);
    const data = await getWeekBoardData(participantId, seasonId, week);
    setGames(data.games as BoardGame[]);
    setPicksState(data.picks as BoardPick[]);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participantId, seasonId, week, canEdit, isAdminUser]);

  useEffect(() => {
    load();
  }, [load]);

  function handleWeekChange(newWeek: number) {
    router.push(`/picks/${participantId}?week=${newWeek}`);
  }

  async function handlePick(gameId: number, pickType: 'spread' | 'over_under', selection: string) {
    if (!canEdit) return;
    const key = `${gameId}-${pickType}`;
    const existing = picks.find((p) => p.gameId === gameId && p.pickType === pickType);
    const removing = existing?.selection === selection;
    setError(null);
    setSavingKey(key);

    const result = removing
      ? await removePick(participantId, gameId, pickType)
      : await setPick(participantId, seasonId, week, gameId, pickType, selection);

    setSavingKey(null);
    if (result.success) {
      // Update locally instead of re-fetching the whole week — a full refetch
      // briefly unmounts the board behind a "Loading…" placeholder, which
      // reads as a full page reload even though no navigation happens.
      setPicksState((prev) => {
        const withoutThis = prev.filter((p) => !(p.gameId === gameId && p.pickType === pickType));
        return removing ? withoutThis : [...withoutThis, { gameId, pickType, selection, result: 'pending' }];
      });
    } else {
      setError(result.error ?? 'Failed to save pick');
    }
  }

  async function handleToggleLock(gameId: number, currentlyLocked: boolean) {
    if (!isAdminUser) return;
    const nextLocked = !currentlyLocked;
    const result = await setGamePickLock(gameId, nextLocked);
    if (result.success) {
      setGames((prev) => prev.map((g) => (g.id === gameId ? { ...g, pickLockOverride: nextLocked } : g)));
    } else {
      setError(result.error ?? 'Failed to update lock');
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <select
            value={week}
            onChange={(e) => handleWeekChange(Number(e.target.value))}
            className="rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white px-2.5 py-1.5 text-sm"
          >
            {weeks.map((w) => (
              <option key={w} value={w}>Week {w}</option>
            ))}
          </select>
          <PickCounter count={picks.length} max={picksPerWeek} />
        </div>
        {canEdit && <CommissionerExport participantId={participantId} week={week} />}
      </div>

      {!canEdit && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Picks for games that haven&apos;t started yet are hidden until kickoff.
        </p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <WeekBoard
          games={games}
          picks={picks}
          canEdit={canEdit}
          isAdminUser={isAdminUser}
          savingKey={savingKey}
          onPick={handlePick}
          onToggleLock={handleToggleLock}
        />
      )}
    </div>
  );
}
