'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@auth0/nextjs-auth0/client';

interface Issue {
  number: number;
  title: string;
  createdAt: string;
  url: string;
}

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

/**
 * Modal for filing a bug/feature request as a GitHub issue — same pattern as fgt2/ABL's
 * feedback workflow. Controlled (`open`/`onClose`) and must stay mounted independent of
 * whatever triggers it — e.g. header.tsx's hamburger dropdown unmounts its contents when
 * it closes, so if this component owned its own open state and lived inside that dropdown,
 * closing the dropdown on click (to open the modal) would unmount the modal before it
 * could ever render.
 */
export default function FeedbackModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useUser();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [submitMsg, setSubmitMsg] = useState('');
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loadingIssues, setLoadingIssues] = useState(false);

  const fetchIssues = useCallback(async () => {
    setLoadingIssues(true);
    try {
      const res = await fetch('/api/feedback');
      if (res.ok) setIssues(await res.json());
    } finally {
      setLoadingIssues(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchIssues();
  }, [open, fetchIssues]);

  function resetForm() {
    setTitle('');
    setDescription('');
    setSubmitState('idle');
    setSubmitMsg('');
  }

  function close() {
    onClose();
    setTimeout(resetForm, 300);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitState === 'submitting') return;
    setSubmitState('submitting');
    setSubmitMsg('');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), description: description.trim() }),
      });
      const data = await res.json() as { number?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      setSubmitMsg(`Thanks! Issue #${data.number} logged.`);
      setSubmitState('success');
      resetForm();
      fetchIssues();
    } catch (err) {
      setSubmitMsg(err instanceof Error ? err.message : 'Something went wrong.');
      setSubmitState('error');
    }
  }

  if (!open) return null;

  return (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={(e) => { if (e.target === e.currentTarget) close(); }}
        >
          <div className="flex w-full max-w-lg flex-col rounded-xl bg-white dark:bg-gray-800 shadow-xl" style={{ maxHeight: '90vh' }}>
            <div className="flex shrink-0 items-center justify-between border-b border-gray-200 dark:border-gray-700 px-5 py-4">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Feedback &amp; Feature Requests</h2>
              <button onClick={close} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" aria-label="Close">
                <svg className="h-5 w-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-4 space-y-5">
              <div>
                {!user ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Sign in to submit feedback.</p>
                ) : submitState === 'success' ? (
                  <div className="rounded-lg bg-green-50 dark:bg-green-900/20 px-4 py-3 text-sm text-green-700 dark:text-green-400">
                    {submitMsg}{' '}
                    <button onClick={resetForm} className="underline">Submit another</button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-3">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Title <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={title}
                        maxLength={200}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Short description of the issue or idea"
                        className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="mt-0.5 text-right text-xs text-gray-400">{title.length}/200</p>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Details <span className="text-gray-400 font-normal">(optional)</span>
                      </label>
                      <textarea
                        value={description}
                        maxLength={5000}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={3}
                        placeholder="Steps to reproduce, expected behavior, etc."
                        className="w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    {submitState === 'error' && (
                      <p className="text-xs text-red-600">{submitMsg}</p>
                    )}
                    <div className="flex gap-3">
                      <button
                        type="submit"
                        disabled={title.trim().length < 5 || submitState === 'submitting'}
                        className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                      >
                        {submitState === 'submitting' ? 'Submitting…' : 'Submit'}
                      </button>
                      <button type="button" onClick={close} className="rounded-lg bg-gray-100 dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600">
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Open Reports
                    {!loadingIssues && <span className="ml-1 font-normal text-gray-400">({issues.length})</span>}
                  </h3>
                  <button onClick={fetchIssues} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" title="Refresh" aria-label="Refresh">
                    <svg className={`h-4 w-4 ${loadingIssues ? 'animate-spin' : ''}`} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                      <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
                {loadingIssues ? (
                  <p className="text-xs text-gray-400">Loading…</p>
                ) : issues.length === 0 ? (
                  <p className="text-xs text-gray-400">No open reports yet.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {issues.map((issue) => (
                      <li key={issue.number} className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">{issue.title}</p>
                          <p className="text-xs text-gray-400">#{issue.number} · {new Date(issue.createdAt).toLocaleDateString()}</p>
                        </div>
                        <a href={issue.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-xs text-blue-500 hover:text-blue-700">
                          View
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-3 text-xs text-gray-400">
                  Tracked on <a href="https://github.com/jmhans/amppickem/issues" target="_blank" rel="noopener noreferrer" className="hover:underline">GitHub</a>.
                </p>
              </div>
            </div>
          </div>
        </div>
  );
}
