import { notFound } from 'next/navigation';
import { lusitana } from '@/app/ui/fonts';
import { getRecapById } from '@/app/lib/actions';
import RecapBody from '@/app/ui/recap-body';

export const dynamic = 'force-dynamic';

export default async function RecapDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const recap = await getRecapById(Number(id));
  // A draft (publishedAt still null) isn't reachable here — only the admin editor can see
  // it, via its own preview. Treat both "doesn't exist" and "not sent yet" the same way so
  // a guessed id can't be used to peek at an unsent recap.
  if (!recap || !recap.publishedAt) notFound();

  return (
    <main className="space-y-5">
      <div>
        <h1 className={`${lusitana.className} text-2xl md:text-3xl text-gray-900 dark:text-white`}>
          {recap.title}
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Week {recap.week} · {new Date(recap.publishedAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
        <RecapBody body={recap.body} />
      </div>
    </main>
  );
}
