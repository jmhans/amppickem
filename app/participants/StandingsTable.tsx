'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { claimParticipantAccount } from '@/app/lib/actions';
import { useUser } from '@auth0/nextjs-auth0/client';

type Row = {
  id: number;
  name: string;
  isClaimed: boolean;
  isMine: boolean;
  wins: number;
  losses: number;
  pushes: number;
  pending: number;
  winPct: number;
};

export default function StandingsTable({ rows, isLoggedIn }: { rows: Row[]; isLoggedIn: boolean }) {
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
    return `${row.wins}-${row.losses}-${row.pushes}`;
  }

  return (
    <div>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {/* Mobile: stacked cards */}
      <div className="md:hidden space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              {row.isClaimed ? (
                <Link href={`/picks/${row.id}`} className="font-medium text-blue-600 hover:text-blue-500">
                  {row.name}
                </Link>
              ) : (
                <span className="font-medium text-gray-900 dark:text-white">{row.name}</span>
              )}
              {row.isMine && <span className="text-xs font-medium text-blue-600">You</span>}
            </div>
            <div className="mt-1 flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
              <span>{record(row)}{row.pending > 0 ? ` (${row.pending} pending)` : ''}</span>
              <span>{(row.winPct * 100).toFixed(0)}%</span>
            </div>
            {!row.isClaimed && isLoggedIn && (
              <button
                onClick={() => handleClaim(row.id)}
                disabled={pendingId === row.id}
                className="mt-2 text-sm text-blue-600 hover:text-blue-500 disabled:opacity-50"
              >
                {pendingId === row.id ? 'Claiming…' : 'Claim'}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Desktop: real table */}
      <div className="hidden md:block bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Record</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Pending</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Win %</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3 text-sm">
                  {row.isClaimed ? (
                    <Link href={`/picks/${row.id}`} className="font-medium text-blue-600 hover:text-blue-500">
                      {row.name}
                    </Link>
                  ) : (
                    <span className="font-medium text-gray-900 dark:text-white">{row.name}</span>
                  )}
                  {row.isMine && <span className="ml-2 text-xs font-medium text-blue-600">(you)</span>}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{record(row)}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{row.pending || '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{(row.winPct * 100).toFixed(0)}%</td>
                <td className="px-4 py-3 text-sm text-right">
                  {!row.isClaimed && isLoggedIn && (
                    <button
                      onClick={() => handleClaim(row.id)}
                      disabled={pendingId === row.id}
                      className="text-blue-600 hover:text-blue-500 disabled:opacity-50"
                    >
                      {pendingId === row.id ? 'Claiming…' : 'Claim'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">No participants yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
