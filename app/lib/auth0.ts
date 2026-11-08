import { Auth0Client, filterDefaultIdTokenClaims } from '@auth0/nextjs-auth0/server';

// Shared Auth0 tenant/application with amp-playoff-fantasy — one login across pools.
// The roles claim is injected by an Auth0 Action on the shared tenant, keyed by a
// namespace. amp-pickem uses its own namespace (https://amp-pickem.vercel.app/roles,
// role 'pickem_admin'), but the Action may not have been updated to emit it yet, so we
// also copy the existing shared-app namespace as a fallback — remove once the Action is
// confirmed updated and the shared namespace is no longer needed here.
const ROLE_NAMESPACES = [
  'https://amp-pickem.vercel.app',
  'https://fantasyplayofffootball.vercel.app',
];

export const auth0 = new Auth0Client({
  beforeSessionSaved: async (session) => {
    // Defining this hook disables the SDK's default claim filtering, so session.user
    // arrives holding every ID token claim (iss, aud, iat, exp, sid, nonce, ...), which
    // bloats the session cookie. Re-apply the default filter and keep only the role claims.
    const claims = session.user as Record<string, unknown>;
    const user = filterDefaultIdTokenClaims(claims) as Record<string, unknown>;

    for (const namespace of ROLE_NAMESPACES) {
      const rolesKey = `${namespace}/roles`;
      if (claims[rolesKey]) {
        user[rolesKey] = claims[rolesKey];
      }
    }

    // The app never calls getAccessToken or any Auth0-protected API, so the access and
    // refresh tokens are dead weight in the cookie. Keep only the ID token (used as
    // id_token_hint on logout). Re-add them here if an API call ever needs them.
    const { idToken, expiresAt } = session.tokenSet;

    return {
      ...session,
      user: { ...user, sub: session.user.sub },
      tokenSet: { accessToken: '', idToken, expiresAt },
    };
  },
});
