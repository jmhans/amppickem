import { lusitana } from '@/app/ui/fonts';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
      <div className="mt-2 space-y-2 text-sm text-gray-700 dark:text-gray-300">{children}</div>
    </div>
  );
}

export default function AboutPage() {
  return (
    <main className="space-y-5">
      <div>
        <h1 className={`${lusitana.className} text-2xl md:text-3xl text-gray-900 dark:text-white`}>
          16th Annual Ameriprise NFL Point Spread Pool
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Run by Michael Shoup — everyone&apos;s welcome to play.
        </p>
      </div>

      <Section title="How to Play">
        <p>
          Each week you choose <strong>six bets</strong> set against Vegas odds — you can bet the spread or the
          over/under on any game. Your season record (wins, losses, and pushes) is tracked across all your picks.
        </p>
      </Section>

      <Section title="The Process">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Lines and odds go out weekly, normally on Tuesday or Wednesday.</li>
          <li>A reminder usually (but not always) goes out on Friday to anyone who hasn&apos;t turned in picks yet.</li>
          <li>
            If you forget to make your picks for a week, you&apos;re assigned the worst record for that week —
            but those losses don&apos;t count toward your season &quot;lost pick&quot; total.
          </li>
        </ul>
      </Section>

      <Section title="The Money">
        <p>Entry is <strong>$20</strong>, settled entirely at the end of the season.</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong>$360</strong> most likely (about $20/week) goes to weekly winners — defined as any entry going
            6-0, or the best record alone at 5-0-1, 5-1, 4-1-1, etc.
          </li>
          <li><strong>$20</strong> goes to whoever makes the most &quot;lost picks&quot; for the season.</li>
          <li>The remainder is paid out to the top ~10% of full-season records.</li>
        </ul>
      </Section>

      <Section title="Joining">
        <p>
          Anyone is welcome to play. If you know someone who&apos;d be interested and isn&apos;t already getting
          the weekly picks email, have them email their picks to{' '}
          <a href="mailto:Michael.E.Shoup@ampf.com" className="text-blue-600 hover:text-blue-500">
            Michael.E.Shoup@ampf.com
          </a>{' '}
          and he&apos;ll add them to future communications.
        </p>
      </Section>
    </main>
  );
}
