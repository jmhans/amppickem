import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth0 } from '@/app/lib/auth0';
import { isAdmin } from '@/app/lib/auth-utils';
import { getParticipantById, getOrCreateActiveSeason } from '@/app/lib/actions';
import PicksClientWrapper from './PicksClientWrapper';

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
  const week = resolvedSearchParams.week ? Number(resolvedSearchParams.week) : season.firstWeek;

  const canEdit = participant.auth0Id === session.user.sub || isAdmin(session.user);

  return (
    <main>
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/participants"
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
          aria-label="Back to Standings"
        >
          <svg className="h-6 w-6" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
            <path d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
          </svg>
        </Link>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
          {participant.name} — Picks
        </h1>
      </div>

      <PicksClientWrapper
        participantId={participantId}
        seasonId={season.id}
        picksPerWeek={season.picksPerWeek}
        weeks={Array.from({ length: season.lastWeek - season.firstWeek + 1 }, (_, i) => season.firstWeek + i)}
        initialWeek={week}
        canEdit={canEdit}
      />
    </main>
  );
}
