import { redirect } from 'next/navigation';
import { auth0 } from '@/app/lib/auth0';
import { isAdmin } from '@/app/lib/auth-utils';
import { getOrCreateActiveSeason } from '@/app/lib/actions';
import { lusitana } from '@/app/ui/fonts';
import ResultsManager from './ResultsManager';

export const dynamic = 'force-dynamic';

export default async function AdminResultsPage({
  searchParams,
}: {
  searchParams?: Promise<{ week?: string }>;
}) {
  const session = await auth0.getSession();
  if (!session?.user) redirect('/auth/login');
  if (!isAdmin(session.user)) redirect('/admin');

  const season = await getOrCreateActiveSeason();
  const params = (await searchParams) ?? {};
  const week = params.week ? Number(params.week) : season.firstWeek;
  const weeks = Array.from({ length: season.lastWeek - season.firstWeek + 1 }, (_, i) => season.firstWeek + i);

  return (
    <main className="space-y-5">
      <h1 className={`${lusitana.className} text-2xl md:text-3xl text-gray-900 dark:text-white`}>
        Results
      </h1>

      <ResultsManager weeks={weeks} initialWeek={week} />
    </main>
  );
}
