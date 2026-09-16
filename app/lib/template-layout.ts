// Shared between xlsx-export.ts (writing picks into a template) and actions.ts (reading
// lines back out of an uploaded template) — the commissioner's template has exactly 16
// game rows (7-22), team names in columns E(away)/G(home), spread in H, O/U in I.
export const FIRST_GAME_ROW = 7;
export const LAST_GAME_ROW = 22;
export const MAX_GAMES = LAST_GAME_ROW - FIRST_GAME_ROW + 1;
