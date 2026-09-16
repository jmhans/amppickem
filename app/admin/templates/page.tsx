import { redirect } from 'next/navigation';
import { auth0 } from '@/app/lib/auth0';
import { isAdmin } from '@/app/lib/auth-utils';
import { getOrCreateActiveSeason, listWeekTemplates } from '@/app/lib/actions';
import HomeButton from '@/app/ui/home-button';
import { lusitana } from '@/app/ui/fonts';
import WeekTemplateManager from './WeekTemplateManager';

export const dynamic = 'force-dynamic';

export default async function AdminTemplatesPage() {
  const session = await auth0.getSession();
  if (!session?.user) redirect('/auth/login');
  if (!isAdmin(session.user)) redirect('/admin');

  const season = await getOrCreateActiveSeason();
  const templates = await listWeekTemplates(season.id);

  return (
    <main className="flex min-h-screen flex-col p-6 bg-white dark:bg-gray-900">
      <HomeButton />

      <div className="flex h-20 shrink-0 items-end rounded-lg bg-blue-500 dark:bg-blue-600 p-4 md:h-32 mb-8 mt-4">
        <h1 className={`${lusitana.className} text-white text-3xl md:text-5xl`}>
          Week Templates
        </h1>
      </div>

      <WeekTemplateManager
        seasonId={season.id}
        firstWeek={season.firstWeek}
        lastWeek={season.lastWeek}
        initialTemplates={templates.map((t) => ({
          week: t.week,
          fileName: t.fileName,
          uploadedBy: t.uploadedBy,
          uploadedAt: t.uploadedAt.toISOString(),
        }))}
      />
    </main>
  );
}
