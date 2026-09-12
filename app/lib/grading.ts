import type { PickResult, PickType } from '@/app/lib/db/schema';

/**
 * spread is the HOME team's line, sportsbook convention (negative = home
 * favored). margin > 0 means home covered; margin < 0 means away covered;
 * margin === 0 is a push. See app/lib/db/schema.ts's comment on games.spread
 * for why this sign convention (not amp-playoff-fantasy's).
 */
export function gradeSpreadPick(
  selection: 'home' | 'away',
  spread: number,
  homeScore: number,
  awayScore: number,
): 'win' | 'loss' | 'push' {
  const margin = homeScore + spread - awayScore;
  if (margin === 0) return 'push';
  const homeCovered = margin > 0;
  return (selection === 'home') === homeCovered ? 'win' : 'loss';
}

export function gradeTotalPick(
  selection: 'over' | 'under',
  overUnder: number,
  homeScore: number,
  awayScore: number,
): 'win' | 'loss' | 'push' {
  const total = homeScore + awayScore;
  if (total === overUnder) return 'push';
  return (selection === 'over') === (total > overUnder) ? 'win' : 'loss';
}

export type GradableGame = {
  isFinal: boolean;
  spread: number | null;
  overUnder: number | null;
  homeScore: number | null;
  awayScore: number | null;
};

export type GradablePick = {
  pickType: PickType;
  selection: string;
};

/** 'pending' if the game isn't final yet or scores are missing; 'void' if the needed line is missing. */
export function gradePick(pick: GradablePick, game: GradableGame): PickResult {
  if (!game.isFinal || game.homeScore == null || game.awayScore == null) {
    return 'pending';
  }

  if (pick.pickType === 'spread') {
    if (game.spread == null) return 'void';
    return gradeSpreadPick(pick.selection as 'home' | 'away', game.spread, game.homeScore, game.awayScore);
  }

  if (game.overUnder == null) return 'void';
  return gradeTotalPick(pick.selection as 'over' | 'under', game.overUnder, game.homeScore, game.awayScore);
}
