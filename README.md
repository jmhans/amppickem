# AMP Pick'em

A weekly NFL spread + over/under pick pool. Each week, every participant picks up to 6 games against the spread or the over/under; the pool tracks win/loss/push records and standings across the season.

Sibling app to `amp-playoff-fantasy` — shares its Auth0 tenant/application (one login across pools) and Neon Postgres project (separate `amppickem` schema).

## Getting Started

```bash
npm install
npm run dev
```

Requires a `.env.local` with `POSTGRES_URL`, `POSTGRES_URL_DEV`, `AUTH0_SECRET`, `APP_BASE_URL`, `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `CRON_SECRET` — see amp-playoff-fantasy for the shared Auth0/DB values. For the commissioner-email feature, also `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `COMMISSIONER_EMAIL` (see "Commissioner sync" below).

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
- **Feedback**: the nav dropdown's "Feedback" item (`app/ui/feedback-button.tsx`) lets a signed-in user file a bug/feature request that's created directly as a GitHub issue (`app/api/feedback`) on this repo, labelled `feedback` — same pattern as fgt2/ABL. Requires `GITHUB_FEEDBACK_TOKEN` (a fine-grained PAT scoped to just this repo, Issues read/write); without it the endpoint returns 503 and the modal just says feedback isn't configured, rather than erroring.

## Commissioner sync (temporary bridge)

The commissioner currently runs the pool from a hand-built xlsx (`app/lib/templates/pickem-template.xlsx`, VLOOKUP/REPLACE formulas and all) and isn't ready to change that process. Until they are, the picks page can generate that exact file from a participant's picks and email it as an attachment — no participant needs to touch Excel themselves.

- `app/lib/xlsx-export.ts` clones the template and fills in one week's games + one participant's marks (`X` in the Away/Home/Under/Over columns).
- `app/api/picks/export` (GET) streams the generated file for download; `app/api/picks/email-commissioner` (POST) generates it and emails it via Gmail SMTP (`nodemailer`). Both require the caller to own the participant (or be admin) — same check `setPick`/`removePick` use.
- The commissioner hand-builds a fresh version of that xlsx most weeks (reshuffled game order, a new quip in the header, etc.). `admin/templates` lets an admin upload that week's file, stored per `(season, week)` in the `week_templates` table (see `app/lib/actions.ts`'s `uploadWeekTemplate`/`getWeekTemplateBuffer`) — `generatePicksWorkbook()` uses it instead of the default template when one exists for that week, and only ever overwrites the fixed data cells (the "Week N" header and the B7:N22 game grid), so an uploaded file must keep that same layout. Any week with no upload just falls back to the default template file.
- Env vars: `GMAIL_USER` (the sending Gmail address), `GMAIL_APP_PASSWORD` (a Google "app password" — requires 2FA on that account, generate one at https://myaccount.google.com/apppasswords; it is NOT the account's regular login password), `COMMISSIONER_EMAIL` (defaults conceptually to `Michael.E.Shoup@ampf.com`, set explicitly). No custom domain needed — mail sends as `GMAIL_USER` directly.
- This is intentionally a bridge, not the final state — once the commissioner (and enough players) are willing to work entirely in-app, this export/email path and the template file can go away. A "commissioner portal" for uploading a week's picks in bulk is a separate, not-yet-built feature.
