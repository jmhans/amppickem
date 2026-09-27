import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth0 } from '@/app/lib/auth0';
import { getParticipantsByAuth0Id, getOrCreateActiveSeason, getLatestStandingsWeek } from '@/app/lib/actions';
import { lusitana } from '@/app/ui/fonts';
import GameDayClient from './GameDayClient';

export const dynamic = 'force-dynamic';

/**
 * A logged-in user's own picks for the current week + live scores, one screen, mobile-first —
 * for glancing at during games rather than the full editable picks board. Always the current
 * pick cycle (see getLatestStandingsWeek) — no week selector, deliberately, since this page is
 * about "right now."  A user with multiple entries sees their first one, same convention
 * header.tsx's "My Picks" link already uses.
 */
export default async function GameDayPage() {
  const session = await auth0.getSession();
  if (!session?.user) redirect('/auth/login');

  const myParticipants = await getParticipantsByAuth0Id(session.user.sub);
  const participant = myParticipants[0];

  if (!participant) {
    return (
      <main className="space-y-5">
        <h1 className={`${lusitana.className} text-2xl md:text-3xl text-gray-900 dark:text-white`}>
          GameDay Dashboard
        </h1>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 text-center text-sm text-gray-500">
          <p>You don&apos;t have a claimed entry yet.</p>
          <Link href="/participants" className="mt-2 inline-block text-blue-600 hover:text-blue-500">
            Go claim one
          </Link>
        </div>
      </main>
    );
  }

  const season = await getOrCreateActiveSeason();
  const week = await getLatestStandingsWeek(season.id);

  return (
    <main className="mx-auto max-w-md space-y-4">
      <GameDayClient participantId={participant.id} seasonId={season.id} week={week} />
    </main>
  );
}
