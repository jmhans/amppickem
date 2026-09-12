import { NextResponse } from 'next/server';

// Scratch diagnostic — delete once the ESPN-from-Vercel blocking question is settled.
export async function GET() {
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
  const targets = [
    { name: 'site.api.espn.com/scoreboard', url: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=2026&seasontype=2&week=2' },
    { name: 'sports.core.api.espn.com/events', url: 'https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026/types/2/weeks/2/events?limit=5' },
    { name: 'sports.core.api.espn.com/odds', url: 'https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/events/401872932/competitions/401872932/odds?lang=en&region=us' },
  ];

  const results = [];
  for (const t of targets) {
    try {
      const res = await fetch(t.url, { headers: { 'User-Agent': ua } });
      const text = await res.text();
      results.push({ name: t.name, status: res.status, bytes: text.length, snippet: res.ok ? text.slice(0, 150) : text.slice(0, 200) });
    } catch (error) {
      results.push({ name: t.name, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return NextResponse.json({ results });
}
