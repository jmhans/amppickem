'use server';

import { db } from '@/app/lib/db';
import { participants, seasons, games, picks, systemSettings, type PickType, type PickSelection } from '@/app/lib/db/schema';
import { eq, and, isNotNull, asc, sql, lte } from 'drizzle-orm';
import { auth0 } from '@/app/lib/auth0';
import { isAdmin } from '@/app/lib/auth-utils';
import { gradePick } from '@/app/lib/grading';
import { isPickLocked } from '@/app/lib/pick-lock';
import { syncWeekGames } from '@/app/lib/espn-api';

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
      .where(eq(participants.auth0Id, auth0Id));
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

  const admin = isAdmin(session.user);
  const canEdit = participant.auth0Id === session.user.sub || admin;
  if (!canEdit) return { ok: false as const, error: "That's not your picks to edit" };

  return { ok: true as const, isAdmin: admin };
}

/**
 * Sets (inserts or changes) one pick. Validates: viewer owns this participant
 * (or is admin), the game belongs to the given season/week, its lines are
 * locked/visible, the game itself isn't pick-locked (past kickoff, unless an
 * admin is making the edit — same override philosophy as the weekly lines
 * lock), a line exists for the requested pick type, and — only when this
 * would be a NEW pick, not changing an existing one — the season's
 * picksPerWeek cap isn't already reached.
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
  if (!auth.isAdmin && isPickLocked(game)) {
    return { success: false, error: 'This game is locked — picks close at kickoff' };
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

  if (!auth.isAdmin) {
    const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
    if (game && isPickLocked(game)) {
      return { success: false, error: 'This game is locked — picks close at kickoff' };
    }
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

/** Combined fetch for the picks UI — this week's pickable games plus this participant's existing picks. */
export async function getWeekBoardData(participantId: number, seasonId: number, week: number) {
  const [weekGames, weekPicks] = await Promise.all([
    getWeekGamesForPicking(seasonId, week),
    getPicksForParticipantWeek(participantId, seasonId, week),
  ]);
  return { games: weekGames, picks: weekPicks };
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

export type StandingsRow = {
  participantId: number;
  name: string;
  wins: number;
  losses: number;
  pushes: number;
  pending: number;
  graded: number;
  winPct: number;
};

// Wins desc, then losses asc, then win% desc — pushes excluded from win% denominator.
// Isolated here since tiebreaker rules are explicitly undecided; swap freely later.
function compareStandings(a: StandingsRow, b: StandingsRow): number {
  if (a.wins !== b.wins) return b.wins - a.wins;
  if (a.losses !== b.losses) return a.losses - b.losses;
  return b.winPct - a.winPct;
}

export async function getStandings(seasonId: number): Promise<StandingsRow[]> {
  const rows = await db
    .select({
      participantId: participants.id,
      name: participants.name,
      wins: sql<number>`count(*) filter (where ${picks.result} = 'win')::int`,
      losses: sql<number>`count(*) filter (where ${picks.result} = 'loss')::int`,
      pushes: sql<number>`count(*) filter (where ${picks.result} = 'push')::int`,
      pending: sql<number>`count(*) filter (where ${picks.result} = 'pending')::int`,
    })
    .from(participants)
    .leftJoin(picks, and(eq(picks.participantId, participants.id), eq(picks.seasonId, seasonId)))
    .where(eq(participants.isActive, true))
    .groupBy(participants.id, participants.name);

  const standings: StandingsRow[] = rows.map((r) => ({
    ...r,
    graded: r.wins + r.losses + r.pushes,
    winPct: r.wins + r.losses > 0 ? r.wins / (r.wins + r.losses) : 0,
  }));

  return standings.sort(compareStandings);
}

export type WeeklyRecordRow = {
  participantId: number;
  week: number;
  wins: number;
  losses: number;
  pushes: number;
  pending: number;
  pickCount: number;
};

export async function getWeeklyRecords(seasonId: number): Promise<WeeklyRecordRow[]> {
  return db
    .select({
      participantId: picks.participantId,
      week: picks.week,
      wins: sql<number>`count(*) filter (where ${picks.result} = 'win')::int`,
      losses: sql<number>`count(*) filter (where ${picks.result} = 'loss')::int`,
      pushes: sql<number>`count(*) filter (where ${picks.result} = 'push')::int`,
      pending: sql<number>`count(*) filter (where ${picks.result} = 'pending')::int`,
      pickCount: sql<number>`count(*)::int`,
    })
    .from(picks)
    .where(eq(picks.seasonId, seasonId))
    .groupBy(picks.participantId, picks.week);
}

// --- Admin: results ---

async function requireAdmin() {
  const session = await auth0.getSession();
  if (!session?.user || !isAdmin(session.user)) return { ok: false as const, error: 'Admins only' };
  return { ok: true as const };
}

export async function getGamesForWeek(seasonId: number, week: number) {
  return db
    .select()
    .from(games)
    .where(and(eq(games.seasonId, seasonId), eq(games.week, week)))
    .orderBy(asc(games.gameTime));
}

// --- Manual results refresh (end-user "refresh" button, app-wide cooldown) ---

const REFRESH_COOLDOWN_MS = 60_000;
const LAST_MANUAL_REFRESH_KEY = 'last_manual_refresh';

/**
 * Syncs scores from ESPN + re-grades any week with a kicked-off-but-not-yet-final
 * game, so results/standings don't have to wait for the next daily cron. Rate
 * limited app-wide (not per-user) via systemSettings, since this fans out to
 * ESPN requests and a full grading pass — anyone mashing the button shouldn't
 * be able to hammer either.
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

  const pendingWeeks = await db
    .selectDistinct({ week: games.week })
    .from(games)
    .where(and(eq(games.seasonId, activeSeason.id), lte(games.gameTime, now), eq(games.isFinal, false)));

  let totalGraded = 0;
  let totalChanged = 0;
  for (const { week } of pendingWeeks) {
    try {
      await syncWeekGames(activeSeason.id, activeSeason.year, week);
    } catch (error) {
      console.error(`Manual refresh: ESPN sync failed for week ${week}:`, error);
    }
    const result = await gradeWeek(activeSeason.id, week);
    totalGraded += result.graded;
    totalChanged += result.changed;
  }

  return { success: true as const, weeksSynced: pendingWeeks.length, graded: totalGraded, changed: totalChanged };
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
