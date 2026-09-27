'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { getGameDayData, type GameDayData, type GameDayPick } from '@/app/lib/actions';
import { teamLogoUrl } from '@/app/lib/team-logos';

// Scores only ever change as fast as the sync-games cron runs, not live — polling is purely
// a convenience for "leave this open during games" without a manual refresh, not real-time.
const POLL_MS = 60_000;

function formatSpread(teamIsHome: boolean, spread: number | null): string {
  if (spread == null) return '';
  // spread is the HOME team's line; the away team's line is the negation — same convention as GameCard.
  const line = teamIsHome ? spread : -spread;
  return line > 0 ? `+${line}` : `${line}`;
}

function pickLabel(pick: GameDayPick): string {
  if (pick.pickType === 'spread') {
    const team = pick.selection === 'home' ? pick.homeTeam : pick.awayTeam;
    return `${team} ${formatSpread(pick.selection === 'home', pick.spread)}`.trim();
  }
  const line = pick.overUnder ?? '-';
  return pick.selection === 'over' ? `Over ${line}` : `Under ${line}`;
}

function gameStatus(pick: GameDayPick): { text: string; live: boolean } {
  if (pick.isFinal) return { text: 'Final', live: false };
  if (pick.status === 'STATUS_HALFTIME') return { text: 'Halftime', live: true };
  if (pick.period != null && pick.displayClock) return { text: `Q${pick.period} ${pick.displayClock}`, live: true };
  if (pick.gameTime) {
    const d = new Date(pick.gameTime);
    return { text: d.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' }), live: false };
  }
  return { text: 'TBD', live: false };
}

function cardBorderClasses(result: GameDayPick['result']): string {
  switch (result) {
    case 'win':
      return 'border-green-400 dark:border-green-600';
    case 'loss':
      return 'border-red-300 dark:border-red-700';
    case 'push':
    case 'void':
      return 'border-gray-300 dark:border-gray-600';
    default:
      return 'border-gray-200 dark:border-gray-700';
  }
}

function ResultBadge({ result }: { result: GameDayPick['result'] }) {
  if (result === 'pending') return null;
  const label = result === 'win' ? 'WIN' : result === 'loss' ? 'LOSS' : result === 'push' ? 'PUSH' : 'VOID';
  const classes =
    result === 'win'
      ? 'bg-green-600 text-white'
      : result === 'loss'
        ? 'bg-red-600 text-white'
        : 'bg-gray-400 text-white';
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${classes}`}>{label}</span>;
}

function PickCard({ pick }: { pick: GameDayPick }) {
  const status = gameStatus(pick);
  return (
    <div className={`rounded-lg border bg-white dark:bg-gray-800 p-3 shadow-sm ${cardBorderClasses(pick.result)}`}>
      <div className="flex items-center justify-between">
        <span className={`flex items-center gap-1 text-xs font-medium ${status.live ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
          {status.live && <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-600 animate-pulse" />}
          {status.text}
        </span>
        <ResultBadge result={pick.result} />
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Image src={teamLogoUrl(pick.awayTeam)} alt={pick.awayTeam} width={22} height={22} className="h-[22px] w-[22px] shrink-0" unoptimized />
          <span className="truncate text-sm font-semibold text-gray-900 dark:text-white">{pick.awayTeam}</span>
        </div>
        <span className="shrink-0 text-base font-bold tabular-nums text-gray-900 dark:text-white">
          {pick.awayScore ?? '-'}&ndash;{pick.homeScore ?? '-'}
        </span>
        <div className="flex min-w-0 items-center justify-end gap-1.5">
          <span className="truncate text-sm font-semibold text-gray-900 dark:text-white">{pick.homeTeam}</span>
          <Image src={teamLogoUrl(pick.homeTeam)} alt={pick.homeTeam} width={22} height={22} className="h-[22px] w-[22px] shrink-0" unoptimized />
        </div>
      </div>

      <div className="mt-2 border-t border-gray-100 dark:border-gray-700 pt-1.5 text-xs text-gray-600 dark:text-gray-300">
        Your pick: <span className="font-semibold text-gray-900 dark:text-white">{pickLabel(pick)}</span>
      </div>
    </div>
  );
}

function RankBadge({ rank }: { rank: GameDayData['rank'] }) {
  if (!rank) return null;
  return (
    <span className="shrink-0 rounded-full bg-blue-600 px-3 py-1 text-sm font-bold text-white">
      {rank.tied ? 'T' : ''}{rank.value}/{rank.total}
    </span>
  );
}

export default function GameDayClient({
  participantId,
  seasonId,
  week,
}: {
  participantId: number;
  seasonId: number;
  week: number;
}) {
  const [data, setData] = useState<GameDayData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const result = await getGameDayData(participantId, seasonId, week);
    setData(result);
    setLoading(false);
  }, [participantId, seasonId, week]);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Week {week}</h1>
        {data && <RankBadge rank={data.rank} />}
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : !data || data.picks.length === 0 ? (
        <p className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 text-center text-sm text-gray-500">
          No picks made for this week yet.
        </p>
      ) : (
        <div className="space-y-2">
          {data.picks.map((pick) => (
            <PickCard key={pick.pickId} pick={pick} />
          ))}
        </div>
      )}
    </div>
  );
}
