import { auth0 } from '@/app/lib/auth0';
import { getParticipants, getOrCreateActiveSeason, getStandings } from '@/app/lib/actions';
import StandingsTable from './StandingsTable';
import RefreshResultsButton from './RefreshResultsButton';

export const dynamic = 'force-dynamic';

export default async function ParticipantsPage() {
  const [session, participants, season] = await Promise.all([
    auth0.getSession(),
    getParticipants(),
    getOrCreateActiveSeason(),
  ]);
  const standings = await getStandings(season.id);
  const standingsByParticipantId = new Map(standings.map((s) => [s.participantId, s]));

  const rows = participants
    .filter((p) => p.isActive)
    .map((p) => {
      const record = standingsByParticipantId.get(p.id);
      return {
        id: p.id,
        name: p.name,
        isClaimed: !!p.auth0Id,
        isMine: !!session?.user?.sub && p.auth0Id === session.user.sub,
        wins: record?.wins ?? 0,
        losses: record?.losses ?? 0,
        pushes: record?.pushes ?? 0,
        pending: record?.pending ?? 0,
        winPct: record?.winPct ?? 0,
      };
    })
    .sort((a, b) => (b.wins !== a.wins ? b.wins - a.wins : a.losses !== b.losses ? a.losses - b.losses : b.winPct - a.winPct));

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
        <StandingsTable rows={rows} isLoggedIn={!!session?.user} />
      </div>
    </main>
  );
}
