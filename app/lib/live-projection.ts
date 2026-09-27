// Plain module (no 'use server') — the GameDay Dashboard's live win-probability projection.
// Deliberately simple: no possession, no end-of-half/game-script modeling, no adjustment for
// today's own in-game pace (a team that's run hot or cold so far tends to change how it plays
// the rest of the way — garbage-time scoring, clock-killing while ahead — so extrapolating
// today's pace forward would actively mislead rather than help). Pace is fixed pregame and
// never updated from the live game; only minutes-remaining shrinks as the game goes, pulling
// both the mean and variance of projected remaining points toward zero.
import { db } from '@/app/lib/db';
import { games } from '@/app/lib/db/schema';
import { and, eq } from 'drizzle-orm';

// Rough NFL-wide full-game (60 min) single-team score standard deviation — one global
// constant, not team-specific; modeling per-team volatility is the kind of sophistication
// explicitly out of scope here. Variance scales linearly with minutes remaining (i.e. scoring
// treated as ~i.i.d. per minute), so stdev scales with sqrt(minutesRemaining / 60).
const FULL_GAME_STDEV = 10;

// Used only when a team has zero final games yet to average (week 1, before any game in the
// league has finished) — a plain, unremarkable modern-NFL points-per-game figure.
const LEAGUE_FALLBACK_PPG = 22.5;

// "Virtual games" of league-average pace blended into a team's own season-to-date average —
// Bühlmann-credibility style: a team with 0 games played is 100% league average; by ~4 games
// its own sample carries as much weight as the league prior; well past that, mostly its own.
const TEAM_CREDIBILITY_GAMES = 4;

/** Abramowitz-Stegun erf approximation — good to ~1e-7, plenty for a "not too sophisticated" model. */
function erf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
  return sign * y;
}

function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

export interface TeamPace {
  pointsPerMinute: number;
  gamesPlayed: number;
}

export interface SeasonPaces {
  byTeam: Map<string, TeamPace>;
  leaguePointsPerMinute: number;
}

/**
 * Season-to-date scoring pace for every team with at least one final game this season, plus
 * the league-wide average as the fallback/blending prior. One query, reused across every pick
 * on the dashboard in a single getGameDayData call — cheap even at full-season row counts
 * (well under 300 games/season).
 */
export async function computeSeasonPaces(seasonId: number): Promise<SeasonPaces> {
  const finalGames = await db
    .select({
      homeTeam: games.homeTeam,
      awayTeam: games.awayTeam,
      homeScore: games.homeScore,
      awayScore: games.awayScore,
    })
    .from(games)
    .where(and(eq(games.seasonId, seasonId), eq(games.isFinal, true)));

  const totals = new Map<string, { points: number; games: number }>();
  let leagueTotalPoints = 0;
  let leagueTotalGames = 0;

  for (const g of finalGames) {
    if (g.homeScore != null) {
      const t = totals.get(g.homeTeam) ?? { points: 0, games: 0 };
      t.points += g.homeScore;
      t.games += 1;
      totals.set(g.homeTeam, t);
      leagueTotalPoints += g.homeScore;
      leagueTotalGames += 1;
    }
    if (g.awayScore != null) {
      const t = totals.get(g.awayTeam) ?? { points: 0, games: 0 };
      t.points += g.awayScore;
      t.games += 1;
      totals.set(g.awayTeam, t);
      leagueTotalPoints += g.awayScore;
      leagueTotalGames += 1;
    }
  }

  const leaguePpg = leagueTotalGames > 0 ? leagueTotalPoints / leagueTotalGames : LEAGUE_FALLBACK_PPG;

  const byTeam = new Map<string, TeamPace>();
  for (const [team, t] of totals) {
    byTeam.set(team, { pointsPerMinute: t.points / t.games / 60, gamesPlayed: t.games });
  }

  return { byTeam, leaguePointsPerMinute: leaguePpg / 60 };
}

function blendedPace(team: string, paces: SeasonPaces): number {
  const t = paces.byTeam.get(team);
  if (!t) return paces.leaguePointsPerMinute;
  const weight = t.gamesPlayed / (t.gamesPlayed + TEAM_CREDIBILITY_GAMES);
  return weight * t.pointsPerMinute + (1 - weight) * paces.leaguePointsPerMinute;
}

/**
 * Minutes left in REGULATION from ESPN's period/displayClock. Returns null outside regulation
 * (pregame, or period > 4 / overtime) — this simple model doesn't attempt to handle overtime's
 * different (sudden-death-ish) win conditions, so the dashboard falls back to the plain
 * current-score-based Winning/Losing badge there instead.
 */
export function minutesRemainingInRegulation(period: number | null, displayClock: string | null): number | null {
  if (period == null || period < 1 || period > 4 || !displayClock) return null;
  const [mStr, sStr] = displayClock.split(':');
  const m = Number(mStr);
  const s = Number(sStr);
  if (!Number.isFinite(m) || !Number.isFinite(s)) return null;
  return (4 - period) * 15 + m + s / 60;
}

export interface LiveProjectionInput {
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  isFinal: boolean;
  period: number | null;
  displayClock: string | null;
  pickType: 'spread' | 'over_under';
  selection: 'home' | 'away' | 'over' | 'under';
  spread: number | null;
  overUnder: number | null;
}

/**
 * Pr(this pick wins) — each team's remaining points modeled as an independent normal, mean =
 * blended season/league pace (see computeSeasonPaces) x minutes remaining, stdev scaled off
 * FULL_GAME_STDEV by sqrt(minutesRemaining / 60). Margin (spread) or total (O/U) is then just
 * the sum/difference of two independent normals, so it reduces to a single standard
 * Pr(X > threshold) via the normal CDF.
 *
 * Pregame (period 0/null, no score yet) is treated as a 0-0 score with a full 60 minutes
 * remaining — the pregame line itself IS the fair-value starting point, and this collapses to
 * exactly the same formula with the current-score term dropping out, so a not-yet-started pick
 * gets a real probability too rather than nothing. Returns null once the game is officially
 * final (the real grade takes over) or in overtime (period > 4 — this simple model doesn't
 * attempt to handle OT's different win conditions), or when the relevant line is missing.
 */
export function projectWinProbability(input: LiveProjectionInput, paces: SeasonPaces): number | null {
  if (input.isFinal) return null;

  const period = input.period ?? 0;
  if (period > 4) return null; // overtime — out of scope for this model

  let homeScore: number;
  let awayScore: number;
  let minsRemaining: number;

  if (period < 1) {
    homeScore = 0;
    awayScore = 0;
    minsRemaining = 60;
  } else {
    const remaining = minutesRemainingInRegulation(period, input.displayClock);
    if (remaining == null || input.homeScore == null || input.awayScore == null) return null;
    homeScore = input.homeScore;
    awayScore = input.awayScore;
    minsRemaining = remaining;
  }

  const homePace = blendedPace(input.homeTeam, paces);
  const awayPace = blendedPace(input.awayTeam, paces);

  const meanHomeRemaining = homePace * minsRemaining;
  const meanAwayRemaining = awayPace * minsRemaining;
  const varRemainingOneSide = ((FULL_GAME_STDEV * FULL_GAME_STDEV) / 60) * minsRemaining;
  const combinedSd = Math.sqrt(varRemainingOneSide * 2); // home + away remaining points, independent
  if (combinedSd === 0) return null;

  if (input.pickType === 'spread') {
    if (input.spread == null) return null;
    // Home covers when margin > -spread — same convention gradeSpreadPick uses.
    const meanMargin = (homeScore - awayScore) + (meanHomeRemaining - meanAwayRemaining);
    const probHomeCovers = normalCdf((meanMargin + input.spread) / combinedSd);
    return input.selection === 'home' ? probHomeCovers : 1 - probHomeCovers;
  }

  if (input.overUnder == null) return null;
  const meanTotal = (homeScore + awayScore) + (meanHomeRemaining + meanAwayRemaining);
  const probOver = normalCdf((meanTotal - input.overUnder) / combinedSd);
  return input.selection === 'over' ? probOver : 1 - probOver;
}
