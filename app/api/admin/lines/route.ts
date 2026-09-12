import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/app/lib/auth0';
import { isAdmin } from '@/app/lib/auth-utils';
import { db } from '@/app/lib/db';
import { games, seasons } from '@/app/lib/db/schema';
import { eq, and, asc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const session = await auth0.getSession();
  if (!session?.user || !isAdmin(session.user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const week = Number(searchParams.get('week'));
  if (!week) {
    return NextResponse.json({ error: 'week is required' }, { status: 400 });
  }

  const [activeSeason] = await db.select().from(seasons).where(eq(seasons.isActive, true)).limit(1);
  if (!activeSeason) {
    return NextResponse.json({ error: 'No active season' }, { status: 404 });
  }

  const weekGames = await db
    .select()
    .from(games)
    .where(and(eq(games.seasonId, activeSeason.id), eq(games.week, week)))
    .orderBy(asc(games.gameTime));

  return NextResponse.json({ season: activeSeason, games: weekGames });
}

// Admin manual override of a single game's line — works regardless of lock
// state (admin is never blocked by lock; this does not itself lock/unlock).
export async function POST(request: NextRequest) {
  const session = await auth0.getSession();
  if (!session?.user || !isAdmin(session.user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { gameId, spread, overUnder } = body;
  if (!gameId) {
    return NextResponse.json({ error: 'gameId is required' }, { status: 400 });
  }

  await db
    .update(games)
    .set({
      spread: spread === '' || spread == null ? null : Number(spread),
      overUnder: overUnder === '' || overUnder == null ? null : Number(overUnder),
      updatedAt: new Date(),
    })
    .where(eq(games.id, gameId));

  return NextResponse.json({ success: true });
}
