import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/lib/db';
import { seasons } from '@/app/lib/db/schema';
import { eq } from 'drizzle-orm';
import { syncWeekGames } from '@/app/lib/espn-api';
import { lockWeekIfDue } from '@/app/lib/lines-lock';

export const maxDuration = 60;

/**
 * Daily: syncs ESPN games/scores/lines for every week of the active season
 * (cheap — 18 weeks, one ESPN call each, no lines overwritten for already-
 * locked weeks), then freezes any week whose configured lock threshold has
 * just passed. One job covers both concerns so they share Vercel Hobby's
 * 2-cron budget with the separate grading cron.
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
