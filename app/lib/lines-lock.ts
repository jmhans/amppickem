import { db } from '@/app/lib/db';
import { games, seasons } from '@/app/lib/db/schema';
import { and, eq, isNull } from 'drizzle-orm';

/** Y/M/D of `date` as displayed in `timeZone` (calendar-only, no time-of-day). */
export function getZonedYMD(date: Date, timeZone: string): { year: number; month: number; day: number } {
  const dtf = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const parts = dtf.formatToParts(date).reduce((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {} as Record<string, string>);
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
}

/** Offset (minutes) such that (instant-interpreted-as-UTC-digits-in-timeZone) = instant + offset. DST-aware. */
function getTimezoneOffsetMinutes(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const parts = dtf.formatToParts(date).reduce((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {} as Record<string, string>);
  const asUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute), Number(parts.second),
  );
  return (asUtc - date.getTime()) / 60000;
}

/** The UTC instant at which `timeZone`'s wall clock reads year-month-day hour:minute. DST-aware. */
export function zonedTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): Date {
  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  const offsetMinutes = getTimezoneOffsetMinutes(new Date(naiveUtc), timeZone);
  return new Date(naiveUtc - offsetMinutes * 60000);
}

/**
 * The UTC instant at which a week whose earliest kickoff is `earliestGameTime`
 * should freeze — the season's configured day-of-week/hour/timezone, in the
 * calendar week containing that kickoff (so "Tuesday 7am Central" resolves to
 * the Tuesday a couple of days before that week's Thursday/Sunday games, not
 * some other week's Tuesday). Pure — no DB access — so callers who already
 * have a week's earliest game time on hand (e.g. standings' "current week"
 * default, see actions.ts) can reuse this without a redundant games query.
 */
export function computeLockThresholdFromEarliestGame(
  earliestGameTime: Date,
  lineLockDayOfWeek: number,
  lineLockHour: number,
  lineLockTimezone: string,
): Date {
  const { year, month, day } = getZonedYMD(earliestGameTime, lineLockTimezone);
  // Jan 1 1970 (epoch day 0) was a Thursday (JS getDay()=4). Use that to get
  // day-of-week (0=Sun..6=Sat) from a pure calendar date without involving
  // the server's own local timezone.
  const daysSinceEpoch = Date.UTC(year, month - 1, day) / 86400000;
  const currentDow = (((Math.round(daysSinceEpoch) + 4) % 7) + 7) % 7;
  const delta = lineLockDayOfWeek - currentDow;

  const calendarAnchor = new Date(Date.UTC(year, month - 1, day));
  calendarAnchor.setUTCDate(calendarAnchor.getUTCDate() + delta);

  return zonedTimeToUtc(
    calendarAnchor.getUTCFullYear(),
    calendarAnchor.getUTCMonth() + 1,
    calendarAnchor.getUTCDate(),
    lineLockHour,
    0,
    lineLockTimezone,
  );
}

/**
 * Like computeLockThresholdFromEarliestGame, but always resolves FORWARD from
 * earliestGameTime's calendar day, wrapping to the next week if targetDayOfWeek falls
 * earlier in the Sun-Sat numbering than the anchor day. The lock threshold deliberately
 * anchors backward (Tuesday, 2 days before a Thursday kickoff); a reminder like "Sunday
 * 11am" needs the opposite — Sunday(0) is numerically less than Thursday(4), so the
 * backward version would resolve to the PRIOR week's Sunday instead of the one 3 days after
 * that Thursday game. See app/lib/reminders.ts.
 */
export function computeForwardThresholdFromEarliestGame(
  earliestGameTime: Date,
  targetDayOfWeek: number,
  targetHour: number,
  timezone: string,
): Date {
  const { year, month, day } = getZonedYMD(earliestGameTime, timezone);
  const daysSinceEpoch = Date.UTC(year, month - 1, day) / 86400000;
  const currentDow = (((Math.round(daysSinceEpoch) + 4) % 7) + 7) % 7;
  const delta = ((targetDayOfWeek - currentDow) % 7 + 7) % 7; // always 0-6, never backward

  const calendarAnchor = new Date(Date.UTC(year, month - 1, day));
  calendarAnchor.setUTCDate(calendarAnchor.getUTCDate() + delta);

  return zonedTimeToUtc(
    calendarAnchor.getUTCFullYear(),
    calendarAnchor.getUTCMonth() + 1,
    calendarAnchor.getUTCDate(),
    targetHour,
    0,
    timezone,
  );
}

/**
 * The UTC instant at which a given (season, week)'s lines should freeze.
 * Returns null if the week has no games yet (nothing synced to anchor against).
 */
export async function computeLockThreshold(
  seasonId: number,
  week: number,
  lineLockDayOfWeek: number,
  lineLockHour: number,
  lineLockTimezone: string,
): Promise<Date | null> {
  const weekGames = await db
    .select({ gameTime: games.gameTime })
    .from(games)
    .where(and(eq(games.seasonId, seasonId), eq(games.week, week)));

  const times = weekGames.map((g) => g.gameTime).filter((t): t is Date => t != null);
  if (times.length === 0) return null;
  const earliest = times.reduce((a, b) => (a < b ? a : b));

  return computeLockThresholdFromEarliestGame(earliest, lineLockDayOfWeek, lineLockHour, lineLockTimezone);
}

/**
 * If this week's configured lock threshold has passed and it isn't locked
 * yet, freezes every not-yet-locked game in the week (whatever the most
 * recent ESPN sync already stored). Idempotent — safe to call from a daily
 * cron regardless of whether the week is already locked or not due yet.
 */
export async function lockWeekIfDue(seasonId: number, week: number): Promise<{ locked: boolean; gamesLocked: number }> {
  const [season] = await db.select().from(seasons).where(eq(seasons.id, seasonId)).limit(1);
  if (!season) return { locked: false, gamesLocked: 0 };

  const threshold = await computeLockThreshold(
    seasonId, week, season.lineLockDayOfWeek, season.lineLockHour, season.lineLockTimezone,
  );
  if (!threshold || new Date() < threshold) return { locked: false, gamesLocked: 0 };

  const locked = await db
    .update(games)
    .set({ linesLockedAt: new Date() })
    .where(and(eq(games.seasonId, seasonId), eq(games.week, week), isNull(games.linesLockedAt)))
    .returning({ id: games.id });

  return { locked: true, gamesLocked: locked.length };
}

/** Admin override: lock a week's lines right now, regardless of the configured schedule. */
export async function lockWeekNow(seasonId: number, week: number): Promise<{ gamesLocked: number }> {
  const locked = await db
    .update(games)
    .set({ linesLockedAt: new Date() })
    .where(and(eq(games.seasonId, seasonId), eq(games.week, week), isNull(games.linesLockedAt)))
    .returning({ id: games.id });
  return { gamesLocked: locked.length };
}

/** Admin override: unlock a week's lines (re-opens them to automatic ESPN sync and hides them from picking). */
export async function unlockWeek(seasonId: number, week: number): Promise<{ gamesUnlocked: number }> {
  const unlocked = await db
    .update(games)
    .set({ linesLockedAt: null })
    .where(and(eq(games.seasonId, seasonId), eq(games.week, week)))
    .returning({ id: games.id });
  return { gamesUnlocked: unlocked.length };
}
