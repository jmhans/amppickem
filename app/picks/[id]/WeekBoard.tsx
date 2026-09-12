export type BoardGame = {
  id: number;
  homeTeam: string;
  awayTeam: string;
  spread: number | null;
  overUnder: number | null;
  homeScore: number | null;
  awayScore: number | null;
  isFinal: boolean;
  gameTime: string | Date | null;
};

export type BoardPick = {
  gameId: number;
  pickType: 'spread' | 'over_under';
  selection: string;
  result: 'pending' | 'win' | 'loss' | 'push' | 'void';
};

function formatSpread(teamIsHome: boolean, spread: number | null): string {
  if (spread == null) return '';
  // spread is the HOME team's line; the away team's line is the negation.
  const line = teamIsHome ? spread : -spread;
  return line > 0 ? `+${line}` : `${line}`;
}

function resultBadge(result?: BoardPick['result']) {
  if (!result || result === 'pending') return null;
  const styles: Record<string, string> = {
    win: 'bg-green-100 text-green-800',
    loss: 'bg-red-100 text-red-800',
    push: 'bg-gray-100 text-gray-700',
    void: 'bg-gray-100 text-gray-500',
  };
  const labels: Record<string, string> = { win: 'W', loss: 'L', push: 'P', void: 'V' };
  return (
    <span className={`ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${styles[result]}`}>
      {labels[result]}
    </span>
  );
}

function PickButton({
  label,
  selected,
  disabled,
  saving,
  onClick,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  saving: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || saving}
      className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        selected
          ? 'border-blue-600 bg-blue-600 text-white'
          : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
      }`}
    >
      {saving ? '…' : label}
    </button>
  );
}

export default function WeekBoard({
  games,
  picks,
  canEdit,
  savingKey,
  onPick,
}: {
  games: BoardGame[];
  picks: BoardPick[];
  canEdit: boolean;
  savingKey: string | null;
  onPick: (gameId: number, pickType: 'spread' | 'over_under', selection: string) => void;
}) {
  if (games.length === 0) {
    return (
      <p className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 text-center text-sm text-gray-500">
        No games available to pick yet for this week — lines haven&apos;t locked in.
      </p>
    );
  }

  function pickFor(gameId: number, pickType: 'spread' | 'over_under') {
    return picks.find((p) => p.gameId === gameId && p.pickType === pickType);
  }

  return (
    <div className="space-y-3">
      {games.map((game) => {
        const spreadPick = pickFor(game.id, 'spread');
        const totalPick = pickFor(game.id, 'over_under');

        return (
          <div key={game.id} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {game.awayTeam} @ {game.homeTeam}
              </p>
              {game.isFinal && (
                <span className="text-xs font-medium text-gray-500">
                  Final {game.awayScore}-{game.homeScore}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Spread */}
              <div>
                <p className="mb-1 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 flex items-center">
                  Spread {resultBadge(spreadPick?.result)}
                </p>
                <div className="flex gap-2">
                  <PickButton
                    label={game.spread != null ? `${game.awayTeam} ${formatSpread(false, game.spread)}` : `${game.awayTeam} -`}
                    selected={spreadPick?.selection === 'away'}
                    disabled={!canEdit || game.spread == null}
                    saving={savingKey === `${game.id}-spread`}
                    onClick={() => onPick(game.id, 'spread', 'away')}
                  />
                  <PickButton
                    label={game.spread != null ? `${game.homeTeam} ${formatSpread(true, game.spread)}` : `${game.homeTeam} -`}
                    selected={spreadPick?.selection === 'home'}
                    disabled={!canEdit || game.spread == null}
                    saving={savingKey === `${game.id}-spread`}
                    onClick={() => onPick(game.id, 'spread', 'home')}
                  />
                </div>
              </div>

              {/* Over/Under */}
              <div>
                <p className="mb-1 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 flex items-center">
                  Total {resultBadge(totalPick?.result)}
                </p>
                <div className="flex gap-2">
                  <PickButton
                    label={game.overUnder != null ? `Over ${game.overUnder}` : 'Over -'}
                    selected={totalPick?.selection === 'over'}
                    disabled={!canEdit || game.overUnder == null}
                    saving={savingKey === `${game.id}-over_under`}
                    onClick={() => onPick(game.id, 'over_under', 'over')}
                  />
                  <PickButton
                    label={game.overUnder != null ? `Under ${game.overUnder}` : 'Under -'}
                    selected={totalPick?.selection === 'under'}
                    disabled={!canEdit || game.overUnder == null}
                    saving={savingKey === `${game.id}-over_under`}
                    onClick={() => onPick(game.id, 'over_under', 'under')}
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
