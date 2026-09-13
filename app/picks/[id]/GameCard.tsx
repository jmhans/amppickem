import Image from 'next/image';
import { teamLogoUrl } from '@/app/lib/team-logos';
import type { BoardGame, BoardPick } from './WeekBoard';

function formatSpread(teamIsHome: boolean, spread: number | null): string {
  if (spread == null) return '';
  // spread is the HOME team's line; the away team's line is the negation.
  const line = teamIsHome ? spread : -spread;
  return line > 0 ? `+${line}` : `${line}`;
}

function formatCardTime(gameTime: Date | string | null): string {
  if (!gameTime) return 'Time TBD';
  const d = new Date(gameTime);
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${weekday} ${time}`;
}

function resultDot(result?: BoardPick['result']) {
  if (!result || result === 'pending') return null;
  const styles: Record<string, string> = {
    win: 'bg-green-500',
    loss: 'bg-red-500',
    push: 'bg-gray-400',
    void: 'bg-gray-300',
  };
  const labels: Record<string, string> = { win: 'W', loss: 'L', push: 'P', void: 'V' };
  return (
    <span className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[9px] font-bold text-white ${styles[result]}`}>
      {labels[result]}
    </span>
  );
}

function MiniPickButton({
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
      className={`rounded-md border px-1.5 py-1 text-[11px] font-medium leading-tight transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        selected
          ? 'border-blue-600 bg-blue-600 text-white'
          : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
      }`}
    >
      {saving ? '…' : label}
    </button>
  );
}

export default function GameCard({
  game,
  spreadPick,
  totalPick,
  canEdit,
  savingKey,
  onPick,
}: {
  game: BoardGame;
  spreadPick?: BoardPick;
  totalPick?: BoardPick;
  canEdit: boolean;
  savingKey: string | null;
  onPick: (gameId: number, pickType: 'spread' | 'over_under', selection: string) => void;
}) {
  return (
    <div className="flex w-[180px] shrink-0 snap-start flex-col gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2.5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">{formatCardTime(game.gameTime)}</span>
        {game.isFinal && (
          <span className="text-[10px] font-semibold text-gray-500">
            F {game.awayScore}-{game.homeScore}
          </span>
        )}
      </div>

      <div className="flex items-center justify-center gap-1">
        <Image src={teamLogoUrl(game.awayTeam)} alt={game.awayTeam} width={24} height={24} className="h-6 w-6" unoptimized />
        <span className="text-xs font-semibold text-gray-900 dark:text-white">{game.awayTeam}</span>
        <span className="text-[10px] text-gray-400">@</span>
        <span className="text-xs font-semibold text-gray-900 dark:text-white">{game.homeTeam}</span>
        <Image src={teamLogoUrl(game.homeTeam)} alt={game.homeTeam} width={24} height={24} className="h-6 w-6" unoptimized />
      </div>

      <div>
        <div className="mb-1 flex items-center gap-1 text-[9px] uppercase tracking-wide text-gray-400">
          Spread {resultDot(spreadPick?.result)}
        </div>
        <div className="grid grid-cols-2 gap-1">
          <MiniPickButton
            label={game.spread != null ? `${game.awayTeam} ${formatSpread(false, game.spread)}` : `${game.awayTeam} -`}
            selected={spreadPick?.selection === 'away'}
            disabled={!canEdit || game.spread == null}
            saving={savingKey === `${game.id}-spread`}
            onClick={() => onPick(game.id, 'spread', 'away')}
          />
          <MiniPickButton
            label={game.spread != null ? `${game.homeTeam} ${formatSpread(true, game.spread)}` : `${game.homeTeam} -`}
            selected={spreadPick?.selection === 'home'}
            disabled={!canEdit || game.spread == null}
            saving={savingKey === `${game.id}-spread`}
            onClick={() => onPick(game.id, 'spread', 'home')}
          />
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center gap-1 text-[9px] uppercase tracking-wide text-gray-400">
          Total {resultDot(totalPick?.result)}
        </div>
        <div className="grid grid-cols-2 gap-1">
          <MiniPickButton
            label={game.overUnder != null ? `O ${game.overUnder}` : 'O -'}
            selected={totalPick?.selection === 'over'}
            disabled={!canEdit || game.overUnder == null}
            saving={savingKey === `${game.id}-over_under`}
            onClick={() => onPick(game.id, 'over_under', 'over')}
          />
          <MiniPickButton
            label={game.overUnder != null ? `U ${game.overUnder}` : 'U -'}
            selected={totalPick?.selection === 'under'}
            disabled={!canEdit || game.overUnder == null}
            saving={savingKey === `${game.id}-over_under`}
            onClick={() => onPick(game.id, 'over_under', 'under')}
          />
        </div>
      </div>
    </div>
  );
}
