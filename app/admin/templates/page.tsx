import { redirect } from 'next/navigation';
import { auth0 } from '@/app/lib/auth0';
import { isAdmin } from '@/app/lib/auth-utils';
import { getOrCreateActiveSeason, listWeekTemplates } from '@/app/lib/actions';
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
    <main className="space-y-5">
      <h1 className={`${lusitana.className} text-2xl md:text-3xl text-gray-900 dark:text-white`}>
        Week Templates
      </h1>

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
