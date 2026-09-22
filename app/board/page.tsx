import { redirect } from 'next/navigation';
import { auth0 } from '@/app/lib/auth0';
import { getOrCreateActiveSeason, getLatestStandingsWeek } from '@/app/lib/actions';
import BoardClientWrapper from './BoardClientWrapper';

export const dynamic = 'force-dynamic';

export default async function BoardPage({
  searchParams,
}: {
  searchParams?: Promise<{ week?: string }>;
}) {
  const session = await auth0.getSession();
  if (!session?.user) redirect('/auth/login');

  const season = await getOrCreateActiveSeason();
  const resolvedSearchParams = (await searchParams) ?? {};
  const week = resolvedSearchParams.week ? Number(resolvedSearchParams.week) : await getLatestStandingsWeek(season.id);
  const weeks = Array.from({ length: season.lastWeek - season.firstWeek + 1 }, (_, i) => season.firstWeek + i);

  return (
    <main>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-1">Pick Board</h1>
      <p className="mb-5 text-sm text-gray-600 dark:text-gray-400">
        Everyone&apos;s picks for the week, once lines are locked in — picks stay hidden until each game kicks off. Green covered/hit, red missed, yellow pushed.
      </p>

      <BoardClientWrapper seasonId={season.id} weeks={weeks} initialWeek={week} />
    </main>
  );
}
