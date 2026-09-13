'use client';

import { useState, useTransition } from 'react';
import { updateSeasonSettings, setPayoutTiers } from '@/app/lib/actions';

type Season = {
  id: number;
  name: string;
  year: number;
  picksPerWeek: number;
  firstWeek: number;
  lastWeek: number;
  lineLockDayOfWeek: number;
  lineLockHour: number;
  lineLockTimezone: string;
  entryFee: number;
  weeklyPotPerWeek: number;
  lostPicksPrizeAmount: number;
};

type Tier = { rank: number; percentage: number };

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function NumberField({ label, value, onChange, step = '1' }: { label: string; value: number; onChange: (v: number) => void; step?: string }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white px-2 py-1.5 text-sm"
      />
    </label>
  );
}

export default function SeasonSettings({ season, initialTiers }: { season: Season; initialTiers: Tier[] }) {
  const [picksPerWeek, setPicksPerWeek] = useState(season.picksPerWeek);
  const [firstWeek, setFirstWeek] = useState(season.firstWeek);
  const [lastWeek, setLastWeek] = useState(season.lastWeek);
  const [lineLockDayOfWeek, setLineLockDayOfWeek] = useState(season.lineLockDayOfWeek);
  const [lineLockHour, setLineLockHour] = useState(season.lineLockHour);
  const [lineLockTimezone, setLineLockTimezone] = useState(season.lineLockTimezone);
  const [entryFee, setEntryFee] = useState(season.entryFee);
  const [weeklyPotPerWeek, setWeeklyPotPerWeek] = useState(season.weeklyPotPerWeek);
  const [lostPicksPrizeAmount, setLostPicksPrizeAmount] = useState(season.lostPicksPrizeAmount);
  const [tiers, setTiers] = useState<Tier[]>(initialTiers.length > 0 ? initialTiers : [{ rank: 1, percentage: 0 }]);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const tierTotal = tiers.reduce((a, t) => a + t.percentage, 0);

  function updateTier(index: number, field: keyof Tier, value: number) {
    setTiers((prev) => prev.map((t, i) => (i === index ? { ...t, [field]: value } : t)));
  }

  function addTier() {
    const nextRank = Math.max(0, ...tiers.map((t) => t.rank)) + 1;
    setTiers((prev) => [...prev, { rank: nextRank, percentage: 0 }]);
  }

  function removeTier(index: number) {
    setTiers((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSave() {
    setMessage(null);
    startTransition(async () => {
      const [settingsResult, tiersResult] = await Promise.all([
        updateSeasonSettings(season.id, {
          picksPerWeek,
          firstWeek,
          lastWeek,
          lineLockDayOfWeek,
          lineLockHour,
          lineLockTimezone,
          entryFee,
          weeklyPotPerWeek,
          lostPicksPrizeAmount,
        }),
        setPayoutTiers(season.id, tiers),
      ]);
      if (settingsResult.success && tiersResult.success) {
        setMessage('Saved.');
      } else {
        setMessage(settingsResult.error ?? tiersResult.error ?? 'Failed to save');
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{season.name} ({season.year})</h2>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
          <NumberField label="Picks per week" value={picksPerWeek} onChange={setPicksPerWeek} />
          <NumberField label="First week" value={firstWeek} onChange={setFirstWeek} />
          <NumberField label="Last week" value={lastWeek} onChange={setLastWeek} />
        </div>

        <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Lines Lock</h3>
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-4">
          <label className="block">
            <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">Day of week</span>
            <select
              value={lineLockDayOfWeek}
              onChange={(e) => setLineLockDayOfWeek(Number(e.target.value))}
              className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white px-2 py-1.5 text-sm"
            >
              {DAY_NAMES.map((d, i) => (
                <option key={d} value={i}>{d}</option>
              ))}
            </select>
          </label>
          <NumberField label="Hour (24h)" value={lineLockHour} onChange={setLineLockHour} />
          <label className="block">
            <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">Timezone</span>
            <input
              type="text"
              value={lineLockTimezone}
              onChange={(e) => setLineLockTimezone(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white px-2 py-1.5 text-sm"
            />
          </label>
        </div>

        <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Payouts</h3>
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-4">
          <NumberField label="Entry fee ($)" value={entryFee} onChange={setEntryFee} step="0.01" />
          <NumberField label="Weekly pot ($/week)" value={weeklyPotPerWeek} onChange={setWeeklyPotPerWeek} step="0.01" />
          <NumberField label="Lost Picks prize ($)" value={lostPicksPrizeAmount} onChange={setLostPicksPrizeAmount} step="0.01" />
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Season-End Payout Tiers</h2>
          <span className={`text-sm font-medium ${tierTotal > 100 ? 'text-red-600' : 'text-gray-500'}`}>
            {tierTotal.toFixed(1)}% of remainder
          </span>
        </div>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Percentage of the remainder pool (total entry fees minus the weekly skins pool minus the Lost Picks prize) paid to each season-standings rank.
        </p>

        <div className="mt-4 space-y-2">
          {tiers.map((tier, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-16 text-sm text-gray-500">Rank</span>
              <input
                type="number"
                value={tier.rank}
                onChange={(e) => updateTier(i, 'rank', Number(e.target.value))}
                className="w-20 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white px-2 py-1.5 text-sm"
              />
              <span className="text-sm text-gray-500">gets</span>
              <input
                type="number"
                step="0.1"
                value={tier.percentage}
                onChange={(e) => updateTier(i, 'percentage', Number(e.target.value))}
                className="w-24 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white px-2 py-1.5 text-sm"
              />
              <span className="text-sm text-gray-500">%</span>
              <button
                type="button"
                onClick={() => removeTier(i)}
                className="ml-auto text-sm text-red-600 hover:text-red-500"
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addTier}
          className="mt-3 text-sm text-blue-600 hover:text-blue-500"
        >
          + Add tier
        </button>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white transition-colors"
        >
          {isPending ? 'Saving…' : 'Save Settings'}
        </button>
        {message && <span className="text-sm text-gray-600 dark:text-gray-300">{message}</span>}
      </div>
    </div>
  );
}
