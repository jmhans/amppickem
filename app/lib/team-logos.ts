// ESPN's team-logo CDN keys off the same abbreviation we already store (lowercased).
export function teamLogoUrl(abbrev: string): string {
  return `https://a.espncdn.com/i/teamlogos/nfl/500/${abbrev.toLowerCase()}.png`;
}
