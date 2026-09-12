import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/app/lib/auth0';
import { isAdmin } from '@/app/lib/auth-utils';
import { lockWeekNow, unlockWeek } from '@/app/lib/lines-lock';
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
  const action = body.action as 'lock' | 'unlock';
  if (!week || (action !== 'lock' && action !== 'unlock')) {
    return NextResponse.json({ error: 'week and action (lock|unlock) are required' }, { status: 400 });
  }

  const [activeSeason] = await db.select().from(seasons).where(eq(seasons.isActive, true)).limit(1);
  if (!activeSeason) {
    return NextResponse.json({ error: 'No active season' }, { status: 404 });
  }

  const result = action === 'lock'
    ? await lockWeekNow(activeSeason.id, week)
    : await unlockWeek(activeSeason.id, week);

  return NextResponse.json({ success: true, result });
}
