import Link from 'next/link';
import { lusitana } from '@/app/ui/fonts';
import { getOrCreateActiveSeason, getPublishedRecaps } from '@/app/lib/actions';

export const dynamic = 'force-dynamic';

/**
 * Plain-text teaser for the card — the body itself may be Markdown (see RecapBody), but a
 * card snippet reads better as a stripped-down single line than as partially-rendered
 * formatting, so this pulls the first paragraph and knocks out the common syntax characters
 * rather than rendering it.
 */
function firstParagraph(body: string): string {
  const raw = body.split(/\n\s*\n/).map((s) => s.trim()).find(Boolean) ?? '';
  return raw
    .replace(/[#>*_`~]/g, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .trim();
}

export default async function RecapsPage() {
  const season = await getOrCreateActiveSeason();
  const recaps = await getPublishedRecaps(season.id);

  return (
    <main className="space-y-5">
      <div>
        <h1 className={`${lusitana.className} text-2xl md:text-3xl text-gray-900 dark:text-white`}>
          Weekly Recaps
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{season.name}</p>
      </div>

      {recaps.length === 0 ? (
        <p className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 text-center text-sm text-gray-500">
          No recaps published yet.
        </p>
      ) : (
        <div className="space-y-3">
          {recaps.map((r) => (
            <Link
              key={r.id}
              href={`/recaps/${r.id}`}
              className="block rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm transition-colors hover:border-blue-400 dark:hover:border-blue-500"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{r.title}</h2>
                <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-gray-400">Week {r.week}</span>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {r.publishedAt
                  ? new Date(r.publishedAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
                  : ''}
              </p>
              <p className="mt-2 line-clamp-2 text-sm text-gray-700 dark:text-gray-300">{firstParagraph(r.body)}</p>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
