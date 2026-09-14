import { teamFullName } from '@/app/lib/team-names';
import type { BoardGameRow, BoardPickEntry } from '@/app/lib/actions';

function formatKickoff(gameTime: Date | string | null): string {
  if (!gameTime) return 'Time TBD';
  const d = new Date(gameTime);
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${weekday}, ${time}`;
}

function formatBracket(n: number | null): string {
  if (n == null) return '';
  return n > 0 ? `[+${n}]` : `[${n}]`;
}

type Outcome = 'home' | 'away' | 'over' | 'under' | 'push' | null;

// Cell color reflects whether THIS side actually covered/hit — independent of who picked it,
// so an empty cell for a losing side still reads at a glance.
function cellClasses(winner: Outcome, thisSide: 'home' | 'away' | 'over' | 'under'): string {
  if (winner == null) return 'bg-gray-50 dark:bg-gray-800/50';
  if (winner === 'push') return 'bg-yellow-100 dark:bg-yellow-900/30';
  return winner === thisSide
    ? 'bg-green-100 dark:bg-green-900/30'
    : 'bg-red-100 dark:bg-red-900/30';
}

function PickList({ picks }: { picks: BoardPickEntry[] }) {
  if (picks.length === 0) return <span className="text-gray-300 dark:text-gray-600">—</span>;
  return (
    <span>
      <span className="font-semibold text-gray-500 dark:text-gray-400">[{picks.length}] </span>
      {picks.map((p) => p.name).join(', ')}
    </span>
  );
}

export default function BoardTable({ rows }: { rows: BoardGameRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 text-center text-sm text-gray-500">
        No games locked in yet for this week.
      </p>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Kickoff</th>
            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Matchup</th>
            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Line</th>
            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">O/U</th>
            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Away</th>
            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Home</th>
            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Under</th>
            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Over</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {rows.map((g) => (
            <tr key={g.id}>
              <td className="px-3 py-2 align-top whitespace-nowrap text-gray-500 dark:text-gray-400">
                {formatKickoff(g.gameTime)}
                {g.isFinal && (
                  <div className="text-xs font-medium text-gray-400">Final {g.awayScore}-{g.homeScore}</div>
                )}
              </td>
              <td className="px-3 py-2 align-top whitespace-nowrap text-gray-900 dark:text-white">
                {teamFullName(g.awayTeam)}<br />@ {teamFullName(g.homeTeam)}
              </td>
              <td className="px-3 py-2 align-top tabular-nums text-gray-700 dark:text-gray-300">
                {g.spread ?? '-'}
                {g.actualMargin != null && <div className="text-xs text-gray-400">{formatBracket(g.actualMargin)}</div>}
              </td>
              <td className="px-3 py-2 align-top tabular-nums text-gray-700 dark:text-gray-300">
                {g.overUnder ?? '-'}
                {g.actualTotal != null && <div className="text-xs text-gray-400">[{g.actualTotal}]</div>}
              </td>
              <td className={`px-3 py-2 align-top ${cellClasses(g.spreadWinner, 'away')}`}>
                <PickList picks={g.awayPicks} />
              </td>
              <td className={`px-3 py-2 align-top ${cellClasses(g.spreadWinner, 'home')}`}>
                <PickList picks={g.homePicks} />
              </td>
              <td className={`px-3 py-2 align-top ${cellClasses(g.totalWinner, 'under')}`}>
                <PickList picks={g.underPicks} />
              </td>
              <td className={`px-3 py-2 align-top ${cellClasses(g.totalWinner, 'over')}`}>
                <PickList picks={g.overPicks} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
