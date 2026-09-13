'use client';

import { useState } from 'react';
import { getWeeklyStandings, type WeeklyStandingsDisplayRow, type SeasonStandingsDisplayRow } from '@/app/lib/actions';
import WeeklyStandingsTable from './WeeklyStandingsTable';
import SeasonStandingsTable from './SeasonStandingsTable';

export default function StandingsTabs({
  seasonId,
  weeks,
  initialWeek,
  initialWeeklyRows,
  seasonRows,
  claimedIds,
  myParticipantId,
  isLoggedIn,
}: {
  seasonId: number;
  weeks: number[];
  initialWeek: number;
  initialWeeklyRows: WeeklyStandingsDisplayRow[];
  seasonRows: SeasonStandingsDisplayRow[];
  claimedIds: Set<number>;
  myParticipantId: number | null;
  isLoggedIn: boolean;
}) {
  const [tab, setTab] = useState<'weekly' | 'season'>('weekly');
  const [week, setWeek] = useState(initialWeek);
  const [weeklyRows, setWeeklyRows] = useState(initialWeeklyRows);
  const [loading, setLoading] = useState(false);

  async function handleWeekChange(newWeek: number) {
    setWeek(newWeek);
    setLoading(true);
    const rows = await getWeeklyStandings(seasonId, newWeek);
    setWeeklyRows(rows);
    setLoading(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-600 p-0.5">
          {(['weekly', 'season'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === t
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {t === 'weekly' ? 'Weekly' : 'Season'}
            </button>
          ))}
        </div>

        {tab === 'weekly' && (
          <select
            value={week}
            onChange={(e) => handleWeekChange(Number(e.target.value))}
            className="rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white px-2.5 py-1.5 text-sm"
          >
            {weeks.map((w) => (
              <option key={w} value={w}>Week {w}</option>
            ))}
          </select>
        )}
      </div>

      {tab === 'weekly' ? (
        loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : (
          <WeeklyStandingsTable rows={weeklyRows} claimedIds={claimedIds} />
        )
      ) : (
        <SeasonStandingsTable
          rows={seasonRows}
          claimedIds={claimedIds}
          myParticipantId={myParticipantId}
          isLoggedIn={isLoggedIn}
        />
      )}
    </div>
  );
}
