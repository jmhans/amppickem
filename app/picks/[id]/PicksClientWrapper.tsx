'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getWeekBoardData, setPick, removePick } from '@/app/lib/actions';
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
}: {
  participantId: number;
  seasonId: number;
  picksPerWeek: number;
  weeks: number[];
  initialWeek: number;
  canEdit: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const week = Number(searchParams.get('week')) || initialWeek;

  const [games, setGames] = useState<BoardGame[]>([]);
  const [picks, setPicksState] = useState<BoardPick[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getWeekBoardData(participantId, seasonId, week);
    setGames(data.games as BoardGame[]);
    setPicksState(data.picks as BoardPick[]);
    setLoading(false);
  }, [participantId, seasonId, week]);

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
    setError(null);
    setSavingKey(key);

    const result = existing?.selection === selection
      ? await removePick(participantId, gameId, pickType)
      : await setPick(participantId, seasonId, week, gameId, pickType, selection);

    setSavingKey(null);
    if (result.success) {
      load();
    } else {
      setError(result.error ?? 'Failed to save pick');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <select
          value={week}
          onChange={(e) => handleWeekChange(Number(e.target.value))}
          className="rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white px-3 py-2 text-sm"
        >
          {weeks.map((w) => (
            <option key={w} value={w}>Week {w}</option>
          ))}
        </select>
        <PickCounter count={picks.length} max={picksPerWeek} />
      </div>

      {canEdit && <CommissionerExport participantId={participantId} week={week} />}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <WeekBoard
          games={games}
          picks={picks}
          canEdit={canEdit}
          savingKey={savingKey}
          onPick={handlePick}
        />
      )}
    </div>
  );
}
