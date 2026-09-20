'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getIncompletePicksForWeek, type PicksStatusRow } from '@/app/lib/actions';

export default function PicksStatusManager({
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

  const [rows, setRows] = useState<PicksStatusRow[]>([]);
  const [picksPerWeek, setPicksPerWeek] = useState(6);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getIncompletePicksForWeek(seasonId, week);
    setRows(data.rows);
    setPicksPerWeek(data.picksPerWeek);
    setLoading(false);
  }, [seasonId, week]);

  useEffect(() => {
    load();
  }, [load]);

  function handleWeekChange(newWeek: number) {
    router.push(`/admin/picks-status?week=${newWeek}`);
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
        {!loading && (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {rows.length === 0 ? 'Everyone has finished their picks.' : `${rows.length} entr${rows.length === 1 ? 'y' : 'ies'} not done yet`}
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 text-center text-sm text-gray-500">
          Everyone has made all {picksPerWeek} picks for week {week}.
        </p>
      ) : (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Entry</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Picks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {rows.map((row) => (
                <tr key={row.participantId}>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{row.name}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={row.pickCount === 0 ? 'font-medium text-red-600' : 'font-medium text-orange-600'}>
                      {row.pickCount}/{picksPerWeek}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
