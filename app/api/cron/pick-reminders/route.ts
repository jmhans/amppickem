import { NextRequest, NextResponse } from 'next/server';
import { sendReminders } from '@/app/lib/reminders';

export const maxDuration = 60;

/**
 * Hourly: checks whether this week's Friday-1pm or Sunday-11am reminder threshold has just
 * passed (DST-aware, see lines-lock.ts) and, if so and not already sent, emails/pushes anyone
 * still short of picksPerWeek picks. Almost always a no-op — sendReminders() does its own
 * due/already-sent checks, so it's safe to call both on every invocation.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [friday, sunday] = await Promise.all([sendReminders('friday'), sendReminders('sunday')]);
  return NextResponse.json({ friday, sunday });
}
