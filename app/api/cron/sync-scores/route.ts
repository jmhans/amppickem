import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/lib/db';
import { seasons } from '@/app/lib/db/schema';
import { eq } from 'drizzle-orm';
import { syncWeekGames } from '@/app/lib/espn-api';
import { getLatestStandingsWeek, gradeWeek } from '@/app/lib/actions';

export const maxDuration = 30;

/**
 * Frequent (every minute — see vercel.json's hour-restricted schedule), deliberately narrow:
 * syncs ONLY the current pick cycle's week from ESPN — the same syncWeekGames the other sync
 * crons use, but for just one week instead of looping all 18, and with no lock-threshold
 * check. Also re-grades just that week's picks (gradeWeek — pure DB computation, no ESPN
 * calls) so win/loss/push results keep pace with the score; season-wide standings/payouts are
 * a separate, much heavier computation this never touches. Exists so GameDay Dashboard's 60s
 * client-side poll (app/gameday/GameDayClient.tsx) actually has fresh data to read during
 * games, without running the full-season sweep at this frequency. sync-games/sync-spreads
 * still own locking + the once-a-day/weekly full refresh.
 *
 * vercel.json only triggers this during a broad UTC hour window covering any possible NFL
 * kickoff-to-final span (not restricted by day-of-week — Monday Night Football's finish
 * crosses into Tuesday UTC, so a day-of-week restriction risks silently cutting off a still-
 * live game; an hour-only restriction can't have that failure mode).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [season] = await db.select().from(seasons).where(eq(seasons.isActive, true)).limit(1);
  if (!season) {
    return NextResponse.json({ error: 'No active season' }, { status: 404 });
  }

  const week = await getLatestStandingsWeek(season.id);

  try {
    const syncResult = await syncWeekGames(season.id, season.year, week);
    const gradeResult = await gradeWeek(season.id, week);
    return NextResponse.json({ season: season.year, week, sync: syncResult, grade: gradeResult });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
