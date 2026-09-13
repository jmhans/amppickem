export interface GameSession {
  key: string;
  label: string;
}

/**
 * Buckets a game into its broadcast "session" — Sunday is split into Early
 * (kickoff at or before noon Central), Afternoon, and Night windows, matching
 * how the NFL actually schedules the day, rather than lumping all of Sunday
 * into one long list.
 */
export function getGameSession(gameTime: Date, timeZone = 'America/Chicago'): GameSession {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: 'numeric',
    hourCycle: 'h23',
  })
    .formatToParts(gameTime)
    .reduce((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {} as Record<string, string>);

  const weekday = parts.weekday;
  const hour = Number(parts.hour);

  if (weekday === 'Sun') {
    if (hour < 13) return { key: 'sun-early', label: 'Sunday Early' };
    if (hour < 19) return { key: 'sun-afternoon', label: 'Sunday Afternoon' };
    return { key: 'sun-night', label: 'Sunday Night' };
  }

  const labels: Record<string, string> = {
    Wed: 'Wednesday',
    Thu: 'Thursday Night',
    Fri: 'Friday',
    Sat: 'Saturday',
    Mon: 'Monday Night',
    Tue: 'Tuesday',
  };
  // Keyed by weekday (not a fixed Thu-Mon assumption) — a season opener can land
  // on a Wednesday, international games move days around, etc. Chronological
  // order across sessions is resolved by actual kickoff time, not weekday name.
  return { key: weekday.toLowerCase(), label: labels[weekday] ?? weekday };
}

/** Groups games into sessions, ordered by each session's earliest actual kickoff. */
export function groupGamesBySession<T extends { gameTime: Date | string | null }>(
  games: T[],
): { session: GameSession; games: T[] }[] {
  const buckets = new Map<string, { session: GameSession; games: T[]; earliest: number }>();

  for (const game of games) {
    const time = game.gameTime ? new Date(game.gameTime) : null;
    const session = time ? getGameSession(time) : { key: 'tbd', label: 'Time TBD' };
    const ts = time ? time.getTime() : Infinity;
    const bucket = buckets.get(session.key) ?? { session, games: [], earliest: Infinity };
    bucket.games.push(game);
    bucket.earliest = Math.min(bucket.earliest, ts);
    buckets.set(session.key, bucket);
  }

  const sortByTime = (a: T, b: T) => {
    const at = a.gameTime ? new Date(a.gameTime).getTime() : Infinity;
    const bt = b.gameTime ? new Date(b.gameTime).getTime() : Infinity;
    return at - bt;
  };

  return Array.from(buckets.values())
    .map((b) => ({ session: b.session, games: [...b.games].sort(sortByTime), earliest: b.earliest }))
    .sort((a, b) => a.earliest - b.earliest);
}
