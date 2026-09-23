import Link from 'next/link';
import { auth0 } from '@/app/lib/auth0';
import { redirect } from 'next/navigation';
import { lusitana } from '@/app/ui/fonts';
import { isAdmin } from '@/app/lib/auth-utils';
import HomeButton from '@/app/ui/home-button';

const ADMIN_CARDS = [
  {
    href: '/admin/participants',
    title: 'Participants',
    description: 'Seed entries, unclaim, deactivate',
    color: 'blue',
    icon: (
      <path d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 100-8 4 4 0 000 8zm6 3c0 1.657-3.134 3-7 3s-7-1.343-7-3" />
    ),
  },
  {
    href: '/admin/lines',
    title: 'Lines',
    description: 'Sync from ESPN, edit, lock/unlock',
    color: 'green',
    icon: <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
  },
  {
    href: '/admin/results',
    title: 'Results',
    description: 'Enter scores, grade picks',
    color: 'purple',
    icon: <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />,
  },
  {
    href: '/admin/seasons',
    title: 'Seasons',
    description: 'Create/activate a season',
    color: 'orange',
    icon: <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />,
  },
  {
    href: '/admin/templates',
    title: 'Week Templates',
    description: "Upload each week's commissioner spreadsheet",
    color: 'teal',
    icon: <path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2zM12 3v5a1 1 0 001 1h5" />,
  },
  {
    href: '/admin/picks-status',
    title: 'Weekly Picks',
    description: "See who hasn't finished their picks",
    color: 'rose',
    icon: <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />,
  },
  {
    href: '/admin/recaps',
    title: 'Weekly Recaps',
    description: 'Write, preview, and send recaps',
    color: 'indigo',
    icon: <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />,
  },
] as const;

const COLOR_CLASSES: Record<string, { bg: string; text: string; hoverBg: string; hoverBorder: string; hoverText: string }> = {
  blue: { bg: 'bg-blue-100', text: 'text-blue-600', hoverBg: 'group-hover:bg-blue-600', hoverBorder: 'hover:border-blue-500', hoverText: 'group-hover:text-blue-600' },
  green: { bg: 'bg-green-100', text: 'text-green-600', hoverBg: 'group-hover:bg-green-600', hoverBorder: 'hover:border-green-500', hoverText: 'group-hover:text-green-600' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-600', hoverBg: 'group-hover:bg-purple-600', hoverBorder: 'hover:border-purple-500', hoverText: 'group-hover:text-purple-600' },
  orange: { bg: 'bg-orange-100', text: 'text-orange-600', hoverBg: 'group-hover:bg-orange-600', hoverBorder: 'hover:border-orange-500', hoverText: 'group-hover:text-orange-600' },
  teal: { bg: 'bg-teal-100', text: 'text-teal-600', hoverBg: 'group-hover:bg-teal-600', hoverBorder: 'hover:border-teal-500', hoverText: 'group-hover:text-teal-600' },
  rose: { bg: 'bg-rose-100', text: 'text-rose-600', hoverBg: 'group-hover:bg-rose-600', hoverBorder: 'hover:border-rose-500', hoverText: 'group-hover:text-rose-600' },
  indigo: { bg: 'bg-indigo-100', text: 'text-indigo-600', hoverBg: 'group-hover:bg-indigo-600', hoverBorder: 'hover:border-indigo-500', hoverText: 'group-hover:text-indigo-600' },
};

export default async function AdminPage() {
  const session = await auth0.getSession();

  if (!session?.user) {
    redirect('/auth/login');
  }

  const userIsAdmin = isAdmin(session.user);

  if (!userIsAdmin) {
    return (
      <main className="flex min-h-screen flex-col p-6 bg-white dark:bg-gray-900">
        <HomeButton />

        <div className="flex h-20 shrink-0 items-end rounded-lg bg-blue-500 dark:bg-blue-600 p-4 md:h-32 mb-8 mt-4">
          <h1 className={`${lusitana.className} text-white text-3xl md:text-5xl`}>
            Admin Dashboard
          </h1>
        </div>

        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-6 text-center">
          <p className="text-red-800 dark:text-red-200 font-medium">Access Denied</p>
          <p className="mt-2 text-gray-600 dark:text-gray-400">You need admin privileges to access this page.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col p-6 bg-white dark:bg-gray-900">
      <HomeButton />

      <div className="flex h-20 shrink-0 items-end rounded-lg bg-blue-500 dark:bg-blue-600 p-4 md:h-32 mb-8 mt-4">
        <h1 className={`${lusitana.className} text-white text-3xl md:text-5xl`}>
          Admin Dashboard
        </h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {ADMIN_CARDS.map((card) => {
          const colors = COLOR_CLASSES[card.color];
          return (
            <Link
              key={card.href}
              href={card.href}
              className={`group rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm transition-all ${colors.hoverBorder} hover:shadow-md`}
            >
              <div className="flex items-center gap-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${colors.bg} ${colors.text} ${colors.hoverBg} group-hover:text-white transition-colors`}>
                  <svg className="h-6 w-6" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                    {card.icon}
                  </svg>
                </div>
                <div>
                  <h2 className={`text-lg font-semibold text-gray-900 dark:text-white ${colors.hoverText}`}>
                    {card.title}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {card.description}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
