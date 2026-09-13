/**
 * Whether a game's picks are currently locked for editing — separate from
 * games.linesLockedAt (which only gates whether the game is VISIBLE for
 * picking at all). Default: locked once kickoff has passed. An admin can
 * override either direction via games.pickLockOverride (see schema.ts).
 */
export function isPickLocked(game: { gameTime: Date | string | null; pickLockOverride: boolean | null }): boolean {
  if (game.pickLockOverride != null) return game.pickLockOverride;
  if (!game.gameTime) return false;
  return Date.now() >= new Date(game.gameTime).getTime();
}
