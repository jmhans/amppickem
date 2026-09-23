import { redirect } from 'next/navigation';
import { auth0 } from '@/app/lib/auth0';
import { isAdmin } from '@/app/lib/auth-utils';
import { getOrCreateActiveSeason, getPayoutTiers } from '@/app/lib/actions';
import { lusitana } from '@/app/ui/fonts';
import SeasonSettings from './SeasonSettings';

export const dynamic = 'force-dynamic';

export default async function AdminSeasonsPage() {
  const session = await auth0.getSession();
  if (!session?.user) redirect('/auth/login');
  if (!isAdmin(session.user)) redirect('/admin');

  const season = await getOrCreateActiveSeason();
  const tiers = await getPayoutTiers(season.id);

  return (
    <main className="space-y-5">
      <h1 className={`${lusitana.className} text-2xl md:text-3xl text-gray-900 dark:text-white`}>
        Season Settings
      </h1>

      <SeasonSettings season={season} initialTiers={tiers.map((t) => ({ rank: t.rank, percentage: t.percentage }))} />
    </main>
  );
}
