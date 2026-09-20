import { redirect } from 'next/navigation';
import { auth0 } from '@/app/lib/auth0';
import { isAdmin } from '@/app/lib/auth-utils';
import { getOrCreateActiveSeason, getLatestStandingsWeek } from '@/app/lib/actions';
import HomeButton from '@/app/ui/home-button';
import { lusitana } from '@/app/ui/fonts';
import PicksStatusManager from './PicksStatusManager';

export const dynamic = 'force-dynamic';

export default async function AdminPicksStatusPage({
  searchParams,
}: {
  searchParams?: Promise<{ week?: string }>;
}) {
  const session = await auth0.getSession();
  if (!session?.user) redirect('/auth/login');
  if (!isAdmin(session.user)) redirect('/admin');

  const season = await getOrCreateActiveSeason();
  const params = (await searchParams) ?? {};
  const currentWeek = await getLatestStandingsWeek(season.id);
  const week = params.week ? Number(params.week) : currentWeek;
  const weeks = Array.from({ length: season.lastWeek - season.firstWeek + 1 }, (_, i) => season.firstWeek + i);

  return (
    <main className="flex min-h-screen flex-col p-6 bg-white dark:bg-gray-900">
      <HomeButton />

      <div className="flex h-20 shrink-0 items-end rounded-lg bg-blue-500 dark:bg-blue-600 p-4 md:h-32 mb-8 mt-4">
        <h1 className={`${lusitana.className} text-white text-3xl md:text-5xl`}>
          Weekly Picks
        </h1>
      </div>

      <PicksStatusManager seasonId={season.id} weeks={weeks} initialWeek={week} />
    </main>
  );
}
