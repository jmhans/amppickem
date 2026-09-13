import Link from 'next/link';

type Row = {
  participantId: number;
  name: string;
  rank: number;
  wins: number;
  losses: number;
  draws: number;
  lostPicks: number;
  winPct: number;
};

export default function WeeklyStandingsTable({ rows, claimedIds }: { rows: Row[]; claimedIds: Set<number> }) {
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
      {/* Mobile: stacked cards */}
      <div className="md:hidden space-y-3">
        {rows.map((row) => (
          <div key={row.participantId} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-400 tabular-nums">#{row.rank}</span>
                <Name row={row} />
              </div>
              <span className="text-sm text-gray-700 dark:text-gray-300 tabular-nums">{(row.winPct * 100).toFixed(1)}%</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
              <span>{record(row)}</span>
              <span>{row.lostPicks} lost pick{row.lostPicks === 1 ? '' : 's'}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: real table */}
      <div className="hidden md:block bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
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
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {rows.map((row) => (
              <tr key={row.participantId}>
                <td className="px-4 py-3 text-sm text-gray-500">{row.rank}</td>
                <td className="px-4 py-3 text-sm"><Name row={row} /></td>
                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{(row.winPct * 100).toFixed(1)}%</td>
                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.wins}</td>
                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.losses}</td>
                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.draws}</td>
                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.lostPicks}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-sm text-gray-500">No games this week yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
