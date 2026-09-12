'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createParticipant, unclaimParticipant, setParticipantActive } from '@/app/lib/actions';

type Participant = {
  id: number;
  name: string;
  email: string | null;
  auth0Id: string | null;
  isActive: boolean;
};

export default function ParticipantsAdmin({ participants }: { participants: Participant[] }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAdd() {
    setError(null);
    startTransition(async () => {
      const result = await createParticipant(name, email || null);
      if (result.success) {
        setName('');
        setEmail('');
        router.refresh();
      } else {
        setError(result.error ?? 'Failed to add participant');
      }
    });
  }

  function handleUnclaim(id: number) {
    startTransition(async () => {
      await unclaimParticipant(id);
      router.refresh();
    });
  }

  function handleToggleActive(id: number, isActive: boolean) {
    startTransition(async () => {
      await setParticipantActive(id, !isActive);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Add Participant</h2>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 min-w-[160px] rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white px-3 py-2 text-sm"
          />
          <input
            type="email"
            placeholder="Email (optional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 min-w-[160px] rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white px-3 py-2 text-sm"
          />
          <button
            onClick={handleAdd}
            disabled={isPending || !name.trim()}
            className="flex h-10 items-center rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
          >
            Add
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      {/* Mobile: stacked cards */}
      <div className="md:hidden space-y-3">
        {participants.map((p) => (
          <div key={p.id} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{p.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{p.email ?? 'No email'}</p>
              </div>
              {!p.isActive && (
                <span className="text-xs font-medium text-gray-500 bg-gray-100 dark:bg-gray-700 dark:text-gray-300 px-2 py-0.5 rounded">Inactive</span>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-300">{p.auth0Id ? 'Claimed' : 'Unclaimed'}</span>
              <div className="flex gap-2">
                {p.auth0Id && (
                  <button onClick={() => handleUnclaim(p.id)} className="text-orange-600 hover:text-orange-500 text-xs font-medium">
                    Unclaim
                  </button>
                )}
                <button onClick={() => handleToggleActive(p.id, p.isActive)} className="text-gray-600 hover:text-gray-500 dark:text-gray-300 text-xs font-medium">
                  {p.isActive ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Email</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Claimed</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {participants.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{p.name}</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{p.email ?? '-'}</td>
                <td className="px-4 py-3 text-sm">
                  {p.isActive ? (
                    <span className="text-green-600">Active</span>
                  ) : (
                    <span className="text-gray-400">Inactive</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{p.auth0Id ? 'Yes' : 'No'}</td>
                <td className="px-4 py-3 text-sm space-x-3">
                  {p.auth0Id && (
                    <button onClick={() => handleUnclaim(p.id)} className="text-orange-600 hover:text-orange-500 font-medium">
                      Unclaim
                    </button>
                  )}
                  <button onClick={() => handleToggleActive(p.id, p.isActive)} className="text-gray-600 hover:text-gray-500 dark:text-gray-300 font-medium">
                    {p.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
            {participants.length === 0 && (
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
