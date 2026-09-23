import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/lib/db';
import { seasons } from '@/app/lib/db/schema';
import { eq } from 'drizzle-orm';
import { syncWeekGames } from '@/app/lib/espn-api';
import { lockWeekIfDue } from '@/app/lib/lines-lock';

export const maxDuration = 60;

/**
 * Weekly, timed to land shortly after the season's configured line-lock
 * threshold (Admin → Season Settings — Tuesday 7 PM Central by convention,
 * but whatever's configured there). The existing daily cron
 * (app/api/cron/sync-games) already does this same sync-then-lock sweep, but
 * only once a day at a fixed early-morning UTC time — fine when the
 * threshold was 7 AM, but for an evening threshold that means locking could
 * lag up to ~24h behind the intended moment. This job exists purely to close
 * that gap with a trigger that actually lands near the threshold; the
 * threshold itself, and whether a week is actually due to lock, stays owned
 * by lockWeekIfDue/season settings — this route doesn't hardcode "Tuesday"
 * anywhere, it just fires around when Tuesday-evening thresholds land.
 *
 * Vercel cron schedules are fixed UTC and don't shift for DST, so "0 0 * * 3"
 * (Tue 7 PM CDT) drifts to Tue 6 PM once the season crosses into CST in
 * November — a week with no games in that window either way, so close
 * enough. lockWeekIfDue is idempotent and re-checks the real threshold on
 * every call, so an early or late trigger never locks a week ahead of time.
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

  const results: Array<{ week: number; synced?: boolean; locked?: boolean; error?: string }> = [];

  for (let week = season.firstWeek; week <= season.lastWeek; week++) {
    try {
      await syncWeekGames(season.id, season.year, week);
      const lockResult = await lockWeekIfDue(season.id, week);
      results.push({ week, synced: true, locked: lockResult.locked });
    } catch (error) {
      results.push({ week, synced: false, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return NextResponse.json({ season: season.year, results });
}
