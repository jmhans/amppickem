import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/lib/db';
import { seasons } from '@/app/lib/db/schema';
import { eq } from 'drizzle-orm';
import { syncWeekGames } from '@/app/lib/espn-api';
import { getLatestStandingsWeek } from '@/app/lib/actions';

export const maxDuration = 30;

/**
 * Frequent (every couple minutes), deliberately narrow: syncs ONLY the current pick cycle's
 * week from ESPN — the same syncWeekGames the other sync crons use, but for just one week
 * instead of looping all 18, and with no lock-threshold check or re-grade afterward (the
 * standings rank doesn't need recomputing every couple minutes just because a score moved).
 * Exists so GameDay Dashboard's 60s client-side poll (app/gameday/GameDayClient.tsx) actually
 * has fresh scores to read during games, without running the full-season sweep at this
 * frequency. sync-games/sync-spreads still own locking + the once-a-day/weekly full refresh.
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
    const result = await syncWeekGames(season.id, season.year, week);
    return NextResponse.json({ season: season.year, week, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
