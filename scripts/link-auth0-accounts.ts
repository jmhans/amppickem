// Pre-links participants to existing Auth0 accounts by matching email addresses, so a
// player doesn't have to manually "claim" their entry (see claimParticipantAccount in
// actions.ts) if they already have an Auth0 login under the same email their entry was
// seeded with. Only ever fills in a NULL auth0Id — never touches an already-claimed
// participant, and skips any email shared by more than one Auth0 account rather than
// guessing which one is "theirs".
//
// The Auth0 export is a tenant user list, one JSON object per line (not a JSON array) —
// this reads it from a local file path so the export itself never has to be pasted into
// chat or committed to the repo.
//
// Usage:
//   npx tsx scripts/link-auth0-accounts.ts <path-to-auth0-export.json>              # dry run, no writes
//   npx tsx scripts/link-auth0-accounts.ts <path-to-auth0-export.json> --apply       # actually link
//   NODE_ENV=production npx tsx scripts/link-auth0-accounts.ts <path> --apply        # against prod

import { config } from 'dotenv';
config({ path: '.env.local' });

import fs from 'fs';

interface Auth0User {
  Id: string;
  Email?: string;
}

async function main() {
  const filePath = process.argv[2];
  const apply = process.argv.includes('--apply');
  if (!filePath) {
    console.error('Usage: npx tsx scripts/link-auth0-accounts.ts <path-to-auth0-export.json> [--apply]');
    process.exit(1);
  }

  const { db } = await import('@/app/lib/db');
  const { participants } = await import('@/app/lib/db/schema');
  const { eq, isNull, isNotNull, and } = await import('drizzle-orm');

  const raw = fs.readFileSync(filePath, 'utf-8');
  const auth0Users: Auth0User[] = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  const emailToIds = new Map<string, Set<string>>();
  for (const u of auth0Users) {
    if (!u.Email) continue;
    const key = u.Email.trim().toLowerCase();
    if (!emailToIds.has(key)) emailToIds.set(key, new Set());
    emailToIds.get(key)!.add(u.Id);
  }

  const unclaimed = await db
    .select({ id: participants.id, name: participants.name, email: participants.email })
    .from(participants)
    .where(and(isNull(participants.auth0Id), isNotNull(participants.email)));

  let linked = 0;
  let noMatch = 0;
  let ambiguous = 0;

  for (const p of unclaimed) {
    const key = p.email!.trim().toLowerCase();
    const ids = emailToIds.get(key);

    if (!ids || ids.size === 0) {
      console.log(`no match:  ${p.name} <${p.email}>`);
      noMatch++;
      continue;
    }
    if (ids.size > 1) {
      console.log(`ambiguous: ${p.name} <${p.email}> — ${ids.size} Auth0 accounts share this email, skipping: ${[...ids].join(', ')}`);
      ambiguous++;
      continue;
    }

    const [auth0Id] = ids;
    if (apply) {
      await db.update(participants).set({ auth0Id }).where(eq(participants.id, p.id));
    }
    console.log(`${apply ? 'linked' : 'would link'}:${apply ? '' : ' '}  ${p.name} <${p.email}> -> ${auth0Id}`);
    linked++;
  }

  console.log(
    `\n${apply ? 'Done.' : 'Dry run (pass --apply to write).'} ` +
    `${linked} ${apply ? 'linked' : 'linkable'}, ${noMatch} no match, ${ambiguous} ambiguous ` +
    `(${unclaimed.length} unclaimed participants checked).`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
