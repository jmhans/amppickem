import { redirect, notFound } from 'next/navigation';
import { auth0 } from '@/app/lib/auth0';
import { isAdmin } from '@/app/lib/auth-utils';
import { getOrCreateActiveSeason, getLatestStandingsWeek, getRecapById } from '@/app/lib/actions';
import HomeButton from '@/app/ui/home-button';
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
    <main className="flex min-h-screen flex-col p-6 bg-white dark:bg-gray-900">
      <HomeButton />

      <div className="flex h-20 shrink-0 items-end rounded-lg bg-blue-500 dark:bg-blue-600 p-4 md:h-32 mb-8 mt-4">
        <h1 className={`${lusitana.className} text-white text-3xl md:text-5xl`}>
          Edit Recap
        </h1>
      </div>

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
