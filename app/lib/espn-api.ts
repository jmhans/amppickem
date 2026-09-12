import { db } from '@/app/lib/db';
import { games } from '@/app/lib/db/schema';
import { and, eq, isNull } from 'drizzle-orm';

export interface EspnGame {
  espnGameId: string;
  homeTeam: string;
  awayTeam: string;
  gameTime: Date;
  spread: number | null; // home line, negative = home favored
  overUnder: number | null;
  homeScore: number | null;
  awayScore: number | null;
  status: string | null;
  isFinal: boolean;
}

/**
 * Fetches one week's games from ESPN's public scoreboard API (regular season,
 * seasontype=2). odds[] (spread/overUnder) is present for scheduled/in-progress
 * games but disappears once a game reaches STATUS_FINAL — verified live against
 * real data, not assumed. Prefers the provider with priority 1 (falls back to
 * odds[0]) since multiple sportsbooks can appear.
 */
export async function fetchWeekFromEspn(year: number, week: number): Promise<EspnGame[]> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${year}&seasontype=2&week=${week}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });
  if (!res.ok) {
    throw new Error(`ESPN scoreboard request failed: ${res.status}`);
  }
  const data = await res.json();
  const events: any[] = data.events ?? [];

  return events.map((event): EspnGame => {
    const competition = event.competitions[0];
    const home = competition.competitors.find((c: any) => c.homeAway === 'home');
    const away = competition.competitors.find((c: any) => c.homeAway === 'away');
    const odds = competition.odds?.length
      ? (competition.odds.find((o: any) => o.provider?.priority === 1) ?? competition.odds[0])
      : null;

    return {
      espnGameId: String(event.id),
      homeTeam: home?.team?.abbreviation ?? 'UNK',
      awayTeam: away?.team?.abbreviation ?? 'UNK',
      gameTime: new Date(event.date),
      spread: odds?.spread ?? null,
      overUnder: odds?.overUnder ?? null,
      homeScore: home?.score != null ? Number(home.score) : null,
      awayScore: away?.score != null ? Number(away.score) : null,
      status: event.status?.type?.name ?? null,
      isFinal: !!event.status?.type?.completed,
    };
  });
}

/**
 * Upserts one week's games by espnGameId. Always refreshes score/status.
 * Only refreshes spread/overUnder for games that are NOT yet lines-locked —
 * once locked, the pool's published line is frozen and the automatic sync
 * must never touch it again (an admin edit can, at any time, via a direct
 * update elsewhere).
 */
export async function syncWeekGames(
  seasonId: number,
  year: number,
  week: number,
): Promise<{ inserted: number; updated: number; linesFilled: number }> {
  const espnGames = await fetchWeekFromEspn(year, week);

  let inserted = 0;
  let updated = 0;
  let linesFilled = 0;

  for (const eg of espnGames) {
    const existing = await db
      .select()
      .from(games)
      .where(eq(games.espnGameId, eg.espnGameId))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(games).values({
        seasonId,
        week,
        homeTeam: eg.homeTeam,
        awayTeam: eg.awayTeam,
        spread: eg.spread,
        overUnder: eg.overUnder,
        homeScore: eg.homeScore,
        awayScore: eg.awayScore,
        status: eg.status,
        isFinal: eg.isFinal,
        espnGameId: eg.espnGameId,
        gameTime: eg.gameTime,
      });
      inserted += 1;
      if (eg.spread != null || eg.overUnder != null) linesFilled += 1;
      continue;
    }

    const row = existing[0];
    const isLocked = row.linesLockedAt != null;

    await db
      .update(games)
      .set({
        homeTeam: eg.homeTeam,
        awayTeam: eg.awayTeam,
        homeScore: eg.homeScore,
        awayScore: eg.awayScore,
        status: eg.status,
        isFinal: eg.isFinal,
        gameTime: eg.gameTime,
        // Never overwrite a locked line. Never null out an existing unlocked
        // line just because ESPN's odds[] is momentarily absent this fetch.
        ...(isLocked
          ? {}
          : {
              spread: eg.spread ?? row.spread,
              overUnder: eg.overUnder ?? row.overUnder,
            }),
        updatedAt: new Date(),
      })
      .where(eq(games.id, row.id));
    updated += 1;
    if (!isLocked && row.spread == null && eg.spread != null) linesFilled += 1;
  }

  return { inserted, updated, linesFilled };
}

/** Games in a week/season still missing a line (used to flag admin attention). */
export async function getGamesMissingLines(seasonId: number, week: number) {
  return db
    .select()
    .from(games)
    .where(and(eq(games.seasonId, seasonId), eq(games.week, week), isNull(games.linesLockedAt)));
}
