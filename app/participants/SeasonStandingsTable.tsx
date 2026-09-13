'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { claimParticipantAccount } from '@/app/lib/actions';
import { useUser } from '@auth0/nextjs-auth0/client';

type Row = {
  participantId: number;
  name: string;
  rank: number;
  wins: number;
  losses: number;
  draws: number;
  lostPicks: number;
  winPct: number;
  gamesBack: number | null;
  rankChange: number | null;
  weeklyWins: number;
  curWonDollars: number;
};

function formatGB(gb: number | null): string {
  if (gb == null) return 'E';
  return gb % 1 === 0 ? String(gb) : gb.toFixed(1);
}

function formatChange(change: number | null): string {
  if (change == null) return '-';
  if (change === 0) return 'E';
  return change > 0 ? `+${change}` : String(change);
}

function formatDollars(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export default function SeasonStandingsTable({
  rows,
  claimedIds,
  myParticipantId,
  isLoggedIn,
}: {
  rows: Row[];
  claimedIds: Set<number>;
  myParticipantId: number | null;
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const { user } = useUser();
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleClaim(participantId: number) {
    if (!user?.sub) return;
    setError(null);
    setPendingId(participantId);
    startTransition(async () => {
      const result = await claimParticipantAccount(participantId, user.sub!);
      setPendingId(null);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error ?? 'Failed to claim');
      }
    });
  }

  function record(row: Row) {
    return `${row.wins}-${row.losses}-${row.draws}`;
  }

  function Name({ row }: { row: Row }) {
    return claimedIds.has(row.participantId) ? (
      <Link href={`/picks/${row.participantId}`} className="font-medium text-blue-600 hover:text-blue-500">
        {row.name}
      </Link>
    ) : (
      <span className="font-medium text-gray-900 dark:text-white">{row.name}</span>
    );
  }

  return (
    <div>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {/* Mobile: stacked cards */}
      <div className="md:hidden space-y-3">
        {rows.map((row) => (
          <div key={row.participantId} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-400 tabular-nums">#{row.rank}</span>
                <Name row={row} />
                {row.participantId === myParticipantId && <span className="text-xs font-medium text-blue-600">You</span>}
              </div>
              <span className="text-sm text-gray-700 dark:text-gray-300 tabular-nums">{(row.winPct * 100).toFixed(1)}%</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600 dark:text-gray-300">
              <span>{record(row)}</span>
              <span>GB {formatGB(row.gamesBack)}</span>
              <span>{row.lostPicks} lost</span>
              <span>{row.weeklyWins} skin{row.weeklyWins === 1 ? '' : 's'}</span>
              <span className="font-medium text-green-700 dark:text-green-400">{formatDollars(row.curWonDollars)}</span>
            </div>
            {!claimedIds.has(row.participantId) && isLoggedIn && (
              <button
                onClick={() => handleClaim(row.participantId)}
                disabled={pendingId === row.participantId}
                className="mt-2 text-sm text-blue-600 hover:text-blue-500 disabled:opacity-50"
              >
                {pendingId === row.participantId ? 'Claiming…' : 'Claim'}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Desktop: real table */}
      <div className="hidden md:block bg-white dark:bg-gray-800 shadow rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 tabular-nums">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">#</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Entry</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Win %</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Wins</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Losses</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Draws</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Lost Picks</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">GB</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">G/L</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Skins</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Cur Won $</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {rows.map((row) => (
              <tr key={row.participantId}>
                <td className="px-4 py-3 text-sm text-gray-500">{row.rank}</td>
                <td className="px-4 py-3 text-sm">
                  <Name row={row} />
                  {row.participantId === myParticipantId && <span className="ml-2 text-xs font-medium text-blue-600">(you)</span>}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{(row.winPct * 100).toFixed(1)}%</td>
                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.wins}</td>
                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.losses}</td>
                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.draws}</td>
                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.lostPicks}</td>
                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{formatGB(row.gamesBack)}</td>
                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{formatChange(row.rankChange)}</td>
                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.weeklyWins}</td>
                <td className="px-4 py-3 text-sm font-medium text-green-700 dark:text-green-400">{formatDollars(row.curWonDollars)}</td>
                <td className="px-4 py-3 text-sm text-right">
                  {!claimedIds.has(row.participantId) && isLoggedIn && (
                    <button
                      onClick={() => handleClaim(row.participantId)}
                      disabled={pendingId === row.participantId}
                      className="text-blue-600 hover:text-blue-500 disabled:opacity-50"
                    >
                      {pendingId === row.participantId ? 'Claiming…' : 'Claim'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={12} className="px-4 py-6 text-center text-sm text-gray-500">No participants yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
