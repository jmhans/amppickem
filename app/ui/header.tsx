'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useUser } from '@auth0/nextjs-auth0/client';
import { isAdmin } from '@/app/lib/auth-utils';
import { getParticipantsByAuth0Id } from '@/app/lib/actions';
import UserDisplay from './user-display';
import FeedbackModal from './feedback-modal';
import { lusitana } from '@/app/ui/fonts';

export default function Header() {
  const { user } = useUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  // Just the first entry, matching "My Picks" being a single link — a user with
  // multiple entries still gets the full list via UserDisplay's "My Entries".
  const [myPicksParticipantId, setMyPicksParticipantId] = useState<number | null>(null);

  useEffect(() => {
    if (user?.sub) {
      getParticipantsByAuth0Id(user.sub).then((participants) => {
        setMyPicksParticipantId(participants[0]?.id ?? null);
      });
    }
  }, [user?.sub]);

  return (
    <div className="flex h-20 shrink-0 items-center justify-between rounded-lg bg-blue-500 dark:bg-blue-600 px-4 md:h-24 mb-6">
      <Link href="/participants">
        <h1 className={`${lusitana.className} text-white text-2xl md:text-4xl hover:text-blue-100 transition-colors cursor-pointer`}>
          AMP Pick&apos;em
        </h1>
      </Link>

      {/* Navigation - Same for all screens */}
      <div className="flex items-center gap-2">
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
                  {user && isAdmin(user) && (
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
