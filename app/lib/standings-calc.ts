import type { PickResult } from '@/app/lib/db/schema';

export interface RawPick {
  participantId: number;
  week: number;
  result: PickResult;
}

export interface ParticipantWeekStats {
  participantId: number;
  week: number;
  wins: number;
  losses: number; // graded losses + missing-pick losses (once the week is complete)
  draws: number;
  lostPicks: number; // graded losses ONLY — missing picks never count here
  picksMade: number;
}

/** A week is "complete" once every game in it is final — see schema.ts's pickLockOverride comment for the related per-game concept. */
export type WeekCompleteMap = Record<number, boolean>;

/**
 * Every participant is scored on `picksPerWeek` outcomes each week regardless
 * of how many picks they actually submitted — unsubmitted slots score as
 * losses (so skipping is never better than picking), but only count toward
 * `losses`, never toward `lostPicks`. `lostPicks` is specifically "a pick you
 * made and lost" — the season Lost-Picks prize is for taking a shot and
 * missing, not for not playing. The missing-pick penalty only applies once
 * `weekComplete[week]` is true — a week still in progress isn't penalized
 * yet, since not every game's picking window has necessarily closed.
 */
export function computeParticipantWeekStats(
  picks: RawPick[],
  participantIds: number[],
  weekComplete: WeekCompleteMap,
  picksPerWeek: number,
): ParticipantWeekStats[] {
  const weeks = Object.keys(weekComplete).map(Number);
  const byKey = new Map<string, RawPick[]>();
  for (const p of picks) {
    const key = `${p.participantId}:${p.week}`;
    const arr = byKey.get(key) ?? [];
    arr.push(p);
    byKey.set(key, arr);
  }

  const rows: ParticipantWeekStats[] = [];
  for (const participantId of participantIds) {
    for (const week of weeks) {
      const weekPicks = byKey.get(`${participantId}:${week}`) ?? [];
      const wins = weekPicks.filter((p) => p.result === 'win').length;
      const gradedLosses = weekPicks.filter((p) => p.result === 'loss').length;
      const draws = weekPicks.filter((p) => p.result === 'push').length;
      const picksMade = weekPicks.length; // includes 'void' and 'pending' — they still submitted something

      const missingPicks = weekComplete[week] ? Math.max(0, picksPerWeek - picksMade) : 0;

      rows.push({
        participantId,
        week,
        wins,
        losses: gradedLosses + missingPicks,
        draws,
        lostPicks: gradedLosses,
        picksMade,
      });
    }
  }
  return rows;
}

export interface StandingsTotals {
  participantId: number;
  wins: number;
  losses: number;
  draws: number;
  lostPicks: number;
  winPct: number;
}

function sumStats(stats: ParticipantWeekStats[], participantId: number): StandingsTotals {
  const mine = stats.filter((s) => s.participantId === participantId);
  const wins = mine.reduce((a, s) => a + s.wins, 0);
  const losses = mine.reduce((a, s) => a + s.losses, 0);
  const draws = mine.reduce((a, s) => a + s.draws, 0);
  const lostPicks = mine.reduce((a, s) => a + s.lostPicks, 0);
  return { participantId, wins, losses, draws, lostPicks, winPct: wins + losses > 0 ? wins / (wins + losses) : 0 };
}

// Wins desc, losses asc, winPct desc — same tiebreak as actions.ts's compareStandings.
function compareTotals(a: StandingsTotals, b: StandingsTotals): number {
  if (a.wins !== b.wins) return b.wins - a.wins;
  if (a.losses !== b.losses) return a.losses - b.losses;
  return b.winPct - a.winPct;
}

/** Standard competition ranking: ties share a rank, the next distinct value skips ahead (1,2,2,4). */
export function assignRanks<T>(sorted: T[], compare: (a: T, b: T) => number): number[] {
  const ranks: number[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && compare(sorted[i], sorted[i - 1]) === 0) {
      ranks.push(ranks[i - 1]);
    } else {
      ranks.push(i + 1);
    }
  }
  return ranks;
}

export interface WeeklyStandingsRow extends StandingsTotals {
  rank: number;
}

export function computeWeeklyStandings(weekStats: ParticipantWeekStats[], week: number): WeeklyStandingsRow[] {
  const participantIds = [...new Set(weekStats.map((s) => s.participantId))];
  const totals = participantIds.map((id) => {
    const row = weekStats.find((s) => s.participantId === id && s.week === week);
    return row
      ? { participantId: id, wins: row.wins, losses: row.losses, draws: row.draws, lostPicks: row.lostPicks, winPct: row.wins + row.losses > 0 ? row.wins / (row.wins + row.losses) : 0 }
      : { participantId: id, wins: 0, losses: 0, draws: 0, lostPicks: 0, winPct: 0 };
  });
  const sorted = [...totals].sort(compareTotals);
  const ranks = assignRanks(sorted, compareTotals);
  return sorted.map((row, i) => ({ ...row, rank: ranks[i] }));
}

export interface SeasonStandingsRow extends StandingsTotals {
  rank: number;
  gamesBack: number | null; // null = leader ("E")
  rankChange: number | null; // previousRank - currentRank; null if no previous week to compare
  weeklyWins: number; // skins won so far
  curWonDollars: number;
}

/** All weeks (<=uptoWeek) that have skins awarded, keyed by week, each value the winning participantIds. */
export function computeSkins(
  weekStats: ParticipantWeekStats[],
  weekComplete: WeekCompleteMap,
  picksPerWeek: number,
): Map<number, number[]> {
  const byWeek = new Map<number, ParticipantWeekStats[]>();
  for (const s of weekStats) {
    if (!weekComplete[s.week]) continue;
    const arr = byWeek.get(s.week) ?? [];
    arr.push(s);
    byWeek.set(s.week, arr);
  }

  const skins = new Map<number, number[]>();
  for (const [week, stats] of byWeek) {
    if (stats.length === 0) continue;
    const maxWins = Math.max(...stats.map((s) => s.wins));
    const top = stats.filter((s) => s.wins === maxWins).map((s) => s.participantId);
    if (maxWins === picksPerWeek) {
      skins.set(week, top); // perfect week(s) — everyone who went 6-0 gets a skin
    } else if (top.length === 1) {
      skins.set(week, top); // sole best (non-perfect) record — one skin
    } else {
      skins.set(week, []); // tie for best, not perfect — no skin awarded
    }
  }
  return skins;
}

function computeStandingsForWeeks(
  weekStats: ParticipantWeekStats[],
  participantIds: number[],
  uptoWeek: number,
): { rank: number; totals: StandingsTotals }[] {
  const inRange = weekStats.filter((s) => s.week <= uptoWeek);
  const totals = participantIds.map((id) => sumStats(inRange, id));
  const sorted = [...totals].sort(compareTotals);
  const ranks = assignRanks(sorted, compareTotals);
  return sorted.map((totals, i) => ({ rank: ranks[i], totals }));
}

export interface PayoutTierConfig {
  rank: number;
  percentage: number;
}

export interface PayoutConfig {
  entryFee: number;
  weeklyPotPerWeek: number;
  lostPicksPrizeAmount: number;
  numWeeksInSeason: number;
  tiers: PayoutTierConfig[];
}

export function computeSeasonStandings(
  weekStats: ParticipantWeekStats[],
  participantIds: number[],
  weekComplete: WeekCompleteMap,
  uptoWeek: number,
  picksPerWeek: number,
  payoutConfig: PayoutConfig,
): SeasonStandingsRow[] {
  const current = computeStandingsForWeeks(weekStats, participantIds, uptoWeek);
  const leaderWins = current[0]?.totals.wins ?? 0;
  const leaderLosses = current[0]?.totals.losses ?? 0;

  // "Since last week" means the last fully-complete week strictly before uptoWeek —
  // whether or not uptoWeek itself is complete yet.
  const completedWeeksBeforeUpto = Object.keys(weekComplete)
    .map(Number)
    .filter((w) => w < uptoWeek && weekComplete[w]);
  const previousWeek = completedWeeksBeforeUpto.length > 0 ? Math.max(...completedWeeksBeforeUpto) : null;
  const previous = previousWeek != null ? computeStandingsForWeeks(weekStats, participantIds, previousWeek) : null;
  const previousRankById = new Map(previous?.map((r) => [r.totals.participantId, r.rank]) ?? []);

  const skins = computeSkins(weekStats, weekComplete, picksPerWeek);
  const skinsThroughUptoWeek = [...skins.entries()].filter(([week]) => week <= uptoWeek);
  const totalSkinsAwarded = skinsThroughUptoWeek.reduce((a, [, ids]) => a + ids.length, 0);
  const weeklyWinsByParticipant = new Map<number, number>();
  for (const [, ids] of skinsThroughUptoWeek) {
    for (const id of ids) weeklyWinsByParticipant.set(id, (weeklyWinsByParticipant.get(id) ?? 0) + 1);
  }

  const skinsPoolTotal = payoutConfig.weeklyPotPerWeek * payoutConfig.numWeeksInSeason;
  const sharePerSkin = totalSkinsAwarded > 0 ? skinsPoolTotal / totalSkinsAwarded : 0;

  const maxLostPicks = Math.max(0, ...current.map((r) => r.totals.lostPicks));
  const lostPicksLeaders = maxLostPicks > 0 ? current.filter((r) => r.totals.lostPicks === maxLostPicks) : [];
  const lostPicksSharePerLeader = lostPicksLeaders.length > 0 ? payoutConfig.lostPicksPrizeAmount / lostPicksLeaders.length : 0;

  const remainderPool = payoutConfig.entryFee * participantIds.length - skinsPoolTotal - payoutConfig.lostPicksPrizeAmount;
  const sortedTiers = [...payoutConfig.tiers].sort((a, b) => a.rank - b.rank);
  // Group participants by rank so a tied rank spanning multiple tier rows splits the summed percentage evenly.
  const rankGroups = new Map<number, number[]>();
  for (const r of current) {
    const arr = rankGroups.get(r.rank) ?? [];
    arr.push(r.totals.participantId);
    rankGroups.set(r.rank, arr);
  }

  function tierPayoutForRank(rank: number): number {
    const group = rankGroups.get(rank) ?? [];
    if (group.length === 0) return 0;
    const spannedTiers = sortedTiers.filter((t) => t.rank >= rank && t.rank < rank + group.length);
    const totalPct = spannedTiers.reduce((a, t) => a + t.percentage, 0);
    if (totalPct === 0) return 0;
    return (remainderPool * totalPct) / 100 / group.length;
  }

  return current.map(({ rank, totals }) => {
    const gamesBack = rank === 1 ? null : (leaderWins - totals.wins + (totals.losses - leaderLosses)) / 2;
    const prevRank = previousRankById.get(totals.participantId);
    const rankChange = prevRank != null ? prevRank - rank : null;
    const weeklyWins = weeklyWinsByParticipant.get(totals.participantId) ?? 0;

    const skinsDollars = weeklyWins * sharePerSkin;
    const lostPicksDollars = lostPicksLeaders.some((l) => l.totals.participantId === totals.participantId) ? lostPicksSharePerLeader : 0;
    const tierDollars = tierPayoutForRank(rank);

    return {
      ...totals,
      rank,
      gamesBack,
      rankChange,
      weeklyWins,
      curWonDollars: skinsDollars + lostPicksDollars + tierDollars,
    };
  });
}
