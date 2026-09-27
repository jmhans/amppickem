'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { getGameDayData, refreshCurrentWeekScores, type GameDayData, type GameDayPick } from '@/app/lib/actions';
import { teamLogoUrl } from '@/app/lib/team-logos';
import { gradeSpreadPick, gradeTotalPick } from '@/app/lib/grading';

// The underlying scores refresh on their own via api/cron/sync-scores (every couple minutes,
// current week only) — this poll just re-reads whatever that last wrote, so it stays cheap
// (a DB read, not an ESPN call) even with several people's browsers doing it at once.
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
  // ESPN returns period 0 / displayClock "0:00" for a game that hasn't started yet rather than
  // leaving them null — period > 0 is what actually means "a quarter is underway."
  if (pick.period != null && pick.period > 0 && pick.displayClock) return { text: `Q${pick.period} ${pick.displayClock}`, live: true };
  if (pick.gameTime) {
    const d = new Date(pick.gameTime);
    return { text: d.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' }), live: false };
  }
  return { text: 'TBD', live: false };
}

type LiveResult = 'win' | 'loss' | 'push';

/**
 * "If this game ended right this second, did the pick hit?" — reuses the exact same grading
 * functions admin/results uses for the real, final grade, just fed the current (not final)
 * score. Only meaningful once both scores exist; a pregame pick (no score yet) has nothing to
 * project from.
 */
function computeLiveResult(pick: GameDayPick): LiveResult | null {
  if (pick.homeScore == null || pick.awayScore == null) return null;
  if (pick.pickType === 'spread') {
    if (pick.spread == null) return null;
    return gradeSpreadPick(pick.selection as 'home' | 'away', pick.spread, pick.homeScore, pick.awayScore);
  }
  if (pick.overUnder == null) return null;
  return gradeTotalPick(pick.selection as 'over' | 'under', pick.overUnder, pick.homeScore, pick.awayScore);
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

// Live (unofficial, in-progress) shading gets a background tint on top of the border color —
// a stronger visual cue than the official graded state uses, since "currently winning" is
// exactly the thing someone glancing at this page mid-game wants to spot at a glance.
function liveCardClasses(result: LiveResult): string {
  switch (result) {
    case 'win':
      return 'border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-900/20';
    case 'loss':
      return 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20';
    case 'push':
      return 'border-gray-300 dark:border-gray-600';
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

/**
 * Same idea as ResultBadge, styled softer (outline, title case) to read as "so far," not
 * final. Shows a win-probability percentage when one's available (regulation play — see
 * app/lib/live-projection.ts); falls back to plain "Winning"/"Losing"/"Push" text outside
 * regulation (overtime), where that model doesn't apply but the game's still live.
 */
function LiveStatusBadge({ result, winProbability }: { result: LiveResult; winProbability: number | null }) {
  const label =
    winProbability != null
      ? `${Math.round(winProbability * 100)}%`
      : result === 'win' ? 'Winning' : result === 'loss' ? 'Losing' : 'Push';
  const classes =
    result === 'win'
      ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
      : result === 'loss'
        ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
        : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${classes}`}>{label}</span>;
}

function TeamRow({ team, score }: { team: string; score: number | null }) {
  return (
    <div className="flex items-center justify-between gap-1">
      <div className="flex min-w-0 items-center gap-1">
        <Image src={teamLogoUrl(team)} alt={team} width={16} height={16} className="h-4 w-4 shrink-0" unoptimized />
        <span className="truncate text-xs font-semibold text-gray-900 dark:text-white">{team}</span>
      </div>
      <span className="shrink-0 text-xs font-bold tabular-nums text-gray-900 dark:text-white">{score ?? '-'}</span>
    </div>
  );
}

function PickCard({ pick }: { pick: GameDayPick }) {
  const status = gameStatus(pick);
  // Once officially graded, that result wins outright. Until then, if the game has actually
  // started, show where the pick stands — preferring the forward-looking win probability
  // (app/lib/live-projection.ts, regulation play only) over the raw current-score comparison,
  // since those two can disagree (e.g. winning right now but the season-pace projection
  // expects a fade) and the probability is the more informative signal. computeLiveResult
  // (current score only) is the fallback for overtime, where the projection model doesn't
  // apply but the game is still very much live. Gated on the game having started (not just
  // "scores are non-null") in case ESPN ever reports 0-0 before kickoff rather than null.
  const gameStarted = status.live || pick.isFinal;
  const currentResult = pick.result === 'pending' && gameStarted ? computeLiveResult(pick) : null;
  const winProbability = pick.result === 'pending' ? pick.liveWinProbability : null;
  const liveLeaning: LiveResult | null = winProbability != null ? (winProbability >= 0.5 ? 'win' : 'loss') : currentResult;
  const cardClasses = liveLeaning ? liveCardClasses(liveLeaning) : cardBorderClasses(pick.result);

  return (
    <div className={`rounded-lg border bg-white dark:bg-gray-800 p-2 shadow-sm ${cardClasses}`}>
      <div className="flex items-center justify-between gap-1">
        <span className={`flex min-w-0 items-center gap-1 truncate text-[10px] font-medium ${status.live ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
          {status.live && <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-red-600 animate-pulse" />}
          {status.text}
        </span>
        {liveLeaning ? <LiveStatusBadge result={liveLeaning} winProbability={winProbability} /> : <ResultBadge result={pick.result} />}
      </div>

      <div className="mt-1.5 space-y-0.5">
        <TeamRow team={pick.awayTeam} score={pick.awayScore} />
        <TeamRow team={pick.homeTeam} score={pick.homeScore} />
      </div>

      <div className="mt-1.5 truncate border-t border-gray-100 dark:border-gray-700 pt-1 text-[11px] font-semibold text-gray-700 dark:text-gray-300">
        {pickLabel(pick)}
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
  const [refreshing, setRefreshing] = useState(false);

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

  async function handleRefresh() {
    setRefreshing(true);
    // Pulls this week's scores from ESPN right now (see api/cron/sync-scores for the
    // automatic every-couple-minutes version), then re-reads the DB to pick it up.
    await refreshCurrentWeekScores(seasonId, week);
    await load();
    setRefreshing(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Week {week}</h1>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label="Refresh scores"
            title="Refresh scores"
            className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50 dark:hover:bg-gray-700 dark:hover:text-gray-300"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12a7.5 7.5 0 0112.8-5.3M19.5 12a7.5 7.5 0 01-12.8 5.3M4.5 5v4h4M19.5 19v-4h-4" />
            </svg>
          </button>
        </div>
        {data && <RankBadge rank={data.rank} />}
      </div>

      <Link href="/gameday/methodology" className="inline-block text-xs text-blue-600 hover:text-blue-500">
        How the live win % is calculated →
      </Link>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : !data || data.picks.length === 0 ? (
        <p className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 text-center text-sm text-gray-500">
          No picks made for this week yet.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {data.picks.map((pick) => (
            <PickCard key={pick.pickId} pick={pick} />
          ))}
        </div>
      )}
    </div>
  );
}
