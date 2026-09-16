// One-off/rerunnable bulk import of the commissioner's entry roster into `participants`.
// Idempotent by entry name: existing rows are left untouched, only missing ones are inserted.
// Deliberately does NOT store each person's real name (per commissioner instruction) — only
// the public entry name and email survive from the source spreadsheet.
//
// Roster data lives in scripts/data/participants.json (gitignored — real names/emails don't
// belong in this public repo's history).
//
// Usage:
//   npx tsx scripts/seed-participants.ts            # seeds the dev DB (POSTGRES_URL_DEV)
//   NODE_ENV=production npx tsx scripts/seed-participants.ts   # seeds prod (POSTGRES_URL/AMP_PICKEM_POSTGRES_URL)

import { config } from 'dotenv';
config({ path: '.env.local' });

import fs from 'fs';
import path from 'path';

interface Entry {
  name: string;
  email: string;
}

async function main() {
  const dataPath = path.join(__dirname, 'data', 'participants.json');
  if (!fs.existsSync(dataPath)) {
    console.error(`Missing ${dataPath} — this file is gitignored, so it needs to be recreated locally (see git history/chat for the source data) before running this script.`);
    process.exit(1);
  }
  const entries: Entry[] = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  // Dynamic imports so `dotenv.config()` above actually runs before app/lib/db reads
  // process.env — static imports are hoisted above this file's own top-level code and
  // would otherwise construct the DB client before the env vars are loaded.
  const { db } = await import('@/app/lib/db');
  const { participants } = await import('@/app/lib/db/schema');
  const { eq } = await import('drizzle-orm');

  let inserted = 0;
  let skipped = 0;

  for (const entry of entries) {
    const [existing] = await db.select({ id: participants.id }).from(participants).where(eq(participants.name, entry.name)).limit(1);
    if (existing) {
      console.log(`skip (exists): ${entry.name}`);
      skipped++;
      continue;
    }
    await db.insert(participants).values({ name: entry.name, email: entry.email });
    console.log(`inserted: ${entry.name} <${entry.email}>`);
    inserted++;
  }

  console.log(`\nDone. Inserted ${inserted}, skipped ${skipped} (already present).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
