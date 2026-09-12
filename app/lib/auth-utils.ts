const PICKEM_ROLES_KEY = 'https://amp-pickem.vercel.app/roles';
const SHARED_ROLES_KEY = 'https://fantasyplayofffootball.vercel.app/roles';

export function isAdmin(user: Record<string, unknown> | undefined): boolean {
  if (!user) return false;
  const roles = [
    ...((user[PICKEM_ROLES_KEY] as string[] | undefined) ?? []),
    ...((user[SHARED_ROLES_KEY] as string[] | undefined) ?? []),
  ];
  return roles.includes('pickem_admin');
}
