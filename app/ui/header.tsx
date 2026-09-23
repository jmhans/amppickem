'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@auth0/nextjs-auth0/client';
import { isAdmin } from '@/app/lib/auth-utils';
import { getParticipantsByAuth0Id, getAdminMode, setAdminMode } from '@/app/lib/actions';
import UserDisplay from './user-display';
import FeedbackModal from './feedback-modal';
import { lusitana } from '@/app/ui/fonts';

export default function Header() {
  const { user } = useUser();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  // Just the first entry, matching "My Picks" being a single link — a user with
  // multiple entries still gets the full list via UserDisplay's "My Entries".
  const [myPicksParticipantId, setMyPicksParticipantId] = useState<number | null>(null);
  const [adminMode, setAdminModeState] = useState(false);
  const [togglingAdminMode, setTogglingAdminMode] = useState(false);
  const userIsAdmin = !!user && isAdmin(user);

  useEffect(() => {
    if (user?.sub) {
      getParticipantsByAuth0Id(user.sub).then((participants) => {
        setMyPicksParticipantId(participants[0]?.id ?? null);
      });
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

  return (
    <div className="flex h-20 shrink-0 items-center justify-between rounded-lg bg-blue-500 dark:bg-blue-600 px-4 md:h-24 mb-6">
      <Link href="/participants">
        <h1 className={`${lusitana.className} text-white text-2xl md:text-4xl hover:text-blue-100 transition-colors cursor-pointer`}>
          AMP Pick&apos;em
        </h1>
      </Link>

      {/* Navigation - Same for all screens */}
      <div className="flex items-center gap-2">
        {userIsAdmin && (
          <button
            onClick={handleToggleAdminMode}
            disabled={togglingAdminMode}
            aria-pressed={adminMode}
            title={adminMode
              ? "Admin Mode is ON — you can see/manage everyone's picks. Click to turn off."
              : 'Admin Mode is OFF — you see the site like a regular participant. Click to turn on.'}
            className="flex h-10 items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors px-2.5 disabled:opacity-50"
          >
            <span className="hidden md:inline text-xs font-medium text-blue-100">Admin</span>
            <span className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${adminMode ? 'bg-orange-400' : 'bg-blue-300/40'}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${adminMode ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </span>
          </button>
        )}
        <UserDisplay />
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors"
            aria-label="Menu"
          >
            <svg
              className="h-6 w-6 text-white"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M4 6h16M4 12h16M4 18h16"></path>
            </svg>
          </button>

          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black dark:ring-gray-700 ring-opacity-5 z-20">
                <div className="py-1" role="menu">
                  <Link
                    href="/participants"
                    className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => setMenuOpen(false)}
                  >
                    Standings
                  </Link>
                  {myPicksParticipantId != null && (
                    <Link
                      href={`/picks/${myPicksParticipantId}`}
                      className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                      onClick={() => setMenuOpen(false)}
                    >
                      My Picks
                    </Link>
                  )}
                  <Link
                    href="/board"
                    className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => setMenuOpen(false)}
                  >
                    Pick Results Board
                  </Link>
                  <Link
                    href="/recaps"
                    className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => setMenuOpen(false)}
                  >
                    Weekly Recaps
                  </Link>
                  <Link
                    href="/about"
                    className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => setMenuOpen(false)}
                  >
                    About
                  </Link>
                  <button
                    onClick={() => { setFeedbackOpen(true); setMenuOpen(false); }}
                    className="block w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                    role="menuitem"
                  >
                    Feedback
                  </button>
                  {userIsAdmin && (
                    <Link
                      href="/admin"
                      className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                      onClick={() => setMenuOpen(false)}
                    >
                      Admin
                    </Link>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </div>
  );
}
