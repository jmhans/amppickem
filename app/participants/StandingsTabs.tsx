'use client';

import { useState } from 'react';
import {
  getWeeklyStandings,
  getSeasonStandings,
  refreshResults,
  type WeeklyStandingsDisplayRow,
  type SeasonStandingsDisplayRow,
} from '@/app/lib/actions';
import WeeklyStandingsTable from './WeeklyStandingsTable';
import SeasonStandingsTable from './SeasonStandingsTable';

export default function StandingsTabs({
  seasonId,
  weeks,
  initialWeek,
  initialWeeklyRows,
  initialSeasonRows,
  claimedIds,
  myParticipantId,
  isLoggedIn,
}: {
  seasonId: number;
  weeks: number[];
  initialWeek: number;
  initialWeeklyRows: WeeklyStandingsDisplayRow[];
  initialSeasonRows: SeasonStandingsDisplayRow[];
  claimedIds: Set<number>;
  myParticipantId: number | null;
  isLoggedIn: boolean;
}) {
  const [tab, setTab] = useState<'weekly' | 'season'>('weekly');
  const [week, setWeek] = useState(initialWeek);
  const [weeklyRows, setWeeklyRows] = useState(initialWeeklyRows);
  const [seasonRows, setSeasonRows] = useState(initialSeasonRows);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);

  async function handleWeekChange(newWeek: number) {
    setWeek(newWeek);
    setLoading(true);
    const rows = await getWeeklyStandings(seasonId, newWeek);
    setWeeklyRows(rows);
    setLoading(false);
  }

  async function handleRefresh() {
    setRefreshing(true);
    setRefreshMessage(null);
    const result = await refreshResults();

    if (!result.success) {
      setRefreshMessage(result.error ?? 'Failed to refresh');
      setRefreshing(false);
      return;
    }

    // Re-fetch exactly what's currently on screen — a plain router.refresh() only re-runs the
    // server-fetched props, but weeklyRows/seasonRows already live in this component's own
    // state by this point (needed so week-switching doesn't refetch the whole page), and React
    // doesn't reset useState from new props on re-render. So pull fresh data directly instead.
    const [freshWeekly, freshSeason] = await Promise.all([
      getWeeklyStandings(seasonId, week),
      getSeasonStandings(seasonId),
    ]);
    setWeeklyRows(freshWeekly);
    setSeasonRows(freshSeason);
    setRefreshMessage(result.changed > 0 ? `Updated ${result.changed} pick${result.changed === 1 ? '' : 's'}.` : 'Already up to date.');
    setRefreshing(false);
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

        <div className="flex items-center gap-2">
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
          {isLoggedIn && (
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-600 px-2.5 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              {refreshing ? 'Refreshing…' : 'Refresh Results'}
            </button>
          )}
        </div>
      </div>

      {refreshMessage && <p className="text-xs text-gray-500 dark:text-gray-400">{refreshMessage}</p>}

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
