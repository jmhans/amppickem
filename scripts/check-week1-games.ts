import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const { db } = await import('@/app/lib/db');
  const { games, seasons } = await import('@/app/lib/db/schema');
  const { eq, and } = await import('drizzle-orm');

  const [season] = await db.select().from(seasons).where(eq(seasons.isActive, true)).limit(1);
  console.log('active season:', season);

  if (season) {
    const weekGames = await db.select().from(games).where(and(eq(games.seasonId, season.id), eq(games.week, 1)));
    console.log(`week 1 games: ${weekGames.length}`);
    for (const g of weekGames) console.log(`  ${g.id}: ${g.awayTeam} @ ${g.homeTeam} spread=${g.spread} ou=${g.overUnder}`);
  }
}
main();
