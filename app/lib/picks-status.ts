// Plain module (no 'use server') — actions.ts is a 'use server' file where every export
// becomes a publicly callable RPC endpoint, so the version of this query that includes
// emails/notification prefs can't live there without leaking that data to any client. This
// file is imported by both actions.ts's admin-gated getIncompletePicksForWeek (which strips
// the sensitive fields before returning) and app/lib/reminders.ts (cron-only, no user-facing
// entry point at all).
import { db } from '@/app/lib/db';
import { participants, picks, seasons } from '@/app/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export interface IncompletePickRow {
  participantId: number;
  name: string;
  email: string | null;
  notificationsEnabled: boolean;
  notificationChannel: string;
  pickCount: number;
}

/**
 * Active participants who haven't yet made a full picksPerWeek picks for the given week —
 * sorted fewest-picks-first so the most-behind entries surface at the top. A participant
 * counts a pick per ROW in the picks table (a spread pick and an O/U pick on the same game
 * both count separately), matching the cap setPick() enforces and what PickCounter shows
 * the participant themselves.
 */
export async function computeIncompletePicksForWeek(seasonId: number, week: number): Promise<{ picksPerWeek: number; rows: IncompletePickRow[] }> {
  const [seasonRows, activeParticipants, weekPicks] = await Promise.all([
    db.select().from(seasons).where(eq(seasons.id, seasonId)).limit(1),
    db
      .select({
        id: participants.id,
        name: participants.name,
        email: participants.email,
        notificationsEnabled: participants.notificationsEnabled,
        notificationChannel: participants.notificationChannel,
      })
      .from(participants)
      .where(eq(participants.isActive, true)),
    db.select({ participantId: picks.participantId }).from(picks).where(and(eq(picks.seasonId, seasonId), eq(picks.week, week))),
  ]);
  const season = seasonRows[0];
  if (!season) throw new Error('Season not found');

  const countByParticipant = new Map<number, number>();
  for (const p of weekPicks) {
    countByParticipant.set(p.participantId, (countByParticipant.get(p.participantId) ?? 0) + 1);
  }

  const rows = activeParticipants
    .map((p) => ({
      participantId: p.id,
      name: p.name,
      email: p.email,
      notificationsEnabled: p.notificationsEnabled,
      notificationChannel: p.notificationChannel,
      pickCount: countByParticipant.get(p.id) ?? 0,
    }))
    .filter((r) => r.pickCount < season.picksPerWeek)
    .sort((a, b) => a.pickCount - b.pickCount || a.name.localeCompare(b.name));

  return { picksPerWeek: season.picksPerWeek, rows };
}
