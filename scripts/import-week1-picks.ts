// Imports Week 1 picks from the commissioner's numeric shorthand (1-64: each of the 16
// template games gets 4 consecutive numbers in column order Away/Home/Under/Over — this
// scheme was verified against the template's own away+home / under+over mutual-exclusivity
// rule: every participant's decoded picks were checked to never have both sides of the
// same game marked, which only held under this exact indexing).
//
// Picks data lives in scripts/data/week1-picks.json (gitignored — real names don't belong
// in this public repo's history).
//
// Usage:
//   npx tsx scripts/import-week1-picks.ts            # dry run, no writes
//   npx tsx scripts/import-week1-picks.ts --apply     # actually insert

import { config } from 'dotenv';
config({ path: '.env.local' });

import fs from 'fs';
import path from 'path';

const WEEK = 1;

// Row order from app/lib/templates/pickem-template.xlsx (rows 7-22, columns E/G).
const GAME_ORDER: { away: string; home: string }[] = [
  { away: 'NE', home: 'SEA' },
  { away: 'SF', home: 'LAR' },
  { away: 'TB', home: 'CIN' },
  { away: 'NO', home: 'DET' },
  { away: 'NYJ', home: 'TEN' },
  { away: 'BAL', home: 'IND' },
  { away: 'ATL', home: 'PIT' },
  { away: 'CHI', home: 'CAR' },
  { away: 'CLE', home: 'JAX' },
  { away: 'BUF', home: 'HOU' },
  { away: 'MIA', home: 'LV' },
  { away: 'GB', home: 'MIN' },
  { away: 'WSH', home: 'PHI' },
  { away: 'ARI', home: 'LAC' },
  { away: 'DAL', home: 'NYG' },
  { away: 'DEN', home: 'KC' },
];

type PickType = 'spread' | 'over_under';
type Selection = 'home' | 'away' | 'over' | 'under';

function decode(n: number): { gameIndex: number; pickType: PickType; selection: Selection } {
  const gameIndex = Math.ceil(n / 4); // 1-16
  const slot = (n - 1) % 4;
  const bySlot: { pickType: PickType; selection: Selection }[] = [
    { pickType: 'spread', selection: 'away' },
    { pickType: 'spread', selection: 'home' },
    { pickType: 'over_under', selection: 'under' },
    { pickType: 'over_under', selection: 'over' },
  ];
  return { gameIndex, ...bySlot[slot] };
}

async function main() {
  const apply = process.argv.includes('--apply');

  const dataPath = path.join(__dirname, 'data', 'week1-picks.json');
  if (!fs.existsSync(dataPath)) {
    console.error(`Missing ${dataPath} — this file is gitignored, so it needs to be recreated locally before running this script.`);
    process.exit(1);
  }
  const DATA: Record<string, number[]> = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  const { db } = await import('@/app/lib/db');
  const { participants, seasons, games, picks } = await import('@/app/lib/db/schema');
  const { eq, and } = await import('drizzle-orm');

  const [season] = await db.select().from(seasons).where(eq(seasons.isActive, true)).limit(1);
  if (!season) throw new Error('No active season');

  const weekGames = await db.select().from(games).where(and(eq(games.seasonId, season.id), eq(games.week, WEEK)));
  const gameIdByMatchup = new Map(weekGames.map((g) => [`${g.awayTeam}@${g.homeTeam}`, g]));

  // Sanity check the hardcoded GAME_ORDER against what's actually in the DB for this week.
  const gameIndexToGame = GAME_ORDER.map(({ away, home }) => {
    const g = gameIdByMatchup.get(`${away}@${home}`);
    if (!g) throw new Error(`No DB game found for ${away}@${home} in week ${WEEK} — GAME_ORDER may not match this season's actual week ${WEEK} slate`);
    return g;
  });

  const allParticipants = await db.select().from(participants);
  const participantByName = new Map(allParticipants.map((p) => [p.name.trim(), p]));

  let inserted = 0;
  let skippedExisting = 0;
  let participantsNotFound: string[] = [];

  for (const [rawName, indices] of Object.entries(DATA)) {
    const name = rawName.trim();
    const participant = participantByName.get(name);
    if (!participant) {
      console.log(`NO PARTICIPANT MATCH: "${name}"`);
      participantsNotFound.push(name);
      continue;
    }

    console.log(`\n${name} (participant ${participant.id}):`);
    for (const n of indices) {
      const { gameIndex, pickType, selection } = decode(n);
      const game = gameIndexToGame[gameIndex - 1];
      const lineAtPick = pickType === 'spread' ? game.spread : game.overUnder;
      console.log(`  ${n} -> game ${gameIndex} (${game.awayTeam}@${game.homeTeam}): ${pickType} = ${selection} (line ${lineAtPick})`);

      if (apply) {
        const [existing] = await db
          .select({ id: picks.id })
          .from(picks)
          .where(and(eq(picks.participantId, participant.id), eq(picks.gameId, game.id), eq(picks.pickType, pickType)))
          .limit(1);
        if (existing) {
          skippedExisting++;
          continue;
        }
        await db.insert(picks).values({
          participantId: participant.id,
          seasonId: season.id,
          gameId: game.id,
          week: WEEK,
          pickType,
          selection,
          lineAtPick,
        });
        inserted++;
      }
    }
  }

  console.log(
    `\n${apply ? 'Done.' : 'Dry run (pass --apply to write).'} ` +
    `${apply ? `${inserted} inserted, ${skippedExisting} already existed. ` : ''}` +
    `${participantsNotFound.length} participant name(s) not found: ${participantsNotFound.join(', ') || 'none'}.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
