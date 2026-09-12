import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/lib/db';
import { seasons } from '@/app/lib/db/schema';
import { eq } from 'drizzle-orm';
import { gradeSeason } from '@/app/lib/actions';

export const maxDuration = 60;

/**
 * Daily: re-grades every pick in the active season from scratch. Cheap and
 * idempotent (see gradeWeek's docstring) — simpler and safer than tracking
 * "which weeks just went final" given how rarely this needs to run.
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

  const result = await gradeSeason(season.id);
  return NextResponse.json({ season: season.year, ...result });
}
