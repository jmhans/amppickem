# AMP Pick'em

A weekly NFL spread + over/under pick pool. Each week, every participant picks up to 6 games against the spread or the over/under; the pool tracks win/loss/push records and standings across the season.

Sibling app to `amp-playoff-fantasy` — shares its Auth0 tenant/application (one login across pools) and Neon Postgres project (separate `amppickem` schema).

## Getting Started

```bash
npm install
npm run dev
```

Requires a `.env.local` with `POSTGRES_URL`, `POSTGRES_URL_DEV`, `AUTH0_SECRET`, `APP_BASE_URL`, `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `CRON_SECRET` — see amp-playoff-fantasy for the shared Auth0/DB values.

## Database

```bash
npm run db:generate   # generate a migration from app/lib/db/schema.ts
npm run db:migrate    # apply migrations
npm run db:studio     # browse the DB
```

## How it works

- **Lines**: `admin/lines` syncs spreads + over/unders from ESPN's public scoreboard API and freezes ("locks") each week automatically at a configurable weekly cutoff (default Tuesday 7am Central) — or an admin can lock/unlock manually. Once locked, automatic sync never overwrites the line; a manual admin edit always can.
- **Picks**: participants pick against locked (visible) games only, via `picks/[participantId]`.
- **Grading**: `admin/results` grades picks (win/loss/push) once a game is final — idempotent, re-gradable at any time, self-heals from a corrected score or line.
- **Crons**: `api/cron/sync-games` (daily line/score sync + lock check) and `api/cron/grade` (daily re-grade) — both require a `CRON_SECRET` bearer token.
