// Plain module (no 'use server') — invoked only from the pick-reminders cron route, never
// directly by a client. Mirrors app/lib/lines-lock.ts's day-of-week/hour/timezone threshold
// pattern (computeLockThreshold) and actions.ts's refreshResults() claim-the-slot idempotency
// pattern against systemSettings, rather than introducing new mechanisms for either.
import { db } from '@/app/lib/db';
import { systemSettings } from '@/app/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getOrCreateActiveSeason, getLatestStandingsWeek, getGamesForWeek } from '@/app/lib/actions';
import { computeForwardThresholdFromEarliestGame } from '@/app/lib/lines-lock';
import { computeIncompletePicksForWeek } from '@/app/lib/picks-status';
import { sendPickReminderEmail } from '@/app/lib/email';
import { sendPushToParticipant } from '@/app/lib/push';

type ReminderKind = 'friday' | 'sunday';

const REMINDER_SCHEDULE: Record<ReminderKind, { dayOfWeek: number; hour: number; systemSettingsKey: string }> = {
  friday: { dayOfWeek: 5, hour: 13, systemSettingsKey: 'last_friday_reminder' },
  sunday: { dayOfWeek: 0, hour: 11, systemSettingsKey: 'last_sunday_reminder' },
};

export interface SendRemindersResult {
  sent: boolean;
  reason?: string;
  emailed?: number;
  pushed?: number;
}

/**
 * Sends the Friday/Sunday "you're behind on picks" nudge, if (a) that day/hour's threshold
 * has actually passed for the current week (DST-aware, same math the line-lock uses) and
 * (b) it hasn't already been sent for this week (systemSettings claim-the-slot, so a cron
 * that fires more than once near the threshold — or a manual re-trigger — doesn't double-send).
 * Safe to call unconditionally from the cron on every run; almost always a no-op.
 */
export async function sendReminders(kind: ReminderKind): Promise<SendRemindersResult> {
  const { dayOfWeek, hour, systemSettingsKey } = REMINDER_SCHEDULE[kind];

  const season = await getOrCreateActiveSeason();
  const week = await getLatestStandingsWeek(season.id);

  const weekGames = await getGamesForWeek(season.id, week);
  const gameTimes = weekGames.map((g) => g.gameTime).filter((t): t is Date => t != null);
  if (gameTimes.length === 0) {
    return { sent: false, reason: 'no games scheduled yet' };
  }
  const earliestGameTime = gameTimes.reduce((a, b) => (a < b ? a : b));

  const threshold = computeForwardThresholdFromEarliestGame(earliestGameTime, dayOfWeek, hour, season.lineLockTimezone);
  if (new Date() < threshold) {
    return { sent: false, reason: 'not due yet' };
  }

  const claimValue = `${season.id}:${week}`;
  const [existing] = await db.select().from(systemSettings).where(eq(systemSettings.key, systemSettingsKey)).limit(1);
  if (existing?.value === claimValue) {
    return { sent: false, reason: 'already sent for this week' };
  }

  // Claim the slot before sending so a concurrent/duplicate cron invocation doesn't also send.
  await db
    .insert(systemSettings)
    .values({ key: systemSettingsKey, value: claimValue })
    .onConflictDoUpdate({ target: systemSettings.key, set: { value: claimValue, updatedAt: new Date() } });

  const { picksPerWeek, rows } = await computeIncompletePicksForWeek(season.id, week);
  const picksUrl = (participantId: number) => `${process.env.APP_BASE_URL}/picks/${participantId}`;

  let emailed = 0;
  let pushed = 0;

  await Promise.all(
    rows.filter((r) => r.notificationsEnabled).map(async (r) => {
      if (r.notificationChannel === 'push') {
        const result = await sendPushToParticipant(r.participantId, {
          title: `Week ${week} picks: ${r.pickCount}/${picksPerWeek}`,
          body: "Don't forget to finish your picks before games start.",
          url: picksUrl(r.participantId),
        });
        if (result.sent > 0) {
          pushed++;
          return;
        }
        // No live subscription (or send failed) — fall back to email rather than losing the reminder.
      }
      if (r.email) {
        await sendPickReminderEmail({
          participantEmail: r.email,
          participantName: r.name,
          week,
          pickCount: r.pickCount,
          picksPerWeek,
          picksUrl: picksUrl(r.participantId),
        });
        emailed++;
      }
    }),
  );

  return { sent: true, emailed, pushed };
}
