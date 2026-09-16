// ESPN abbreviation -> full team name, for display on the commissioner's xlsx export
// (games.homeTeam/awayTeam store the ESPN abbreviation; the template shows full names).
export const NFL_TEAM_NAMES: Record<string, string> = {
  ARI: 'Arizona Cardinals',
  ATL: 'Atlanta Falcons',
  BAL: 'Baltimore Ravens',
  BUF: 'Buffalo Bills',
  CAR: 'Carolina Panthers',
  CHI: 'Chicago Bears',
  CIN: 'Cincinnati Bengals',
  CLE: 'Cleveland Browns',
  DAL: 'Dallas Cowboys',
  DEN: 'Denver Broncos',
  DET: 'Detroit Lions',
  GB: 'Green Bay Packers',
  HOU: 'Houston Texans',
  IND: 'Indianapolis Colts',
  JAX: 'Jacksonville Jaguars',
  KC: 'Kansas City Chiefs',
  LAC: 'Los Angeles Chargers',
  LAR: 'Los Angeles Rams',
  LV: 'Las Vegas Raiders',
  MIA: 'Miami Dolphins',
  MIN: 'Minnesota Vikings',
  NE: 'New England Patriots',
  NO: 'New Orleans Saints',
  NYG: 'New York Giants',
  NYJ: 'New York Jets',
  PHI: 'Philadelphia Eagles',
  PIT: 'Pittsburgh Steelers',
  SEA: 'Seattle Seahawks',
  SF: 'San Francisco 49ers',
  TB: 'Tampa Bay Buccaneers',
  TEN: 'Tennessee Titans',
  WSH: 'Washington Commanders',
};

export function teamFullName(abbrev: string): string {
  return NFL_TEAM_NAMES[abbrev] ?? abbrev;
}

const FULL_NAME_TO_ABBREV: Record<string, string> = Object.fromEntries(
  Object.entries(NFL_TEAM_NAMES).map(([abbrev, fullName]) => [fullName, abbrev]),
);

/** Inverse of teamFullName() — used to match a template's team names back to games.homeTeam/awayTeam. */
export function teamAbbrevFromFullName(fullName: string): string | undefined {
  return FULL_NAME_TO_ABBREV[fullName.trim()];
}
