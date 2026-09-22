'use server';

import ExcelJS from 'exceljs';
import { cookies } from 'next/headers';
import { db } from '@/app/lib/db';
import { participants, seasons, games, picks, systemSettings, payoutTiers, weekTemplates, pushSubscriptions, type PickType, type PickSelection } from '@/app/lib/db/schema';
import { eq, and, isNotNull, asc, sql, lte } from 'drizzle-orm';
import { auth0 } from '@/app/lib/auth0';
import { isAdmin } from '@/app/lib/auth-utils';
import { isEffectiveAdmin, ADMIN_MODE_COOKIE } from '@/app/lib/admin-mode';
import { gradePick, gradeSpreadPick, gradeTotalPick } from '@/app/lib/grading';
import { isPickLocked } from '@/app/lib/pick-lock';
import { syncWeekGames } from '@/app/lib/espn-api';
import { computeLockThresholdFromEarliestGame } from '@/app/lib/lines-lock';
import { FIRST_GAME_ROW, LAST_GAME_ROW } from '@/app/lib/template-layout';
import { teamAbbrevFromFullName } from '@/app/lib/team-names';
import { computeIncompletePicksForWeek } from '@/app/lib/picks-status';
import {
  computeParticipantWeekStats,
  computeWeeklyStandings,
  computeSeasonStandings,
  type RawPick,
  type WeekCompleteMap,
  type PayoutConfig,
  type WeeklyStandingsRow,
  type SeasonStandingsRow,
} from '@/app/lib/standings-calc';

export async function getOrCreateActiveSeason() {
  try {
    // Try to find an active season
    const activeSeason = await db
      .select()
      .from(seasons)
      .where(eq(seasons.isActive, true))
      .limit(1);

    if (activeSeason.length > 0) {
      return activeSeason[0];
    }

    // No active season, create one for the current year
    const year = new Date().getFullYear();
    const newSeason = await db
      .insert(seasons)
      .values({
        year,
        name: `${year} Regular Season`,
        isActive: true,
      })
      .returning();

    return newSeason[0];
  } catch (error) {
    console.error('Failed to get or create active season:', error);
    throw error;
  }
}

export async function getParticipants() {
  try {
    return await db.select().from(participants);
  } catch (error) {
    console.error('Failed to fetch participants:', error);
    throw new Error('Failed to fetch participants');
  }
}

export async function getParticipantById(id: number) {
  try {
    const result = await db
      .select()
      .from(participants)
      .where(eq(participants.id, id))
      .limit(1);

    return result[0] || null;
  } catch (error) {
    console.error('Failed to fetch participant:', error);
    return null;
  }
}

export async function getParticipantByAuth0Id(auth0Id: string) {
  try {
    const result = await db
      .select()
      .from(participants)
      .where(eq(participants.auth0Id, auth0Id))
      .limit(1);

    return result[0] || null;
  } catch (error) {
    console.error('Failed to fetch participant:', error);
    throw new Error('Failed to fetch participant');
  }
}

export async function getParticipantsByAuth0Id(auth0Id: string) {
  try {
    return await db
      .select()
      .from(participants)
      .where(and(eq(participants.auth0Id, auth0Id), eq(participants.isActive, true)))
      .orderBy(asc(participants.createdAt));
  } catch (error) {
    console.error('Failed to fetch participants:', error);
    return [];
  }
}

export async function claimParticipantAccount(participantId: number, auth0Id: string) {
  try {
    // Check if this specific participant is already claimed by someone
    const participant = await db
      .select()
      .from(participants)
      .where(eq(participants.id, participantId))
      .limit(1);

    if (participant.length === 0) {
      return { success: false, error: 'Participant not found' };
    }

    if (participant[0].auth0Id) {
      return { success: false, error: 'This participant has already been claimed' };
    }

    // Update the participant
    await db
      .update(participants)
      .set({ auth0Id })
      .where(eq(participants.id, participantId));

    return { success: true };
  } catch (error) {
    console.error('Failed to claim account:', error);
    return { success: false, error: 'Failed to claim account' };
  }
}

// --- Admin: participant management ---

export async function createParticipant(name: string, email: string | null) {
  try {
    if (!name.trim()) {
      return { success: false, error: 'Name is required' };
    }
    await db.insert(participants).values({ name: name.trim(), email: email?.trim() || null });
    return { success: true };
  } catch (error) {
    console.error('Failed to create participant:', error);
    return { success: false, error: 'Failed to create participant' };
  }
}

export async function unclaimParticipant(participantId: number) {
  try {
    await db.update(participants).set({ auth0Id: null }).where(eq(participants.id, participantId));
    return { success: true };
  } catch (error) {
    console.error('Failed to unclaim participant:', error);
    return { success: false, error: 'Failed to unclaim participant' };
  }
}

export async function setParticipantActive(participantId: number, isActive: boolean) {
  try {
    await db.update(participants).set({ isActive }).where(eq(participants.id, participantId));
    return { success: true };
  } catch (error) {
    console.error('Failed to update participant:', error);
    return { success: false, error: 'Failed to update participant' };
  }
}

// --- Picks ---

/** Games a participant can actually pick this week — locked (frozen + visible) only. */
export async function getWeekGamesForPicking(seasonId: number, week: number) {
  return db
    .select()
    .from(games)
    .where(and(eq(games.seasonId, seasonId), eq(games.week, week), isNotNull(games.linesLockedAt)))
    .orderBy(asc(games.gameTime));
}

export async function getPicksForParticipantWeek(participantId: number, seasonId: number, week: number) {
  return db
    .select()
    .from(picks)
    .where(and(eq(picks.participantId, participantId), eq(picks.seasonId, seasonId), eq(picks.week, week)));
}

export async function requireCanEditParticipant(participantId: number) {
  const session = await auth0.getSession();
  if (!session?.user) return { ok: false as const, error: 'Not logged in' };

  const participant = await getParticipantById(participantId);
  if (!participant) return { ok: false as const, error: 'Participant not found' };

  // Admin-editing-someone-else's-picks only kicks in with Admin Mode on (see admin-mode.ts) —
  // an admin with the mode off can only edit their own entry, same as any other participant.
  const admin = await isEffectiveAdmin(session.user);
  const canEdit = participant.auth0Id === session.user.sub || admin;
  if (!canEdit) return { ok: false as const, error: "That's not your picks to edit" };

  return { ok: true as const, isAdmin: admin };
}

// --- Participant self-service settings (entry name/email/notification prefs) ---

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Owner (or Admin-Mode admin) edits their own entry's name/email/notification prefs — same auth gate as picks editing. */
export async function updateMyParticipant(
  participantId: number,
  fields: { name: string; email: string; notificationsEnabled: boolean; notificationChannel: 'email' | 'push' },
) {
  const auth = await requireCanEditParticipant(participantId);
  if (!auth.ok) return { success: false, error: auth.error };

  const name = fields.name.trim();
  const email = fields.email.trim();
  if (!name) return { success: false, error: 'Entry name is required' };
  if (email && !EMAIL_SHAPE.test(email)) return { success: false, error: 'That email address doesn\'t look right' };

  await db
    .update(participants)
    .set({
      name,
      email: email || null,
      notificationsEnabled: fields.notificationsEnabled,
      notificationChannel: fields.notificationChannel,
      updatedAt: new Date(),
    })
    .where(eq(participants.id, participantId));

  return { success: true };
}

/** Stores/updates a browser's push subscription for this participant — called after the client completes the PushManager.subscribe() handshake. */
export async function savePushSubscription(
  participantId: number,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
) {
  const auth = await requireCanEditParticipant(participantId);
  if (!auth.ok) return { success: false, error: auth.error };

  if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    return { success: false, error: 'Invalid push subscription' };
  }

  await db
    .insert(pushSubscriptions)
    .values({
      participantId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { participantId, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
    });

  return { success: true };
}

/** Removes one browser's push subscription — called when a user turns push off on that device. */
export async function removePushSubscription(participantId: number, endpoint: string) {
  const auth = await requireCanEditParticipant(participantId);
  if (!auth.ok) return { success: false, error: auth.error };

  await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.participantId, participantId), eq(pushSubscriptions.endpoint, endpoint)));
  return { success: true };
}

/**
 * Sets (inserts or changes) one pick. Validates: viewer owns this participant
 * (or is admin), the game belongs to the given season/week, its lines are
 * locked/visible, the game itself isn't pick-locked (past kickoff — locked
 * means locked for EVERYONE, admins included; an admin's only way past it is
 * to explicitly toggle the game unlocked first via setGamePickLock), a line
 * exists for the requested pick type, and — only when this would be a NEW
 * pick, not changing an existing one — the season's picksPerWeek cap isn't
 * already reached.
 */
export async function setPick(
  participantId: number,
  seasonId: number,
  week: number,
  gameId: number,
  pickType: PickType,
  selection: string,
) {
  const auth = await requireCanEditParticipant(participantId);
  if (!auth.ok) return { success: false, error: auth.error };

  const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
  if (!game || game.seasonId !== seasonId || game.week !== week) {
    return { success: false, error: 'Invalid game' };
  }
  if (!game.linesLockedAt) {
    return { success: false, error: "This game's lines aren't locked/visible yet" };
  }
  if (isPickLocked(game)) {
    return { success: false, error: 'This game is locked — an admin must unlock it before picks can change' };
  }
  const line = pickType === 'spread' ? game.spread : game.overUnder;
  if (line == null) {
    return { success: false, error: 'No line available for this pick type' };
  }

  const existing = await db
    .select({ id: picks.id })
    .from(picks)
    .where(and(eq(picks.participantId, participantId), eq(picks.gameId, gameId), eq(picks.pickType, pickType)))
    .limit(1);

  if (existing.length === 0) {
    const [season] = await db.select().from(seasons).where(eq(seasons.id, seasonId)).limit(1);
    const cap = season?.picksPerWeek ?? 6;
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(picks)
      .where(and(eq(picks.participantId, participantId), eq(picks.seasonId, seasonId), eq(picks.week, week)));
    if (count >= cap) {
      return { success: false, error: `You already have ${cap} picks this week — remove one first` };
    }
  }

  try {
    await db
      .insert(picks)
      .values({ participantId, seasonId, gameId, week, pickType, selection, lineAtPick: line })
      .onConflictDoUpdate({
        target: [picks.participantId, picks.gameId, picks.pickType],
        set: { selection, lineAtPick: line, updatedAt: new Date() },
      });
    return { success: true };
  } catch (error) {
    console.error('Failed to set pick:', error);
    return { success: false, error: 'Failed to save pick' };
  }
}

export async function removePick(participantId: number, gameId: number, pickType: PickType) {
  const auth = await requireCanEditParticipant(participantId);
  if (!auth.ok) return { success: false, error: auth.error };

  const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
  if (game && isPickLocked(game)) {
    return { success: false, error: 'This game is locked — an admin must unlock it before picks can change' };
  }

  await db
    .delete(picks)
    .where(and(eq(picks.participantId, participantId), eq(picks.gameId, gameId), eq(picks.pickType, pickType)));

  return { success: true };
}

/** Admin: explicitly force a game's pick-lock to a state, overriding the automatic kickoff-time default. */
export async function setGamePickLock(gameId: number, locked: boolean) {
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  await db.update(games).set({ pickLockOverride: locked, updatedAt: new Date() }).where(eq(games.id, gameId));
  return { success: true };
}

/**
 * Combined fetch for the picks UI — this week's pickable games plus this participant's
 * existing picks. The viewer only sees the FULL pick list when it's their own entry (or
 * they're admin); otherwise picks for games that haven't kicked off yet (per isPickLocked)
 * are withheld, same as they'd be blank on the pick board. Viewer identity is derived from
 * the session server-side, not trusted from the caller — this is a public server action.
 */
export async function getWeekBoardData(participantId: number, seasonId: number, week: number) {
  const [weekGames, weekPicks, session, participant] = await Promise.all([
    getWeekGamesForPicking(seasonId, week),
    getPicksForParticipantWeek(participantId, seasonId, week),
    auth0.getSession(),
    getParticipantById(participantId),
  ]);

  const isOwner = !!session?.user?.sub && participant?.auth0Id === session.user.sub;
  const canSeeAll = isOwner || (await isEffectiveAdmin(session?.user));
  if (canSeeAll) {
    return { games: weekGames, picks: weekPicks };
  }

  const gameById = new Map(weekGames.map((g) => [g.id, g]));
  const visiblePicks = weekPicks.filter((p) => {
    const game = gameById.get(p.gameId);
    return game ? isPickLocked(game) : false;
  });
  return { games: weekGames, picks: visiblePicks };
}

// --- Grading + standings ---

/**
 * Re-grades EVERY pick in this (season, week) from scratch — not just
 * pending ones — so a corrected score or an edited line self-heals. Only
 * writes rows whose result actually changed. Idempotent; safe to re-run.
 */
export async function gradeWeek(seasonId: number, week: number) {
  const weekPicks = await db
    .select({
      id: picks.id,
      pickType: picks.pickType,
      selection: picks.selection,
      currentResult: picks.result,
      gameIsFinal: games.isFinal,
      gameSpread: games.spread,
      gameOverUnder: games.overUnder,
      gameHomeScore: games.homeScore,
      gameAwayScore: games.awayScore,
    })
    .from(picks)
    .innerJoin(games, eq(picks.gameId, games.id))
    .where(and(eq(picks.seasonId, seasonId), eq(picks.week, week)));

  let graded = 0;
  let changed = 0;
  const byResult: Record<string, number> = { pending: 0, win: 0, loss: 0, push: 0, void: 0 };

  for (const p of weekPicks) {
    const newResult = gradePick(
      { pickType: p.pickType as PickType, selection: p.selection },
      {
        isFinal: p.gameIsFinal,
        spread: p.gameSpread,
        overUnder: p.gameOverUnder,
        homeScore: p.gameHomeScore,
        awayScore: p.gameAwayScore,
      },
    );
    byResult[newResult] = (byResult[newResult] ?? 0) + 1;
    graded += 1;

    if (newResult !== p.currentResult) {
      changed += 1;
      await db.update(picks).set({ result: newResult, gradedAt: new Date() }).where(eq(picks.id, p.id));
    }
  }

  return { graded, changed, byResult };
}

export async function gradeSeason(seasonId: number) {
  const [season] = await db.select().from(seasons).where(eq(seasons.id, seasonId)).limit(1);
  if (!season) return { graded: 0, changed: 0 };

  let totalGraded = 0;
  let totalChanged = 0;
  for (let week = season.firstWeek; week <= season.lastWeek; week++) {
    const result = await gradeWeek(seasonId, week);
    totalGraded += result.graded;
    totalChanged += result.changed;
  }
  return { graded: totalGraded, changed: totalChanged };
}

// --- Standings (Weekly / Season tabs) ---

export interface StandingsRawData {
  season: typeof seasons.$inferSelect;
  participantIds: number[];
  participantNames: Map<number, string>;
  rawPicks: RawPick[];
  weekComplete: WeekCompleteMap;
  payoutConfig: PayoutConfig;
  currentWeek: number | null;
}

/** Shared raw fetch feeding both the Weekly and Season standings tabs — see app/lib/standings-calc.ts for the actual math. */
export async function getStandingsRawData(seasonId: number): Promise<StandingsRawData> {
  const [season, activeParticipants, seasonPicks, seasonGames, tiers] = await Promise.all([
    db.select().from(seasons).where(eq(seasons.id, seasonId)).limit(1).then((r) => r[0]),
    db.select({ id: participants.id, name: participants.name }).from(participants).where(eq(participants.isActive, true)),
    db.select({ participantId: picks.participantId, week: picks.week, result: picks.result }).from(picks).where(eq(picks.seasonId, seasonId)),
    db.select({ week: games.week, isFinal: games.isFinal, gameTime: games.gameTime }).from(games).where(eq(games.seasonId, seasonId)),
    db.select({ rank: payoutTiers.rank, percentage: payoutTiers.percentage }).from(payoutTiers).where(eq(payoutTiers.seasonId, seasonId)),
  ]);

  if (!season) throw new Error('Season not found');

  // ESPN's schedule is synced for the whole season well in advance, so "does this week have
  // any game row" is true for nearly every week almost immediately — useless for picking a
  // default week. What actually matters is whether the week's pick cycle has STARTED — reuse
  // the same lock-threshold moment that already governs when a week's lines unlock (default
  // Tuesday 7am Central, admin-configurable in /admin/seasons), so "current week" and "lines
  // are open" flip at the same, single, configured instant instead of two independent rules.
  const gamesByWeek = new Map<number, { total: number; final: number; earliestGameTime: Date | null }>();
  for (const g of seasonGames) {
    const entry = gamesByWeek.get(g.week) ?? { total: 0, final: 0, earliestGameTime: null };
    entry.total += 1;
    if (g.isFinal) entry.final += 1;
    if (g.gameTime && (!entry.earliestGameTime || g.gameTime < entry.earliestGameTime)) entry.earliestGameTime = g.gameTime;
    gamesByWeek.set(g.week, entry);
  }
  const now = new Date();
  const weekComplete: WeekCompleteMap = {};
  let currentWeek: number | null = null;
  for (let week = season.firstWeek; week <= season.lastWeek; week++) {
    const entry = gamesByWeek.get(week);
    weekComplete[week] = !!entry && entry.total > 0 && entry.final === entry.total;
    if (entry?.earliestGameTime) {
      const threshold = computeLockThresholdFromEarliestGame(
        entry.earliestGameTime,
        season.lineLockDayOfWeek,
        season.lineLockHour,
        season.lineLockTimezone,
      );
      if (threshold <= now) currentWeek = week;
    }
  }

  return {
    season,
    participantIds: activeParticipants.map((p) => p.id),
    participantNames: new Map(activeParticipants.map((p) => [p.id, p.name])),
    rawPicks: seasonPicks as RawPick[],
    weekComplete,
    payoutConfig: {
      entryFee: season.entryFee,
      weeklyPotPerWeek: season.weeklyPotPerWeek,
      lostPicksPrizeAmount: season.lostPicksPrizeAmount,
      numWeeksInSeason: season.lastWeek - season.firstWeek + 1,
      tiers,
    },
    currentWeek,
  };
}

/** The week the standings views should default to — the current pick cycle (see the lock-threshold comment above), falling back to the season's first week. */
export async function getLatestStandingsWeek(seasonId: number): Promise<number> {
  const raw = await getStandingsRawData(seasonId);
  return raw.currentWeek ?? raw.season.firstWeek;
}

export interface WeeklyStandingsDisplayRow extends WeeklyStandingsRow {
  name: string;
}

export async function getWeeklyStandings(seasonId: number, week: number): Promise<WeeklyStandingsDisplayRow[]> {
  const raw = await getStandingsRawData(seasonId);
  const weekStats = computeParticipantWeekStats(raw.rawPicks, raw.participantIds, raw.weekComplete, raw.season.picksPerWeek);
  const rows = computeWeeklyStandings(weekStats, week);
  return rows.map((r) => ({ ...r, name: raw.participantNames.get(r.participantId) ?? 'Unknown' }));
}

export interface SeasonStandingsDisplayRow extends SeasonStandingsRow {
  name: string;
}

export async function getSeasonStandings(seasonId: number, uptoWeek?: number): Promise<SeasonStandingsDisplayRow[]> {
  const raw = await getStandingsRawData(seasonId);
  const effectiveUptoWeek = uptoWeek ?? raw.currentWeek ?? raw.season.firstWeek;
  const weekStats = computeParticipantWeekStats(raw.rawPicks, raw.participantIds, raw.weekComplete, raw.season.picksPerWeek);
  const rows = computeSeasonStandings(weekStats, raw.participantIds, raw.weekComplete, effectiveUptoWeek, raw.season.picksPerWeek, raw.payoutConfig);
  return rows.map((r) => ({ ...r, name: raw.participantNames.get(r.participantId) ?? 'Unknown' }));
}

// --- Admin: season + payout settings ---

export async function updateSeasonSettings(
  seasonId: number,
  settings: {
    picksPerWeek: number;
    firstWeek: number;
    lastWeek: number;
    lineLockDayOfWeek: number;
    lineLockHour: number;
    lineLockTimezone: string;
    entryFee: number;
    weeklyPotPerWeek: number;
    lostPicksPrizeAmount: number;
  },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  await db.update(seasons).set(settings).where(eq(seasons.id, seasonId));
  return { success: true };
}

export async function getPayoutTiers(seasonId: number) {
  return db.select().from(payoutTiers).where(eq(payoutTiers.seasonId, seasonId)).orderBy(asc(payoutTiers.rank));
}

/** Replace-all: admin submits the full tier list each time (small list, simpler than diffing). */
export async function setPayoutTiers(seasonId: number, tiers: { rank: number; percentage: number }[]) {
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  await db.transaction(async (tx) => {
    await tx.delete(payoutTiers).where(eq(payoutTiers.seasonId, seasonId));
    if (tiers.length > 0) {
      await tx.insert(payoutTiers).values(tiers.map((t) => ({ seasonId, rank: t.rank, percentage: t.percentage })));
    }
  });
  return { success: true };
}

// --- Admin: results ---

async function requireAdmin() {
  const session = await auth0.getSession();
  if (!session?.user || !isAdmin(session.user)) return { ok: false as const, error: 'Admins only' };
  return { ok: true as const };
}

// --- Admin Mode toggle (see admin-mode.ts) ---

/** Whether Admin Mode is currently on for the logged-in admin — false for anyone else. */
export async function getAdminMode(): Promise<boolean> {
  const session = await auth0.getSession();
  return isEffectiveAdmin(session?.user);
}

/** Flips the Admin Mode cookie — re-checks real adminship server-side, ignoring whatever the client claims. */
export async function setAdminMode(on: boolean) {
  const session = await auth0.getSession();
  if (!session?.user || !isAdmin(session.user)) {
    return { success: false, error: 'Admins only' };
  }
  const store = await cookies();
  store.set(ADMIN_MODE_COOKIE, on ? 'on' : 'off', {
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  });
  return { success: true };
}

export async function getGamesForWeek(seasonId: number, week: number) {
  return db
    .select()
    .from(games)
    .where(and(eq(games.seasonId, seasonId), eq(games.week, week)))
    .orderBy(asc(games.gameTime));
}

// --- Admin: weekly picks status (who hasn't finished their picks) ---

export interface PicksStatusRow {
  participantId: number;
  name: string;
  pickCount: number;
}

/** Admin-facing view of computeIncompletePicksForWeek — strips email/notification fields that helper also carries for reminders.ts's use. */
export async function getIncompletePicksForWeek(seasonId: number, week: number): Promise<{ picksPerWeek: number; rows: PicksStatusRow[] }> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  const result = await computeIncompletePicksForWeek(seasonId, week);
  return {
    picksPerWeek: result.picksPerWeek,
    rows: result.rows.map(({ participantId, name, pickCount }) => ({ participantId, name, pickCount })),
  };
}

// --- Manual results refresh (end-user "refresh" button, app-wide cooldown) ---

const REFRESH_COOLDOWN_MS = 60_000;
const LAST_MANUAL_REFRESH_KEY = 'last_manual_refresh';

/**
 * Syncs scores from ESPN for any week with a kicked-off-but-not-yet-final game,
 * then re-grades every week that has ever had a final game (grading is cheap
 * and idempotent — no reason to gate it behind the sync check, which would
 * otherwise leave an early week's finished games ungraded while that same
 * week's later games haven't kicked off yet). So results/standings don't have
 * to wait for the next daily cron. Rate limited app-wide (not per-user) via
 * systemSettings, since the sync half fans out to ESPN requests — anyone
 * mashing the button shouldn't be able to hammer it.
 */
export async function refreshResults() {
  const session = await auth0.getSession();
  if (!session?.user) return { success: false as const, error: 'Not logged in' };

  const now = new Date();
  const [setting] = await db.select().from(systemSettings).where(eq(systemSettings.key, LAST_MANUAL_REFRESH_KEY)).limit(1);
  const lastRun = setting?.value ? new Date(setting.value) : null;
  if (lastRun && now.getTime() - lastRun.getTime() < REFRESH_COOLDOWN_MS) {
    const retryAfterSeconds = Math.ceil((REFRESH_COOLDOWN_MS - (now.getTime() - lastRun.getTime())) / 1000);
    return { success: false as const, error: `Please wait ${retryAfterSeconds}s before refreshing again`, retryAfterSeconds };
  }

  // Claim the slot before doing any work so two near-simultaneous clicks from
  // different users don't both slip past the check above.
  await db
    .insert(systemSettings)
    .values({ key: LAST_MANUAL_REFRESH_KEY, value: now.toISOString() })
    .onConflictDoUpdate({ target: systemSettings.key, set: { value: now.toISOString(), updatedAt: now } });

  const [activeSeason] = await db.select().from(seasons).where(eq(seasons.isActive, true)).limit(1);
  if (!activeSeason) return { success: true as const, weeksSynced: 0, graded: 0, changed: 0 };

  // Weeks worth an ESPN call: something's kicked off but ESPN hasn't told us it's final yet.
  const weeksNeedingSync = await db
    .selectDistinct({ week: games.week })
    .from(games)
    .where(and(eq(games.seasonId, activeSeason.id), lte(games.gameTime, now), eq(games.isFinal, false)));

  for (const { week } of weeksNeedingSync) {
    try {
      await syncWeekGames(activeSeason.id, activeSeason.year, week);
    } catch (error) {
      console.error(`Manual refresh: ESPN sync failed for week ${week}:`, error);
    }
  }

  // Grading is cheap (pure DB, no ESPN calls) and idempotent, so grade every week that has
  // EVER had a final game — not just weeks that just got synced. A week can have some games
  // final (e.g. Wednesday/Thursday openers) while its Sunday games haven't kicked off yet,
  // which would make weeksNeedingSync empty for that week even though its finished games'
  // picks still need grading.
  const weeksWithFinalGames = await db
    .selectDistinct({ week: games.week })
    .from(games)
    .where(and(eq(games.seasonId, activeSeason.id), eq(games.isFinal, true)));

  const weeksToGrade = new Set([...weeksNeedingSync.map((w) => w.week), ...weeksWithFinalGames.map((w) => w.week)]);

  let totalGraded = 0;
  let totalChanged = 0;
  for (const week of weeksToGrade) {
    const result = await gradeWeek(activeSeason.id, week);
    totalGraded += result.graded;
    totalChanged += result.changed;
  }

  return { success: true as const, weeksSynced: weeksNeedingSync.length, graded: totalGraded, changed: totalChanged };
}

/** Admin manual override of a game's final score/status — independent of the lines lock. */
export async function setGameResult(gameId: number, homeScore: number | null, awayScore: number | null, isFinal: boolean) {
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  await db
    .update(games)
    .set({ homeScore, awayScore, isFinal, updatedAt: new Date() })
    .where(eq(games.id, gameId));

  return { success: true };
}

// --- Commissioner xlsx export (bridge until the commissioner accepts picks in-app) ---

export interface PicksExportGame {
  gameTime: Date | null;
  awayTeam: string;
  homeTeam: string;
  spread: number | null;
  overUnder: number | null;
  spreadSelection: 'home' | 'away' | null;
  overUnderSelection: 'over' | 'under' | null;
}

/**
 * One participant's full week — every scheduled game (not just picked ones,
 * matching the commissioner's spreadsheet layout) with that participant's
 * spread/O-U marks, if any, merged in. A participant may pick both the
 * spread AND the O/U on the same game, so both selections are carried
 * independently rather than a single "the pick" per game.
 */
export async function getPicksExportData(participantId: number, seasonId: number, week: number) {
  const [participant, weekGames, weekPicks] = await Promise.all([
    getParticipantById(participantId),
    getGamesForWeek(seasonId, week),
    getPicksForParticipantWeek(participantId, seasonId, week),
  ]);
  if (!participant) throw new Error('Participant not found');

  const picksByGame = new Map<number, { spread?: PickSelection; overUnder?: PickSelection }>();
  for (const p of weekPicks) {
    const entry = picksByGame.get(p.gameId) ?? {};
    if (p.pickType === 'spread') entry.spread = p.selection as PickSelection;
    else entry.overUnder = p.selection as PickSelection;
    picksByGame.set(p.gameId, entry);
  }

  const exportGames: PicksExportGame[] = weekGames.map((g) => {
    const pick = picksByGame.get(g.id);
    return {
      gameTime: g.gameTime,
      awayTeam: g.awayTeam,
      homeTeam: g.homeTeam,
      spread: g.spread,
      overUnder: g.overUnder,
      spreadSelection: (pick?.spread as 'home' | 'away' | undefined) ?? null,
      overUnderSelection: (pick?.overUnder as 'over' | 'under' | undefined) ?? null,
    };
  });

  return { participant, exportGames };
}

// --- Week templates (admin-uploaded weekly pickem spreadsheet, see xlsx-export.ts) ---

export interface WeekTemplateInfo {
  week: number;
  fileName: string;
  uploadedBy: string | null;
  uploadedAt: Date;
}

/** Which weeks of this season have a custom uploaded template, most recent first. */
export async function listWeekTemplates(seasonId: number): Promise<WeekTemplateInfo[]> {
  const rows = await db
    .select({
      week: weekTemplates.week,
      fileName: weekTemplates.fileName,
      uploadedBy: weekTemplates.uploadedBy,
      uploadedAt: weekTemplates.uploadedAt,
    })
    .from(weekTemplates)
    .where(eq(weekTemplates.seasonId, seasonId))
    .orderBy(asc(weekTemplates.week));
  return rows;
}

/**
 * Admin uploads that week's commissioner spreadsheet (FormData: seasonId, week, file).
 * Replaces any existing template for that week. generatePicksWorkbook() only ever
 * overwrites the fixed data cells (see xlsx-export.ts) — everything else in the uploaded
 * file, including quips/branding/game ordering, passes through untouched. It must still
 * keep the same "Week N" header cell and B7:N22 game-row layout as the default template,
 * or exported picks will land in the wrong cells.
 */
export async function uploadWeekTemplate(formData: FormData) {
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  const seasonId = Number(formData.get('seasonId'));
  const week = Number(formData.get('week'));
  const file = formData.get('file');
  if (!seasonId || !week || !(file instanceof File)) {
    return { success: false, error: 'seasonId, week, and file are required' };
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  try {
    const wb = new ExcelJS.Workbook();
    // exceljs's bundled ambient Buffer type conflicts with @types/node's newer generic
    // Buffer<T> via global declaration merging — structurally fine at runtime, so `any` here.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(buffer as any);
    if (!wb.getWorksheet('Sheet1')) {
      return { success: false, error: 'That file has no "Sheet1" tab — is this the right template?' };
    }
  } catch {
    return { success: false, error: 'Not a valid .xlsx file' };
  }

  const session = await auth0.getSession();
  const uploadedBy = session?.user?.name ?? session?.user?.email ?? null;

  await db
    .insert(weekTemplates)
    .values({ seasonId, week, fileName: file.name, fileData: buffer.toString('base64'), uploadedBy })
    .onConflictDoUpdate({
      target: [weekTemplates.seasonId, weekTemplates.week],
      set: { fileName: file.name, fileData: buffer.toString('base64'), uploadedBy, uploadedAt: new Date() },
    });

  return { success: true };
}

/** Reverts a week to the default static template. */
export async function deleteWeekTemplate(seasonId: number, week: number) {
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  await db.delete(weekTemplates).where(and(eq(weekTemplates.seasonId, seasonId), eq(weekTemplates.week, week)));
  return { success: true };
}

/** The raw uploaded template bytes for a week, if an admin has uploaded one — else null (caller falls back to the default). */
export async function getWeekTemplateBuffer(seasonId: number, week: number): Promise<Buffer | null> {
  const [row] = await db
    .select({ fileData: weekTemplates.fileData })
    .from(weekTemplates)
    .where(and(eq(weekTemplates.seasonId, seasonId), eq(weekTemplates.week, week)))
    .limit(1);
  return row ? Buffer.from(row.fileData, 'base64') : null;
}

export interface TemplateLineImport {
  gameId: number;
  awayTeam: string;
  homeTeam: string;
  spread: number | null;
  overUnder: number | null;
}

/**
 * Reads the spread/O-U the commissioner already typed into that week's uploaded template
 * (columns H/I of the game rows, see template-layout.ts) and matches each row back to a
 * game via its team names, so an admin doesn't have to retype lines the template already
 * has. Read-only — the admin lines page applies results to individual rows via the normal
 * save. Rows whose teams don't match any game for the week (typo, bye week, etc.) are
 * silently skipped and counted in unmatchedRows for the UI to surface.
 */
export async function getTemplateLinesForWeek(
  seasonId: number,
  week: number,
): Promise<{ available: boolean; matched: TemplateLineImport[]; unmatchedRows: number }> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  const buffer = await getWeekTemplateBuffer(seasonId, week);
  if (!buffer) return { available: false, matched: [], unmatchedRows: 0 };

  const wb = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await wb.xlsx.load(buffer as any);
  const sheet = wb.getWorksheet('Sheet1');
  if (!sheet) return { available: false, matched: [], unmatchedRows: 0 };

  const weekGames = await getGamesForWeek(seasonId, week);
  const gameByMatchup = new Map(weekGames.map((g) => [`${g.awayTeam}@${g.homeTeam}`, g]));

  const matched: TemplateLineImport[] = [];
  let unmatchedRows = 0;

  for (let row = FIRST_GAME_ROW; row <= LAST_GAME_ROW; row++) {
    const awayCell = sheet.getCell(`E${row}`).value;
    const homeCell = sheet.getCell(`G${row}`).value;
    if (!awayCell || !homeCell) continue; // blank trailing row

    const awayAbbrev = teamAbbrevFromFullName(String(awayCell));
    const homeAbbrev = teamAbbrevFromFullName(String(homeCell));
    const game = awayAbbrev && homeAbbrev ? gameByMatchup.get(`${awayAbbrev}@${homeAbbrev}`) : undefined;
    if (!game) {
      unmatchedRows++;
      continue;
    }

    const spreadCell = sheet.getCell(`H${row}`).value;
    const overUnderCell = sheet.getCell(`I${row}`).value;
    matched.push({
      gameId: game.id,
      awayTeam: game.awayTeam,
      homeTeam: game.homeTeam,
      spread: typeof spreadCell === 'number' ? spreadCell : null,
      overUnder: typeof overUnderCell === 'number' ? overUnderCell : null,
    });
  }

  return { available: true, matched, unmatchedRows };
}

// --- Pick board (everyone's picks for a week, once lines are locked) ---

export interface BoardPickEntry {
  participantId: number;
  name: string;
}

export interface BoardGameRow {
  id: number;
  gameTime: Date | null;
  awayTeam: string;
  homeTeam: string;
  spread: number | null;
  overUnder: number | null;
  homeScore: number | null;
  awayScore: number | null;
  isFinal: boolean;
  // The side that actually covered/hit, once final — not tied to who picked what, so a side
  // with zero picks still colors correctly. null until the game is final and scored.
  spreadWinner: 'home' | 'away' | 'push' | null;
  totalWinner: 'over' | 'under' | 'push' | null;
  // awayScore - homeScore and awayScore + homeScore, once final — lets the board show "how far
  // off the line the actual result landed" at a glance, matching the commissioner's sheet.
  actualMargin: number | null;
  actualTotal: number | null;
  awayPicks: BoardPickEntry[];
  homePicks: BoardPickEntry[];
  underPicks: BoardPickEntry[];
  overPicks: BoardPickEntry[];
}

/**
 * Everyone's picks for one week, games in kickoff order — only locked (visible) games,
 * matching what participants could actually see when picking. Games that haven't kicked
 * off yet (per isPickLocked) show zero picks/names for everyone, not just the current
 * viewer — opponents' picks stay private until kickoff, same rule the picks page enforces
 * for viewing someone else's entry.
 */
export async function getBoardData(seasonId: number, week: number): Promise<BoardGameRow[]> {
  const [weekGames, weekPicks] = await Promise.all([
    getWeekGamesForPicking(seasonId, week),
    db
      .select({
        gameId: picks.gameId,
        pickType: picks.pickType,
        selection: picks.selection,
        participantId: picks.participantId,
        name: participants.name,
      })
      .from(picks)
      .innerJoin(participants, eq(picks.participantId, participants.id))
      .where(and(eq(picks.seasonId, seasonId), eq(picks.week, week))),
  ]);

  return weekGames.map((g) => {
    const gamePicks = isPickLocked(g) ? weekPicks.filter((p) => p.gameId === g.id) : [];
    const entry = (participantId: number, name: string): BoardPickEntry => ({ participantId, name });

    const scored = g.isFinal && g.homeScore != null && g.awayScore != null;

    let spreadWinner: BoardGameRow['spreadWinner'] = null;
    if (scored && g.spread != null) {
      const grade = gradeSpreadPick('home', g.spread, g.homeScore!, g.awayScore!);
      spreadWinner = grade === 'push' ? 'push' : grade === 'win' ? 'home' : 'away';
    }

    let totalWinner: BoardGameRow['totalWinner'] = null;
    if (scored && g.overUnder != null) {
      const grade = gradeTotalPick('over', g.overUnder, g.homeScore!, g.awayScore!);
      totalWinner = grade === 'push' ? 'push' : grade === 'win' ? 'over' : 'under';
    }

    return {
      id: g.id,
      gameTime: g.gameTime,
      awayTeam: g.awayTeam,
      homeTeam: g.homeTeam,
      spread: g.spread,
      overUnder: g.overUnder,
      homeScore: g.homeScore,
      awayScore: g.awayScore,
      isFinal: g.isFinal,
      spreadWinner,
      totalWinner,
      actualMargin: scored ? g.awayScore! - g.homeScore! : null,
      actualTotal: scored ? g.awayScore! + g.homeScore! : null,
      awayPicks: gamePicks.filter((p) => p.pickType === 'spread' && p.selection === 'away').map((p) => entry(p.participantId, p.name)),
      homePicks: gamePicks.filter((p) => p.pickType === 'spread' && p.selection === 'home').map((p) => entry(p.participantId, p.name)),
      underPicks: gamePicks.filter((p) => p.pickType === 'over_under' && p.selection === 'under').map((p) => entry(p.participantId, p.name)),
      overPicks: gamePicks.filter((p) => p.pickType === 'over_under' && p.selection === 'over').map((p) => entry(p.participantId, p.name)),
    };
  });
}
