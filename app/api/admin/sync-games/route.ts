import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/app/lib/auth0';
import { isAdmin } from '@/app/lib/auth-utils';
import { syncWeekGames } from '@/app/lib/espn-api';
import { lockWeekIfDue } from '@/app/lib/lines-lock';
import { db } from '@/app/lib/db';
import { seasons } from '@/app/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  const session = await auth0.getSession();
  if (!session?.user || !isAdmin(session.user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const week = Number(body.week);
  if (!week) {
    return NextResponse.json({ error: 'week is required' }, { status: 400 });
  }

  const [activeSeason] = await db.select().from(seasons).where(eq(seasons.isActive, true)).limit(1);
  if (!activeSeason) {
    return NextResponse.json({ error: 'No active season' }, { status: 404 });
  }

  try {
    const syncResult = await syncWeekGames(activeSeason.id, activeSeason.year, week);
    const lockResult = await lockWeekIfDue(activeSeason.id, week);
    return NextResponse.json({ success: true, sync: syncResult, lock: lockResult });
  } catch (error) {
    console.error('Failed to sync games:', error);
    return NextResponse.json({ error: 'Failed to sync games from ESPN' }, { status: 500 });
  }
}
