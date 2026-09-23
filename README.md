# AMP Pick'em

A weekly NFL spread + over/under pick pool. Each week, every participant picks up to 6 games against the spread or the over/under; the pool tracks win/loss/push records and standings across the season.

Sibling app to `amp-playoff-fantasy` — shares its Auth0 tenant/application (one login across pools) and Neon Postgres project (separate `amppickem` schema).

## Getting Started

```bash
npm install
npm run dev
```

Requires a `.env.local` with `POSTGRES_URL`, `POSTGRES_URL_DEV`, `AUTH0_SECRET`, `APP_BASE_URL`, `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `CRON_SECRET` — see amp-playoff-fantasy for the shared Auth0/DB values. For the commissioner-email feature, also `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `COMMISSIONER_EMAIL` (see "Commissioner sync" below); for pick reminders, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (see "Pick reminders" below).

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
- **Crons**: `api/cron/sync-games` (daily line/score sync + lock check), `api/cron/sync-spreads` (weekly, timed to land shortly after the configured line-lock threshold — same sync-then-lock sweep as sync-games, just closer to the actual cutoff than once-a-day catches), `api/cron/grade` (daily re-grade), `api/cron/pick-reminders` (hourly; see "Pick reminders" below) — all require a `CRON_SECRET` bearer token.
- **Feedback**: the nav dropdown's "Feedback" item (`app/ui/feedback-button.tsx`) lets a signed-in user file a bug/feature request that's created directly as a GitHub issue (`app/api/feedback`) on this repo, labelled `feedback` — same pattern as fgt2/ABL. Requires `GITHUB_FEEDBACK_TOKEN` (a fine-grained PAT scoped to just this repo, Issues read/write); without it the endpoint returns 503 and the modal just says feedback isn't configured, rather than erroring.
- **Weekly Recaps**: `admin/recaps` lets an admin write/edit a recap body (Markdown, via `react-markdown` + `remark-gfm` — bold/italic, links, lists, tables; no rich-text toolbar, just type or paste Markdown) and preview it live, rendered by the shared `app/ui/recap-body.tsx` and styled like `/about`. Raw HTML in the text is intentionally NOT rendered (no `rehype-raw`) — react-markdown treats it as inert literal text, so there's no sanitization step needed. A recap stays a draft, admin-only, until "Send Now" — that one action both publishes it to `/recaps` (public) and notifies every active participant with notifications on via their own email/push preference, same delivery path as pick reminders. Sending is one-shot; editing a recap afterward never re-notifies.

## Commissioner sync (temporary bridge)

The commissioner currently runs the pool from a hand-built xlsx (`app/lib/templates/pickem-template.xlsx`, VLOOKUP/REPLACE formulas and all) and isn't ready to change that process. Until they are, the picks page can generate that exact file from a participant's picks and email it as an attachment — no participant needs to touch Excel themselves.

- `app/lib/xlsx-export.ts` clones the template and fills in one week's games + one participant's marks (`X` in the Away/Home/Under/Over columns).
- `app/api/picks/export` (GET) streams the generated file for download; `app/api/picks/email-commissioner` (POST) generates it and emails it via Gmail SMTP (`nodemailer`). Both require the caller to own the participant (or be admin) — same check `setPick`/`removePick` use.
- The commissioner hand-builds a fresh version of that xlsx most weeks (reshuffled game order, a new quip in the header, etc.). `admin/templates` lets an admin upload that week's file, stored per `(season, week)` in the `week_templates` table (see `app/lib/actions.ts`'s `uploadWeekTemplate`/`getWeekTemplateBuffer`) — `generatePicksWorkbook()` uses it instead of the default template when one exists for that week, and only ever overwrites the fixed data cells (the "Week N" header and the B7:N22 game grid), so an uploaded file must keep that same layout. Any week with no upload just falls back to the default template file.
- Env vars: `GMAIL_USER` (the sending Gmail address), `GMAIL_APP_PASSWORD` (a Google "app password" — requires 2FA on that account, generate one at https://myaccount.google.com/apppasswords; it is NOT the account's regular login password), `COMMISSIONER_EMAIL` (defaults conceptually to `Michael.E.Shoup@ampf.com`, set explicitly). No custom domain needed — mail sends as `GMAIL_USER` directly.
- This is intentionally a bridge, not the final state — once the commissioner (and enough players) are willing to work entirely in-app, this export/email path and the template file can go away. A "commissioner portal" for uploading a week's picks in bulk is a separate, not-yet-built feature.

## Pick reminders

Each participant has a collapsible "Entry Settings" panel on their own picks page (`picks/[id]`, `app/picks/[id]/ParticipantSettings.tsx`) to edit their entry name/email and notification preferences — on by default, email or push.

- `app/api/cron/pick-reminders` runs hourly and calls `sendReminders('friday')` / `sendReminders('sunday')` (`app/lib/reminders.ts`) — each independently checks whether its own threshold (Friday 1pm / Sunday 11am, in the season's `lineLockTimezone`) has actually passed for the current week yet, DST-aware, and whether it's already been sent this week (idempotency via the `systemSettings` key/value table, same pattern `refreshResults()` uses) — almost always a no-op. Anyone still short of `picksPerWeek` picks at that point, with notifications on, gets nudged via their chosen channel.
- The threshold math lives in `app/lib/lines-lock.ts`'s `computeForwardThresholdFromEarliestGame` — deliberately a *different* function from the existing `computeLockThresholdFromEarliestGame` used for line-locking: that one anchors backward from the week's earliest kickoff (Tuesday, days *before* Thursday's game), while reminders need to resolve *forward* (Sunday, days *after* that same Thursday game) — reusing the backward version for Sunday would resolve to the previous week's Sunday.
- Push notifications (`app/lib/push.ts`, `public/sw.js`) are built on the `web-push` package + VAPID keys — no other PWA infrastructure exists beyond this. Requires `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (generate a keypair once via `npx web-push generate-vapid-keys`). A participant's channel choice falls back to email automatically if they pick push but have no live subscription. iOS Safari only supports push once the site's been added to the home screen — the settings panel surfaces that as a hint rather than letting the subscribe call silently fail.
