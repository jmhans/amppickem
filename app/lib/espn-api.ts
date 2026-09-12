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

const ESPN_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
};

// site.api.espn.com's scoreboard endpoint (one request per week) is blocked by
// Akamai from Vercel's serverless IPs — confirmed via the actual "Access
// Denied" block page, not just a header/fingerprint issue; works fine from a
// home network but 403s in production. sports.core.api.espn.com carries the
// same data (confirmed both locally and from Vercel) under a different
// Akamai policy that isn't blocked — but it's a HATEOAS/ref-based API, so
// getting one game's full picture costs several chained requests instead of
// one. Heavier, but it's the one that actually works from where this runs.
const CORE_API_BASE = 'https://sports.core.api.espn.com/v2/sports/football/leagues/nfl';

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, { headers: ESPN_HEADERS });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`ESPN request failed: ${res.status} ${url} — ${body.slice(0, 200)}`);
  }
  return res.json();
}

function idFromRef(ref: string | undefined, pattern: RegExp): string | null {
  return ref?.match(pattern)?.[1] ?? null;
}

const teamAbbrevCache = new Map<number, { data: Map<string, string>; fetchedAt: number }>();
const TEAM_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // team ID->abbreviation is essentially static within a season

/** All 32 NFL teams' ESPN id -> abbreviation for one season, cached in-memory (id->abbreviation basically never changes). */
async function getTeamAbbreviations(year: number): Promise<Map<string, string>> {
  const cached = teamAbbrevCache.get(year);
  if (cached && Date.now() - cached.fetchedAt < TEAM_CACHE_TTL_MS) return cached.data;

  const list = await fetchJson(`${CORE_API_BASE}/seasons/${year}/teams?limit=40`);
  const teams = await Promise.all((list.items ?? []).map((item: any) => fetchJson(item.$ref)));
  const map = new Map<string, string>();
  for (const t of teams) map.set(String(t.id), t.abbreviation);

  teamAbbrevCache.set(year, { data: map, fetchedAt: Date.now() });
  return map;
}

/** This week's event (game) IDs, from the core API's paginated events list. */
async function fetchWeekEventIds(year: number, week: number): Promise<string[]> {
  const data = await fetchJson(`${CORE_API_BASE}/seasons/${year}/types/2/weeks/${week}/events?limit=32`);
  return (data.items ?? [])
    .map((item: any) => idFromRef(item.$ref, /events\/(\d+)/))
    .filter((id: string | null): id is string => id != null);
}

/** One game's full picture — competition (teams/date), status, both scores, and odds. Several chained requests (see CORE_API_BASE comment). */
async function fetchGameFromCore(eventId: string, teamAbbrevs: Map<string, string>): Promise<EspnGame | null> {
  try {
    const comp = await fetchJson(`${CORE_API_BASE}/events/${eventId}/competitions/${eventId}?lang=en&region=us`);
    const home = comp.competitors?.find((c: any) => c.homeAway === 'home');
    const away = comp.competitors?.find((c: any) => c.homeAway === 'away');
    if (!home || !away) return null;

    const homeTeamId = idFromRef(home.team?.$ref, /teams\/(\d+)/);
    const awayTeamId = idFromRef(away.team?.$ref, /teams\/(\d+)/);

    const [status, homeScore, awayScore, oddsList] = await Promise.all([
      comp.status?.$ref ? fetchJson(comp.status.$ref).catch(() => null) : null,
      home.score?.$ref ? fetchJson(home.score.$ref).catch(() => null) : null,
      away.score?.$ref ? fetchJson(away.score.$ref).catch(() => null) : null,
      comp.odds?.$ref ? fetchJson(comp.odds.$ref).catch(() => ({ items: [] })) : { items: [] },
    ]);

    const odds = oddsList.items?.length
      ? (oddsList.items.find((o: any) => o.provider?.priority === 1) ?? oddsList.items[0])
      : null;

    return {
      espnGameId: eventId,
      homeTeam: (homeTeamId && teamAbbrevs.get(homeTeamId)) ?? 'UNK',
      awayTeam: (awayTeamId && teamAbbrevs.get(awayTeamId)) ?? 'UNK',
      gameTime: new Date(comp.date),
      spread: odds?.spread ?? null,
      overUnder: odds?.overUnder ?? null,
      homeScore: homeScore?.value != null ? Number(homeScore.value) : null,
      awayScore: awayScore?.value != null ? Number(awayScore.value) : null,
      status: status?.type?.name ?? null,
      isFinal: !!status?.type?.completed,
    };
  } catch {
    return null; // one bad game shouldn't fail the whole week's sync
  }
}

/**
 * Fetches one week's games (regular season). See CORE_API_BASE comment for
 * why this chases ESPN's core/ref-based API instead of the simpler
 * site.api.espn.com scoreboard endpoint.
 */
export async function fetchWeekFromEspn(year: number, week: number): Promise<EspnGame[]> {
  const [eventIds, teamAbbrevs] = await Promise.all([
    fetchWeekEventIds(year, week),
    getTeamAbbreviations(year),
  ]);

  const results = await Promise.all(eventIds.map((id) => fetchGameFromCore(id, teamAbbrevs)));
  return results.filter((g): g is EspnGame => g !== null);
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
