import { auth0 } from '@/app/lib/auth0';
import {
  getParticipants,
  getOrCreateActiveSeason,
  getLatestStandingsWeek,
  getWeeklyStandings,
  getSeasonStandings,
} from '@/app/lib/actions';
import StandingsTabs from './StandingsTabs';
import RefreshResultsButton from './RefreshResultsButton';

export const dynamic = 'force-dynamic';

export default async function ParticipantsPage() {
  const [session, participantsList, season] = await Promise.all([
    auth0.getSession(),
    getParticipants(),
    getOrCreateActiveSeason(),
  ]);

  const initialWeek = await getLatestStandingsWeek(season.id);
  const [weeklyRows, seasonRows] = await Promise.all([
    getWeeklyStandings(season.id, initialWeek),
    getSeasonStandings(season.id),
  ]);

  const claimedIds = new Set(participantsList.filter((p) => p.isActive && p.auth0Id).map((p) => p.id));
  const myParticipant = participantsList.find((p) => !!session?.user?.sub && p.auth0Id === session.user.sub);
  const weeks = Array.from({ length: season.lastWeek - season.firstWeek + 1 }, (_, i) => season.firstWeek + i);

  return (
    <main>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{season.name} Standings</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Unclaimed entries can be claimed by any logged-in user.
          </p>
        </div>
        {session?.user && <RefreshResultsButton />}
      </div>

      <div className="mt-5">
        <StandingsTabs
          seasonId={season.id}
          weeks={weeks}
          initialWeek={initialWeek}
          initialWeeklyRows={weeklyRows}
          seasonRows={seasonRows}
          claimedIds={claimedIds}
          myParticipantId={myParticipant?.id ?? null}
          isLoggedIn={!!session?.user}
        />
      </div>
    </main>
  );
}
