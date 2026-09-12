import { pgSchema, serial, text, integer, timestamp, boolean, real, unique, index } from 'drizzle-orm/pg-core';

// Own schema so amp-pickem's tables coexist in the same Neon database/project as
// amp-playoff-fantasy's `ampplayoffs` schema without ever colliding.
export const ampPickemSchema = pgSchema('amppickem');

export const participants = ampPickemSchema.table('participants', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email'),
  auth0Id: text('auth0_id'), // nullable; set when a logged-in user "claims" this row (see claimParticipantAccount)
  hidePicksUntilLock: boolean('hide_picks_until_lock').default(true).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('participants_auth0_id_idx').on(t.auth0Id),
]);

// "Current season" is resolved dynamically via isActive (no hardcoded CURRENT_SEASON
// constant), same pattern as amp-playoff-fantasy's getOrCreateActiveSeason().
export const seasons = ampPickemSchema.table('seasons', {
  id: serial('id').primaryKey(),
  year: integer('year').notNull().unique(),
  name: text('name').notNull(),
  isActive: boolean('is_active').default(false).notNull(),
  picksPerWeek: integer('picks_per_week').default(6).notNull(), // pool config lives in DB, not a const
  firstWeek: integer('first_week').default(1).notNull(),
  lastWeek: integer('last_week').default(18).notNull(),
  // When each week's lines auto-freeze (see games.linesLockedAt) — configurable per season
  // rather than hardcoded. Default Tuesday 7:00 AM Central.
  lineLockDayOfWeek: integer('line_lock_day_of_week').default(2).notNull(), // 0=Sun..6=Sat
  lineLockHour: integer('line_lock_hour').default(7).notNull(), // 24h, in lineLockTimezone
  lineLockTimezone: text('line_lock_timezone').default('America/Chicago').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const games = ampPickemSchema.table('games', {
  id: serial('id').primaryKey(),
  seasonId: integer('season_id').notNull().references(() => seasons.id, { onDelete: 'cascade' }),
  week: integer('week').notNull(),
  homeTeam: text('home_team').notNull(),
  awayTeam: text('away_team').notNull(),
  // spread = HOME team's line, sportsbook convention (negative = home favored) — matches
  // ESPN's odds[].spread directly. NOTE this is the OPPOSITE sign convention from
  // amp-playoff-fantasy's games.spread ("positive = home favored") — deliberate, since
  // amp-pickem auto-ingests from ESPN instead of hand-entry. Always read this comment
  // before touching spread math.
  spread: real('spread'),
  overUnder: real('over_under'),
  // Non-null = this game's lines are frozen AND visible to participants (both at once —
  // that's the point: everyone picks against the same numbers). Set automatically once the
  // season's configured lock time passes for that week, or manually by an admin (early or
  // late). Once set, the automatic ESPN sync never overwrites spread/overUnder for this
  // game — only an explicit admin edit can, at any time, regardless of lock state.
  linesLockedAt: timestamp('lines_locked_at'),
  homeScore: integer('home_score'),
  awayScore: integer('away_score'),
  status: text('status'), // raw ESPN status.type.name, e.g. 'STATUS_FINAL'
  isFinal: boolean('is_final').default(false).notNull(),
  espnGameId: text('espn_game_id').unique(),
  gameTime: timestamp('game_time'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('games_season_week_idx').on(t.seasonId, t.week),
]);

// One row per individual pick. A participant makes up to seasons.picksPerWeek of these
// per week — NOT DB-enforced (no pre-seeded empty slots, no row-count CHECK); the "at
// most N" rule is an application-level check against seasons.picksPerWeek, keeping
// partial weeks representable.
export const picks = ampPickemSchema.table('picks', {
  id: serial('id').primaryKey(),
  participantId: integer('participant_id').notNull().references(() => participants.id, { onDelete: 'cascade' }),
  seasonId: integer('season_id').notNull().references(() => seasons.id, { onDelete: 'cascade' }),
  gameId: integer('game_id').notNull().references(() => games.id, { onDelete: 'cascade' }),
  week: integer('week').notNull(), // denormalized from games.week — avoids a join on every standings/week query
  pickType: text('pick_type').notNull(), // 'spread' | 'over_under'
  // Side-of-game, NOT team abbreviation — survives a team-name correction on the game row,
  // and keeps grading a simple 4-branch comparison. 'home' | 'away' | 'over' | 'under'.
  selection: text('selection').notNull(),
  // Audit snapshot of the line as displayed when the pick was made. NOT used for grading —
  // grading always uses games.spread/overUnder (the pool's published/locked line).
  lineAtPick: real('line_at_pick'),
  slot: integer('slot'), // 1..6, ordinal only for MVP — reserved hook for future confidence-point weighting
  // 'pending' | 'win' | 'loss' | 'push' | 'void' ('void' = game cancelled / line never
  // published / admin nullified — excluded from win/loss/tie standings).
  result: text('result').default('pending').notNull(),
  gradedAt: timestamp('graded_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  // One pick per (participant, game, pick TYPE) — allows a participant to take both the
  // spread AND the O/U on the same game (that rule is explicitly undecided; this is the
  // permissive default — forbid later by dropping pickType from this constraint), while
  // still blocking an exact duplicate insert.
  unique('picks_participant_game_type_uniq').on(t.participantId, t.gameId, t.pickType),
  index('picks_participant_season_idx').on(t.participantId, t.seasonId),
  index('picks_season_week_idx').on(t.seasonId, t.week),
  index('picks_game_idx').on(t.gameId),
]);

export const systemSettings = ampPickemSchema.table('system_settings', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(), // e.g. 'last_lines_sync', 'last_grade_run'
  value: text('value'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type PickType = 'spread' | 'over_under';
export type PickSelection = 'home' | 'away' | 'over' | 'under';
export type PickResult = 'pending' | 'win' | 'loss' | 'push' | 'void';
