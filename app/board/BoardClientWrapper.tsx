'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getBoardData, type BoardGameRow } from '@/app/lib/actions';
import BoardTable from './BoardTable';

export default function BoardClientWrapper({
  seasonId,
  weeks,
  initialWeek,
}: {
  seasonId: number;
  weeks: number[];
  initialWeek: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const week = Number(searchParams.get('week')) || initialWeek;

  const [rows, setRows] = useState<BoardGameRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getBoardData(seasonId, week);
    setRows(data);
    setLoading(false);
  }, [seasonId, week]);

  useEffect(() => {
    load();
  }, [load]);

  function handleWeekChange(newWeek: number) {
    router.push(`/board?week=${newWeek}`);
  }

  return (
    <div className="space-y-3">
      <select
        value={week}
        onChange={(e) => handleWeekChange(Number(e.target.value))}
        className="rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white px-2.5 py-1.5 text-sm"
      >
        {weeks.map((w) => (
          <option key={w} value={w}>Week {w}</option>
        ))}
      </select>

      {loading ? <p className="text-sm text-gray-500">Loading…</p> : <BoardTable rows={rows} />}
    </div>
  );
}
