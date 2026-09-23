// Plain module (no 'use server') — pure data-gathering for the AI recap draft (see
// generateRecapDraft in actions.ts). Deliberately does NOT import from actions.ts (which
// would create a circular import, since actions.ts imports this module) — it re-derives the
// small slice of grading/standings logic it needs directly from games/picks/participants
// instead of reusing getBoardData/getStandingsRawData.
import { db } from '@/app/lib/db';
import { games, picks, participants, seasons } from '@/app/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { computeParticipantWeekStats, computeSkins, type RawPick, type WeekCompleteMap } from '@/app/lib/standings-calc';

export interface RecapUpset {
  matchup: string; // "Bears @ Packers"
  winner: string;
  dogPoints: number; // how many points the winner was getting as the underdog
}

export interface RecapLineBlowout {
  matchup: string;
  kind: 'spread' | 'total';
  description: string; // fully-formed, e.g. "Packers covered by 24.5 as 3-point favorites"
  magnitude: number;
}

export interface RecapLopsidedPick {
  matchup: string;
  pickType: 'spread' | 'total';
  losingSideLabel: string; // e.g. "Packers -3" or "Under 44.5"
  losingCount: number;
  totalPicks: number;
}

export interface RecapContrarianWin {
  matchup: string;
  pickType: 'spread' | 'total';
  winningSideLabel: string;
  winningCount: number;
  totalPicks: number;
  winnerNames: string[];
}

export interface RecapWeekStats {
  week: number;
  gamesConsidered: number;
  weeklyWinnerNames: string[];
  upsets: RecapUpset[];
  lineBlowouts: RecapLineBlowout[];
  lopsidedPicks: RecapLopsidedPick[];
  contrarianWins: RecapContrarianWin[];
}

/**
 * Gathers everything an AI (or a human) recap needs for one week: weekly skins winners,
 * upsets (underdog won outright), games that blew past the spread/total, and pool-wide pick
 * patterns (a lot of people on the losing side, or very few on the winning side). Only
 * considers games that are actually final — returns null if none are yet, so the caller
 * can tell the admin there's nothing to summarize.
 */
export async function computeWeekRecapStats(seasonId: number, week: number): Promise<RecapWeekStats | null> {
  const [season, weekGames, weekPicksRaw, activeParticipants] = await Promise.all([
    db.select().from(seasons).where(eq(seasons.id, seasonId)).limit(1).then((r) => r[0]),
    db.select().from(games).where(and(eq(games.seasonId, seasonId), eq(games.week, week))),
    db.select().from(picks).where(and(eq(picks.seasonId, seasonId), eq(picks.week, week))),
    db.select({ id: participants.id, name: participants.name }).from(participants).where(eq(participants.isActive, true)),
  ]);
  if (!season) return null;

  const finalGames = weekGames.filter((g) => g.isFinal && g.homeScore != null && g.awayScore != null);
  if (finalGames.length === 0) return null;

  const nameById = new Map(activeParticipants.map((p) => [p.id, p.name]));

  // --- Weekly (skins) winners — same computeSkins the standings page uses, scoped to just this week. ---
  const rawPicks: RawPick[] = weekPicksRaw.map((p) => ({ participantId: p.participantId, week: p.week, result: p.result as RawPick['result'] }));
  const weekComplete: WeekCompleteMap = { [week]: finalGames.length === weekGames.length };
  const weekStats = computeParticipantWeekStats(rawPicks, activeParticipants.map((p) => p.id), weekComplete, season.picksPerWeek);
  const skins = computeSkins(weekStats, weekComplete, season.picksPerWeek);
  const weeklyWinnerNames = (skins.get(week) ?? []).map((id) => nameById.get(id) ?? 'Unknown').filter(Boolean);

  // --- Upsets + line blowouts, straight from final scores vs. the published line. ---
  const upsets: RecapUpset[] = [];
  const lineBlowouts: RecapLineBlowout[] = [];

  for (const g of finalGames) {
    const homeScore = g.homeScore!;
    const awayScore = g.awayScore!;
    const matchup = `${g.awayTeam} @ ${g.homeTeam}`;
    if (homeScore === awayScore) continue; // ties are vanishingly rare but real

    const straightUpWinner = homeScore > awayScore ? g.homeTeam : g.awayTeam;

    if (g.spread != null && g.spread !== 0) {
      // spread is the HOME line (negative = home favored) — see schema.ts.
      const dogIsHome = g.spread > 0;
      const dogTeam = dogIsHome ? g.homeTeam : g.awayTeam;
      const dogPoints = Math.abs(g.spread);
      if (straightUpWinner === dogTeam) {
        upsets.push({ matchup, winner: straightUpWinner, dogPoints });
      }

      const atsMargin = homeScore + g.spread - awayScore; // > 0 = home covered, matches gradeSpreadPick
      const favorite = g.spread < 0 ? g.homeTeam : g.awayTeam;
      const favoriteLine = Math.abs(g.spread);
      const coveredBy = Math.abs(atsMargin);
      if (coveredBy >= 14) {
        const coveringSide = (g.spread < 0) === (atsMargin > 0) ? g.homeTeam : g.awayTeam;
        lineBlowouts.push({
          matchup,
          kind: 'spread',
          description: `${coveringSide} beat the spread by ${coveredBy.toFixed(1)} (${favorite} was favored by ${favoriteLine})`,
          magnitude: coveredBy,
        });
      }
    }

    if (g.overUnder != null) {
      const total = homeScore + awayScore;
      const diff = total - g.overUnder;
      if (Math.abs(diff) >= 14) {
        lineBlowouts.push({
          matchup,
          kind: 'total',
          description: diff > 0
            ? `${matchup} went well OVER the ${g.overUnder} total (final: ${total})`
            : `${matchup} went well UNDER the ${g.overUnder} total (final: ${total})`,
          magnitude: Math.abs(diff),
        });
      }
    }
  }
  upsets.sort((a, b) => b.dogPoints - a.dogPoints);
  lineBlowouts.sort((a, b) => b.magnitude - a.magnitude);

  // --- Pool-wide pick patterns: how everyone's picks landed on each final, decided game. ---
  const picksByGameType = new Map<string, typeof weekPicksRaw>();
  for (const p of weekPicksRaw) {
    const key = `${p.gameId}:${p.pickType}`;
    const arr = picksByGameType.get(key) ?? [];
    arr.push(p);
    picksByGameType.set(key, arr);
  }

  const lopsidedPicks: RecapLopsidedPick[] = [];
  const contrarianWins: RecapContrarianWin[] = [];

  for (const g of finalGames) {
    const matchup = `${g.awayTeam} @ ${g.homeTeam}`;
    for (const pickType of ['spread', 'total'] as const) {
      const dbPickType = pickType === 'spread' ? 'spread' : 'over_under';
      const gamePicks = picksByGameType.get(`${g.id}:${dbPickType}`) ?? [];
      const decided = gamePicks.filter((p) => p.result === 'win' || p.result === 'loss');
      if (decided.length === 0) continue;

      const winners = decided.filter((p) => p.result === 'win');
      const losers = decided.filter((p) => p.result === 'loss');
      const totalPicks = decided.length;

      const label = (selection: string) => {
        if (pickType === 'spread') {
          const team = selection === 'home' ? g.homeTeam : g.awayTeam;
          const line = selection === 'home' ? g.spread : g.spread != null ? -g.spread : null;
          return line != null ? `${team} ${line > 0 ? '+' : ''}${line}` : team;
        }
        return selection === 'over' ? `Over ${g.overUnder}` : `Under ${g.overUnder}`;
      };

      // "A lot of people picked wrong" — only worth surfacing with a real crowd involved.
      if (losers.length >= 4 && losers.length > winners.length) {
        const losingSelection = losers[0].selection;
        lopsidedPicks.push({
          matchup,
          pickType,
          losingSideLabel: label(losingSelection),
          losingCount: losers.length,
          totalPicks,
        });
      }

      // "Almost nobody had it, and they were right" — needs at least a few people on the
      // other side for "almost nobody" to mean anything.
      if (winners.length >= 1 && winners.length <= 2 && losers.length >= 4) {
        contrarianWins.push({
          matchup,
          pickType,
          winningSideLabel: label(winners[0].selection),
          winningCount: winners.length,
          totalPicks,
          winnerNames: winners.map((p) => nameById.get(p.participantId) ?? 'Unknown'),
        });
      }
    }
  }
  lopsidedPicks.sort((a, b) => b.losingCount - a.losingCount);
  contrarianWins.sort((a, b) => a.winningCount - b.winningCount);

  return {
    week,
    gamesConsidered: finalGames.length,
    weeklyWinnerNames,
    upsets: upsets.slice(0, 3),
    lineBlowouts: lineBlowouts.slice(0, 4),
    lopsidedPicks: lopsidedPicks.slice(0, 3),
    contrarianWins: contrarianWins.slice(0, 3),
  };
}
