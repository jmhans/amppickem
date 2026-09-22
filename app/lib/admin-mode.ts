import { cookies } from 'next/headers';
import { isAdmin } from '@/app/lib/auth-utils';

// Server-only (imports next/headers) — never import this from a 'use client' component;
// auth-utils.ts's plain isAdmin() stays the client-safe one for UI checks like "show the
// Admin Mode toggle at all".
export const ADMIN_MODE_COOKIE = 'admin_mode';

/**
 * Whether admin-only behavior (seeing/editing other participants' picks pre-kickoff, the
 * per-game lock toggle, exporting/emailing someone else's picks, etc.) is actually active
 * for this request. Two-factor: the user must genuinely be an admin — checked from the real
 * Auth0 session, never trusted from the client — AND have explicitly opted into "Admin
 * Mode" via the navbar toggle (see header.tsx, actions.ts's getAdminMode/setAdminMode).
 * Defaults to off, so a logged-in admin browses the site exactly like a regular participant
 * — including the pick-privacy rules — until they flip it on.
 */
export async function isEffectiveAdmin(user: Record<string, unknown> | undefined): Promise<boolean> {
  if (!isAdmin(user)) return false;
  const store = await cookies();
  return store.get(ADMIN_MODE_COOKIE)?.value === 'on';
}
