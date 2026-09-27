import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth0 } from '@/app/lib/auth0';
import { lusitana } from '@/app/ui/fonts';
import RecapBody from '@/app/ui/recap-body';
import { METHODOLOGY_MARKDOWN } from '../methodology-content';

export const dynamic = 'force-dynamic';

export default async function GameDayMethodologyPage() {
  const session = await auth0.getSession();
  if (!session?.user) redirect('/auth/login');

  return (
    <main className="mx-auto max-w-2xl space-y-5">
      <div>
        <Link href="/gameday" className="text-sm text-blue-600 hover:text-blue-500">
          ← Back to GameDay
        </Link>
        <h1 className={`${lusitana.className} mt-1 text-2xl md:text-3xl text-gray-900 dark:text-white`}>
          GameDay Win Probability — Methodology
        </h1>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
        <RecapBody body={METHODOLOGY_MARKDOWN} />
      </div>
    </main>
  );
}
