import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth0 } from '@/app/lib/auth0';
import { isEffectiveAdmin } from '@/app/lib/admin-mode';
import { getParticipantById, getOrCreateActiveSeason, getLatestStandingsWeek } from '@/app/lib/actions';
import PicksClientWrapper from './PicksClientWrapper';
import ParticipantSettings from './ParticipantSettings';

export const dynamic = 'force-dynamic';

export default async function PicksPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ week?: string }>;
}) {
  const session = await auth0.getSession();
  if (!session?.user) redirect('/auth/login');

  const { id } = await params;
  const participantId = Number(id);
  const participant = await getParticipantById(participantId);
  if (!participant) redirect('/participants');

  const season = await getOrCreateActiveSeason();
  const resolvedSearchParams = (await searchParams) ?? {};
  const week = resolvedSearchParams.week ? Number(resolvedSearchParams.week) : await getLatestStandingsWeek(season.id);

  const isAdminUser = await isEffectiveAdmin(session.user);
  const canEdit = participant.auth0Id === session.user.sub || isAdminUser;

  return (
    <main>
      <div className="flex items-center gap-3 mb-4">
        <Link
          href="/participants"
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
          aria-label="Back to Standings"
        >
          <svg className="h-5 w-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
            <path d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
          </svg>
        </Link>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
          {participant.name} — Picks
        </h1>
      </div>

      {canEdit && (
        <ParticipantSettings
          participantId={participantId}
          initialName={participant.name}
          initialEmail={participant.email ?? ''}
          initialNotificationsEnabled={participant.notificationsEnabled}
          initialNotificationChannel={participant.notificationChannel}
        />
      )}

      <PicksClientWrapper
        participantId={participantId}
        seasonId={season.id}
        picksPerWeek={season.picksPerWeek}
        weeks={Array.from({ length: season.lastWeek - season.firstWeek + 1 }, (_, i) => season.firstWeek + i)}
        initialWeek={week}
        canEdit={canEdit}
        isAdminUser={isAdminUser}
      />
    </main>
  );
}
