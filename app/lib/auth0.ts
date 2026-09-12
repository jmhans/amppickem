import { Auth0Client } from '@auth0/nextjs-auth0/server';

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
    // Auth0 v4 filters out custom claims by default - preserve them from ID token
    if (session.idToken) {
      const idToken = session.idToken as Record<string, any>;
      const user = session.user as Record<string, any>;

      for (const namespace of ROLE_NAMESPACES) {
        const rolesKey = `${namespace}/roles`;
        if (idToken[rolesKey]) {
          user[rolesKey] = idToken[rolesKey];
        }
      }
    }

    return session;
  },
});
