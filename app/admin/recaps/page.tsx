import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth0 } from '@/app/lib/auth0';
import { isAdmin } from '@/app/lib/auth-utils';
import { getOrCreateActiveSeason, getRecapsForAdmin } from '@/app/lib/actions';
import { lusitana } from '@/app/ui/fonts';

export const dynamic = 'force-dynamic';

export default async function AdminRecapsPage() {
  const session = await auth0.getSession();
  if (!session?.user) redirect('/auth/login');
  if (!isAdmin(session.user)) redirect('/admin');

  const season = await getOrCreateActiveSeason();
  const recaps = await getRecapsForAdmin(season.id);

  return (
    <main className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className={`${lusitana.className} text-2xl md:text-3xl text-gray-900 dark:text-white`}>
          Weekly Recaps
        </h1>
        <Link
          href="/admin/recaps/new"
          className="rounded-lg bg-blue-500 hover:bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors"
        >
          + New Recap
        </Link>
      </div>

      {recaps.length === 0 ? (
        <p className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 text-center text-sm text-gray-500">
          No recaps yet.
        </p>
      ) : (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Week</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Title</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {recaps.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">Week {r.week}</td>
                  <td className="px-4 py-3 text-sm">
                    <Link href={`/admin/recaps/${r.id}`} className="text-blue-600 hover:text-blue-800 hover:underline">
                      {r.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {r.publishedAt ? (
                      <span className="rounded-full bg-green-100 dark:bg-green-900/40 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-300">
                        Sent
                      </span>
                    ) : (
                      <span className="rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-300">
                        Draft
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
