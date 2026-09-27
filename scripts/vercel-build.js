// Vercel auto-detects a "vercel-build" package.json script and runs it instead of "build" -- see
// that script's comment for why this can't just be `drizzle-kit migrate && next build` directly.
//
// NODE_ENV is 'production' during EVERY Vercel build (preview deployments included, not just
// real Production ones) -- drizzle.config.ts's dbUrl selection keys off NODE_ENV, so if
// migrations ran unconditionally here, every preview deployment (every branch push) would run
// `drizzle-kit migrate` against the PRODUCTION database before the code is even reviewed.
//
// VERCEL_ENV, unlike NODE_ENV, is actually accurate per deployment type ('production' |
// 'preview' | 'development') -- gating on that instead means migrations only ever run for a
// real Production deployment (i.e. a merge to the configured Production Branch), never for a
// preview build.
const { execSync } = require('child_process');

if (process.env.VERCEL_ENV === 'production') {
  console.log('[vercel-build] Production deployment — running pending migrations...');
  execSync('npx drizzle-kit migrate', { stdio: 'inherit' });
} else {
  console.log(`[vercel-build] Skipping migrations (VERCEL_ENV=${process.env.VERCEL_ENV ?? 'undefined'})`);
}

execSync('next build', { stdio: 'inherit' });
