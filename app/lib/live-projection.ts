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

/**
 * Inverse standard normal CDF (probit function) — Peter Acklam's rational approximation,
 * accurate to ~1.15e-9. Needed to go the other direction from normalCdf: given a probability
 * (from live market odds), recover the z-score, so a probability observed at one threshold
 * (the live line) can be re-expressed as an implied mean and then re-evaluated at a different
 * threshold (the pool's locked line) — see projectPregameFromLiveOdds.
 */
function inverseNormalCdf(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;

  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5])
      / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p <= pHigh) {
    const q = p - 0.5;
    const r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q
      / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  const q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5])
    / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}

/** American odds -> raw (vig-included) implied probability. */
function americanOddsToImpliedProb(odds: number): number {
  return odds < 0 ? -odds / (-odds + 100) : 100 / (odds + 100);
}

/**
 * Vig-free probability for "side A", given American odds for both sides of the same market
 * (e.g. home spread price vs. away spread price, or over price vs. under price). The two raw
 * implied probabilities sum to more than 1 (that excess is the sportsbook's vig); dividing
 * side A's raw probability by the sum removes it proportionally — the standard de-vig method.
 */
function vigFreeProbability(oddsForSideA: number, oddsForSideB: number): number {
  const pA = americanOddsToImpliedProb(oddsForSideA);
  const pB = americanOddsToImpliedProb(oddsForSideB);
  return pA / (pA + pB);
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
  // Live market line/pricing — see schema.ts's games.liveSpread comment. Only used pregame
  // (see projectPregameFromLiveOdds); once there's a score, the pace-based projection below
  // takes over and these are ignored.
  liveSpread: number | null;
  liveOverUnder: number | null;
  liveSpreadHomeOdds: number | null;
  liveSpreadAwayOdds: number | null;
  liveOverOdds: number | null;
  liveUnderOdds: number | null;
}

/**
 * Pregame win probability, derived from the market's own current pricing rather than our team-
 * pace model (see projectWinProbability's doc comment for why — the pace model was checked
 * against real odds and found overconfident). The pool's own locked line is frozen at whatever
 * it was Tuesday and may since have drifted from the live market — this re-anchors a
 * probability computed at the LIVE line onto OUR locked line, through the same normal model
 * used everywhere else in this file:
 *
 *   1. De-vig the live price to get p_live = Pr(cover the LIVE line).
 *   2. Invert through the normal CDF to recover the implied mean: μ = Φ⁻¹(p_live)·σ − liveLine.
 *   3. Re-evaluate that same μ against OUR locked line: p_locked = Φ((μ + lockedLine)/σ).
 *
 * When the live line equals our locked line, step 3 reduces to exactly p_live — no distortion.
 * σ here is the full 60-minute combined (home+away) stdev, same FULL_GAME_STDEV constant as
 * the in-game model, just without any minutes-remaining scaling (nothing's been played yet).
 * Returns null if the live pricing needed isn't available (e.g. before this feature's first
 * sync populates it) — the caller falls back to a flat 0.5 in that case.
 */
function projectPregameFromLiveOdds(input: LiveProjectionInput): number | null {
  const combinedSd = FULL_GAME_STDEV * Math.SQRT2;

  if (input.pickType === 'spread') {
    if (input.spread == null || input.liveSpread == null || input.liveSpreadHomeOdds == null || input.liveSpreadAwayOdds == null) {
      return null;
    }
    const pLiveHomeCovers = vigFreeProbability(input.liveSpreadHomeOdds, input.liveSpreadAwayOdds);
    const impliedMean = inverseNormalCdf(pLiveHomeCovers) * combinedSd - input.liveSpread;
    const probHomeCoversLocked = normalCdf((impliedMean + input.spread) / combinedSd);
    return input.selection === 'home' ? probHomeCoversLocked : 1 - probHomeCoversLocked;
  }

  if (input.overUnder == null || input.liveOverUnder == null || input.liveOverOdds == null || input.liveUnderOdds == null) {
    return null;
  }
  const pLiveOver = vigFreeProbability(input.liveOverOdds, input.liveUnderOdds);
  const impliedMean = inverseNormalCdf(pLiveOver) * combinedSd + input.liveOverUnder;
  const probOverLocked = normalCdf((impliedMean - input.overUnder) / combinedSd);
  return input.selection === 'over' ? probOverLocked : 1 - probOverLocked;
}

/**
 * Pr(this pick wins) — each team's remaining points modeled as an independent normal, mean =
 * blended season/league pace (see computeSeasonPaces) x minutes remaining, stdev scaled off
 * FULL_GAME_STDEV by sqrt(minutesRemaining / 60). Margin (spread) or total (O/U) is then just
 * the sum/difference of two independent normals, so it reduces to a single standard
 * Pr(X > threshold) via the normal CDF.
 *
 * Pregame (period 0/null, no score yet) doesn't run this pace model at all — an earlier
 * version projected forward from team scoring averages even before kickoff, but a live check
 * against real market odds (see /gameday/methodology's Validation section) showed that was
 * overconfident: with only a couple games of season data, the credibility blend leans heavily
 * on a league-wide average that doesn't reflect this specific matchup, and that bias compounds
 * for totals instead of canceling out. Pregame instead re-anchors the market's own live pricing
 * onto our locked line — see projectPregameFromLiveOdds — falling back to a flat 0.5 only if
 * that live pricing isn't available yet. The pace-based projection below only takes over once
 * there's an actual score to project forward from. Returns null once the game is officially
 * final (the real grade takes over), in overtime (period > 4 — this simple model doesn't
 * attempt to handle OT's different win conditions), or when the relevant line is missing.
 */
export function projectWinProbability(input: LiveProjectionInput, paces: SeasonPaces): number | null {
  if (input.isFinal) return null;

  const period = input.period ?? 0;
  if (period > 4) return null; // overtime — out of scope for this model

  if (period < 1) {
    const hasLine = input.pickType === 'spread' ? input.spread != null : input.overUnder != null;
    if (!hasLine) return null;
    return projectPregameFromLiveOdds(input) ?? 0.5;
  }

  const remaining = minutesRemainingInRegulation(period, input.displayClock);
  if (remaining == null || input.homeScore == null || input.awayScore == null) return null;
  const homeScore = input.homeScore;
  const awayScore = input.awayScore;
  const minsRemaining = remaining;

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
