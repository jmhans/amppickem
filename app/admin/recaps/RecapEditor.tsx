'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createRecap, updateRecap, deleteRecap, sendRecap, generateRecapDraft } from '@/app/lib/actions';

type Recap = {
  id: number;
  week: number;
  title: string;
  body: string;
  publishedAt: string | null;
};

/** Same paragraph split the public recap page and the list preview use — a blank line starts a new paragraph. */
function splitParagraphs(body: string): string[] {
  return body.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
}

export default function RecapEditor({
  seasonId,
  weeks,
  defaultWeek,
  recap,
}: {
  seasonId: number;
  weeks: number[];
  defaultWeek: number;
  recap: Recap | null;
}) {
  const router = useRouter();
  const [week, setWeek] = useState(recap?.week ?? defaultWeek);
  const [title, setTitle] = useState(recap?.title ?? '');
  const [body, setBody] = useState(recap?.body ?? '');
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const isNew = !recap;
  const isSent = !!recap?.publishedAt;

  async function handleGenerate() {
    if ((title.trim() || body.trim()) && !confirm('This will replace the current title and body with an AI-generated draft. Continue?')) {
      return;
    }
    setGenerateError(null);
    setIsGenerating(true);
    const result = await generateRecapDraft(seasonId, week);
    setIsGenerating(false);
    if (result.success) {
      setTitle(result.title);
      setBody(result.body);
    } else {
      setGenerateError(result.error);
    }
  }

  function handleSave() {
    setMessage(null);
    startTransition(async () => {
      if (isNew) {
        const result = await createRecap(seasonId, week, title, body);
        if (result.success) {
          router.push(`/admin/recaps/${result.id}`);
        } else {
          setMessage(result.error ?? 'Failed to create');
        }
        return;
      }
      const result = await updateRecap(recap.id, { week, title, body });
      setMessage(result.success ? 'Saved.' : (result.error ?? 'Failed to save'));
      if (result.success) router.refresh();
    });
  }

  function handleSend() {
    if (!recap) return;
    if (!confirm("Send this recap now? Every participant with notifications on will be emailed or pushed — this can't be undone.")) return;
    setSendResult(null);
    startTransition(async () => {
      const result = await sendRecap(recap.id);
      if (result.success) {
        setSendResult(`Sent — ${result.emailed} emailed, ${result.pushed} pushed.`);
        router.refresh();
      } else {
        setSendResult(result.error ?? 'Failed to send');
      }
    });
  }

  function handleDelete() {
    if (!recap) return;
    if (!confirm('Delete this draft? This cannot be undone.')) return;
    startTransition(async () => {
      const result = await deleteRecap(recap.id);
      if (result.success) {
        router.push('/admin/recaps');
      } else {
        setMessage(result.error ?? 'Failed to delete');
      }
    });
  }

  const paragraphs = splitParagraphs(body);

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
        {isSent && (
          <p className="rounded-md bg-green-50 dark:bg-green-900/20 px-3 py-2 text-sm text-green-800 dark:text-green-300">
            Sent {new Date(recap!.publishedAt!).toLocaleString()} — editing below only changes the page, it won&apos;t re-notify anyone.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 rounded-md bg-indigo-50 dark:bg-indigo-900/20 px-3 py-2.5">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-3 py-1.5 text-sm font-medium text-white transition-colors"
          >
            {isGenerating ? 'Generating…' : '✨ Generate with AI'}
          </button>
          <span className="text-xs text-indigo-800 dark:text-indigo-300">
            Drafts a recap from Week {week}&apos;s actual results — weekly winners, upsets, and how the pool picked. You can edit everything before saving.
          </span>
        </div>
        {generateError && <p className="text-sm text-red-600 dark:text-red-400">{generateError}</p>}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <label className="block col-span-1">
            <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">Week</span>
            <select
              value={week}
              onChange={(e) => setWeek(Number(e.target.value))}
              className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white px-2 py-1.5 text-sm"
            >
              {weeks.map((w) => (
                <option key={w} value={w}>Week {w}</option>
              ))}
            </select>
          </label>
          <label className="block col-span-2 sm:col-span-3">
            <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">Title</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Week 3 Recap"
              className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white px-2 py-1.5 text-sm"
            />
          </label>
        </div>

        <label className="block">
          <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">Body — leave a blank line between paragraphs</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={14}
            className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white px-3 py-2 text-sm"
          />
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleSave}
            disabled={isPending}
            className="rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white transition-colors"
          >
            {isPending ? 'Saving…' : isNew ? 'Create Draft' : 'Save'}
          </button>
          {!isNew && !isSent && (
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="rounded-lg border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 px-4 py-2 text-sm font-medium transition-colors"
            >
              Delete Draft
            </button>
          )}
          {message && <span className="text-sm text-gray-600 dark:text-gray-300">{message}</span>}
        </div>
      </div>

      {!isNew && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Send</h2>
            {isSent ? (
              <span className="text-sm text-gray-500 dark:text-gray-400">Already sent.</span>
            ) : (
              <button
                onClick={handleSend}
                disabled={isPending || !title.trim()}
                className="rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white transition-colors"
              >
                {isPending ? 'Sending…' : 'Send Now'}
              </button>
            )}
          </div>
          {!isSent && (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Publishes this recap to /recaps and emails or pushes everyone with notifications on, per their own preference — same delivery as pick reminders.
            </p>
          )}
          {sendResult && <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{sendResult}</p>}
        </div>
      )}

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Preview</h2>
        <div className="mt-2 space-y-2 text-sm text-gray-700 dark:text-gray-300">
          {paragraphs.length === 0 ? (
            <p className="italic text-gray-400 dark:text-gray-500">Nothing yet.</p>
          ) : (
            paragraphs.map((p, i) => <p key={i}>{p}</p>)
          )}
        </div>
      </div>
    </div>
  );
}
