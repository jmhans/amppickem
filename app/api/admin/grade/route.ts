import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/app/lib/auth0';
import { isAdmin } from '@/app/lib/auth-utils';
import { gradeWeek, gradeSeason } from '@/app/lib/actions';
import { db } from '@/app/lib/db';
import { seasons } from '@/app/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  const session = await auth0.getSession();
  if (!session?.user || !isAdmin(session.user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const [activeSeason] = await db.select().from(seasons).where(eq(seasons.isActive, true)).limit(1);
  if (!activeSeason) {
    return NextResponse.json({ error: 'No active season' }, { status: 404 });
  }

  const result = body.week
    ? await gradeWeek(activeSeason.id, Number(body.week))
    : await gradeSeason(activeSeason.id);

  return NextResponse.json({ success: true, result });
}
