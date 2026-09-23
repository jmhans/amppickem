import { redirect, notFound } from 'next/navigation';
import { auth0 } from '@/app/lib/auth0';
import { isAdmin } from '@/app/lib/auth-utils';
import { getOrCreateActiveSeason, getLatestStandingsWeek, getRecapById } from '@/app/lib/actions';
import { lusitana } from '@/app/ui/fonts';
import RecapEditor from '../RecapEditor';

export const dynamic = 'force-dynamic';

export default async function EditRecapPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth0.getSession();
  if (!session?.user) redirect('/auth/login');
  if (!isAdmin(session.user)) redirect('/admin');

  const { id } = await params;
  const recap = await getRecapById(Number(id));
  if (!recap) notFound();

  const season = await getOrCreateActiveSeason();
  const defaultWeek = await getLatestStandingsWeek(season.id);
  const weeks = Array.from({ length: season.lastWeek - season.firstWeek + 1 }, (_, i) => season.firstWeek + i);

  return (
    <main className="space-y-5">
      <h1 className={`${lusitana.className} text-2xl md:text-3xl text-gray-900 dark:text-white`}>
        Edit Recap
      </h1>

      <RecapEditor
        seasonId={season.id}
        weeks={weeks}
        defaultWeek={defaultWeek}
        recap={{
          id: recap.id,
          week: recap.week,
          title: recap.title,
          body: recap.body,
          publishedAt: recap.publishedAt ? recap.publishedAt.toISOString() : null,
        }}
      />
    </main>
  );
}
