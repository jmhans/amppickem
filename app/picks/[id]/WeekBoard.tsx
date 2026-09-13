import { groupGamesBySession } from '@/app/lib/game-sessions';
import GameCard from './GameCard';

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

  const sessions = groupGamesBySession(games);

  return (
    <div className="space-y-4">
      {sessions.map(({ session, games: sessionGames }) => (
        <div key={session.key}>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {session.label}
          </h3>
          <div className="flex gap-2.5 overflow-x-auto pb-1.5 snap-x snap-mandatory">
            {sessionGames.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                spreadPick={pickFor(game.id, 'spread')}
                totalPick={pickFor(game.id, 'over_under')}
                canEdit={canEdit}
                savingKey={savingKey}
                onPick={onPick}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
