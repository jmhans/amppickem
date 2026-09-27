'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@auth0/nextjs-auth0/client';
import { isAdmin } from '@/app/lib/auth-utils';
import { getParticipantsByAuth0Id, getAdminMode, setAdminMode } from '@/app/lib/actions';

interface Participant {
  id: number;
  name: string;
}

function AdminModeToggle({
  adminMode,
  toggling,
  onToggle,
}: {
  adminMode: boolean;
  toggling: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      disabled={toggling}
      aria-pressed={adminMode}
      title={adminMode
        ? "Admin Mode is ON — you can see/manage everyone's picks. Click to turn off."
        : 'Admin Mode is OFF — you see the site like a regular participant. Click to turn on.'}
      className="flex items-center gap-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 px-2.5 py-1.5 transition-colors disabled:opacity-50"
    >
      <span className="text-xs font-medium text-gray-700 dark:text-gray-200">Admin Mode</span>
      <span className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${adminMode ? 'bg-orange-400' : 'bg-gray-300 dark:bg-gray-600'}`}>
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${adminMode ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </span>
    </button>
  );
}

export default function UserDisplay() {
  const { user, isLoading } = useUser();
  const router = useRouter();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [adminMode, setAdminModeState] = useState(false);
  const [togglingAdminMode, setTogglingAdminMode] = useState(false);
  const userIsAdmin = !!user && isAdmin(user);

  useEffect(() => {
    if (user?.sub) {
      getParticipantsByAuth0Id(user.sub).then(setParticipants);
    }
  }, [user?.sub]);

  useEffect(() => {
    if (userIsAdmin) {
      getAdminMode().then(setAdminModeState);
    }
  }, [userIsAdmin]);

  async function handleToggleAdminMode() {
    if (togglingAdminMode) return;
    setTogglingAdminMode(true);
    const next = !adminMode;
    const result = await setAdminMode(next);
    if (result.success) {
      setAdminModeState(next);
      // Server components (picks/board pages) read the admin-mode cookie directly — refresh
      // so they re-render with the new value instead of showing stale data until next navigation.
      router.refresh();
    }
    setTogglingAdminMode(false);
  }

  if (isLoading) {
    return null;
  }

  if (user) {
    const userName = user.name || user.email || user.nickname || user.sub;

    return (
      <>
        {/* Desktop User Display — no dropdown here, so the toggle sits inline rather than tucked away */}
        <div className="hidden md:flex items-center gap-2">
          {userIsAdmin && (
            <AdminModeToggle adminMode={adminMode} toggling={togglingAdminMode} onToggle={handleToggleAdminMode} />
          )}
          <span className="text-sm text-gray-600 dark:text-gray-300">
            {userName}
          </span>
          <a
            href="/auth/logout"
            className="flex h-10 items-center rounded-lg bg-gray-600 px-4 text-sm font-medium text-white transition-colors hover:bg-gray-500"
          >
            Logout
          </a>
        </div>

        {/* Mobile User Icon Dropdown */}
        <div className="md:hidden relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            aria-label="User Menu"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
            </svg>
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black dark:ring-gray-700 ring-opacity-5 z-20">
              <div className="py-1" role="menu">
                <div className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700">
                  <div className="font-medium">{userName}</div>
                </div>

                {userIsAdmin && (
                  <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                    <AdminModeToggle adminMode={adminMode} toggling={togglingAdminMode} onToggle={handleToggleAdminMode} />
                  </div>
                )}

                {participants.length > 0 && (
                  <>
                    <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      My Entries
                    </div>
                    {participants.map((participant) => (
                      <Link
                        key={participant.id}
                        href={`/picks/${participant.id}`}
                        className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        {participant.name}
                      </Link>
                    ))}
                    <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                  </>
                )}

                <a
                  href="/auth/logout"
                  className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Logout
                </a>
              </div>
            </div>
          )}
        </div>
      </>
    );
  }

  return (
    <a
      href="/auth/login"
      className="flex h-10 items-center rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-500"
    >
      Login
    </a>
  );
}
