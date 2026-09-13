import Image from 'next/image';
import { teamLogoUrl } from '@/app/lib/team-logos';
import { isPickLocked } from '@/app/lib/pick-lock';
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

function LockIcon({ locked, className }: { locked: boolean; className?: string }) {
  return locked ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  );
}

// Selected-button color communicates the graded result once one exists; blue just means "your pick, not graded yet".
function selectedClasses(result: BoardPick['result'] | undefined): string {
  switch (result) {
    case 'win':
      return 'border-green-600 bg-green-600 text-white dark:border-green-500 dark:bg-green-600';
    case 'loss':
      return 'border-red-600 bg-red-600 text-white dark:border-red-500 dark:bg-red-600';
    case 'push':
    case 'void':
      return 'border-gray-400 bg-gray-400 text-white dark:border-gray-500 dark:bg-gray-600';
    default:
      return 'border-blue-600 bg-blue-600 text-white';
  }
}

function MiniPickButton({
  label,
  selected,
  result,
  disabled,
  saving,
  onClick,
}: {
  label: string;
  selected: boolean;
  result?: BoardPick['result'];
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
          ? selectedClasses(result)
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
  isAdminUser,
  savingKey,
  onPick,
  onToggleLock,
}: {
  game: BoardGame;
  spreadPick?: BoardPick;
  totalPick?: BoardPick;
  canEdit: boolean;
  isAdminUser: boolean;
  savingKey: string | null;
  onPick: (gameId: number, pickType: 'spread' | 'over_under', selection: string) => void;
  onToggleLock: (gameId: number, currentlyLocked: boolean) => void;
}) {
  const locked = isPickLocked(game);
  const disabledByLock = locked && !isAdminUser;

  return (
    <div className="flex w-[180px] shrink-0 snap-start flex-col gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2.5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">{formatCardTime(game.gameTime)}</span>
        <div className="flex items-center gap-1.5">
          {game.isFinal && (
            <span className="text-[10px] font-semibold text-gray-500">
              F {game.awayScore}-{game.homeScore}
            </span>
          )}
          {isAdminUser ? (
            <button
              type="button"
              onClick={() => onToggleLock(game.id, locked)}
              title={locked ? 'Locked — click to unlock' : 'Unlocked — click to lock'}
              className={`flex h-4 w-4 items-center justify-center rounded ${locked ? 'text-amber-600' : 'text-gray-300 dark:text-gray-600'} hover:text-amber-500`}
            >
              <LockIcon locked={locked} className="h-3.5 w-3.5" />
            </button>
          ) : (
            locked && <LockIcon locked className="h-3.5 w-3.5 text-gray-400" />
          )}
        </div>
      </div>

      <div className="flex items-center justify-center gap-1">
        <Image src={teamLogoUrl(game.awayTeam)} alt={game.awayTeam} width={24} height={24} className="h-6 w-6" unoptimized />
        <span className="text-xs font-semibold text-gray-900 dark:text-white">{game.awayTeam}</span>
        <span className="text-[10px] text-gray-400">@</span>
        <span className="text-xs font-semibold text-gray-900 dark:text-white">{game.homeTeam}</span>
        <Image src={teamLogoUrl(game.homeTeam)} alt={game.homeTeam} width={24} height={24} className="h-6 w-6" unoptimized />
      </div>

      <div>
        <div className="mb-1 text-[9px] uppercase tracking-wide text-gray-400">Spread</div>
        <div className="grid grid-cols-2 gap-1">
          <MiniPickButton
            label={game.spread != null ? `${game.awayTeam} ${formatSpread(false, game.spread)}` : `${game.awayTeam} -`}
            selected={spreadPick?.selection === 'away'}
            result={spreadPick?.result}
            disabled={!canEdit || disabledByLock || game.spread == null}
            saving={savingKey === `${game.id}-spread`}
            onClick={() => onPick(game.id, 'spread', 'away')}
          />
          <MiniPickButton
            label={game.spread != null ? `${game.homeTeam} ${formatSpread(true, game.spread)}` : `${game.homeTeam} -`}
            selected={spreadPick?.selection === 'home'}
            result={spreadPick?.result}
            disabled={!canEdit || disabledByLock || game.spread == null}
            saving={savingKey === `${game.id}-spread`}
            onClick={() => onPick(game.id, 'spread', 'home')}
          />
        </div>
      </div>

      <div>
        <div className="mb-1 text-[9px] uppercase tracking-wide text-gray-400">Total</div>
        <div className="grid grid-cols-2 gap-1">
          <MiniPickButton
            label={game.overUnder != null ? `O ${game.overUnder}` : 'O -'}
            selected={totalPick?.selection === 'over'}
            result={totalPick?.result}
            disabled={!canEdit || disabledByLock || game.overUnder == null}
            saving={savingKey === `${game.id}-over_under`}
            onClick={() => onPick(game.id, 'over_under', 'over')}
          />
          <MiniPickButton
            label={game.overUnder != null ? `U ${game.overUnder}` : 'U -'}
            selected={totalPick?.selection === 'under'}
            result={totalPick?.result}
            disabled={!canEdit || disabledByLock || game.overUnder == null}
            saving={savingKey === `${game.id}-over_under`}
            onClick={() => onPick(game.id, 'over_under', 'under')}
          />
        </div>
      </div>
    </div>
  );
}
