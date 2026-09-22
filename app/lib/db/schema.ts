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
  // Reminder opt-out (default on) + delivery choice — see app/lib/reminders.ts. 'push' falls
  // back to email at send time if the participant has no live subscription row.
  notificationsEnabled: boolean('notifications_enabled').default(true).notNull(),
  notificationChannel: text('notification_channel').default('email').notNull(), // 'email' | 'push'
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
  // Payout configuration — see app/lib/standings-calc.ts for how these feed the season
  // standings' "Cur Won $" column. entryFee/weeklyPotPerWeek/lostPicksPrizeAmount are dollar
  // amounts; the weekly "skins" pool total is weeklyPotPerWeek * (lastWeek - firstWeek + 1).
  entryFee: real('entry_fee').default(20).notNull(),
  weeklyPotPerWeek: real('weekly_pot_per_week').default(20).notNull(),
  lostPicksPrizeAmount: real('lost_picks_prize_amount').default(20).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Admin-configured season-end payout tiers — e.g. rank 1 gets 20% of the remainder pool,
// rank 2 gets 15%, etc. See app/lib/standings-calc.ts for how the remainder pool itself is
// computed (total entry fees minus the skins pool minus the lost-picks prize).
export const payoutTiers = ampPickemSchema.table('payout_tiers', {
  id: serial('id').primaryKey(),
  seasonId: integer('season_id').notNull().references(() => seasons.id, { onDelete: 'cascade' }),
  rank: integer('rank').notNull(), // 1 = first place
  percentage: real('percentage').notNull(), // 0-100
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  unique('payout_tiers_season_rank_uniq').on(t.seasonId, t.rank),
]);

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
  // Per-GAME pick lock, separate from linesLockedAt (which is a per-WEEK visibility gate).
  // null = automatic: locked once gameTime has passed. true/false = explicit admin override
  // (e.g. force-lock a game early, or force-unlock one after kickoff for a late fix). Read via
  // app/lib/pick-lock.ts's isPickLocked() — never compare this column directly.
  pickLockOverride: boolean('pick_lock_override'),
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

// The commissioner hand-builds a new pickem template most weeks (game order reshuffled,
// a fresh quip in the header, etc.) — see app/lib/xlsx-export.ts. An admin uploads that
// week's file here; export/email falls back to the static default template
// (app/lib/templates/pickem-template.xlsx) for any week with no row. Stored as base64 text
// rather than a real bytea column — these files are tiny (tens of KB) and every other
// column in this schema is already a plain scalar type, so this avoids pulling in
// drizzle's customType machinery for a one-off.
export const weekTemplates = ampPickemSchema.table('week_templates', {
  id: serial('id').primaryKey(),
  seasonId: integer('season_id').notNull().references(() => seasons.id, { onDelete: 'cascade' }),
  week: integer('week').notNull(),
  fileName: text('file_name').notNull(),
  fileData: text('file_data').notNull(), // base64-encoded xlsx bytes
  uploadedBy: text('uploaded_by'), // admin's session name/email, best-effort
  uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
}, (t) => [
  unique('week_templates_season_week_uniq').on(t.seasonId, t.week),
]);

// A participant may subscribe from several browsers/devices — one row each, keyed by the
// browser-issued endpoint (naturally unique; resubscribing the same browser upserts against
// it rather than duplicating). See app/lib/push.ts / app/lib/reminders.ts.
export const pushSubscriptions = ampPickemSchema.table('push_subscriptions', {
  id: serial('id').primaryKey(),
  participantId: integer('participant_id').notNull().references(() => participants.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('push_subscriptions_participant_idx').on(t.participantId),
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
