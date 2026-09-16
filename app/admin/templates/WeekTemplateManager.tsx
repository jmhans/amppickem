'use client';

import { useRef, useState, useTransition } from 'react';
import { uploadWeekTemplate, deleteWeekTemplate } from '@/app/lib/actions';

type Template = {
  week: number;
  fileName: string;
  uploadedBy: string | null;
  uploadedAt: string;
};

export default function WeekTemplateManager({
  seasonId,
  firstWeek,
  lastWeek,
  initialTemplates,
}: {
  seasonId: number;
  firstWeek: number;
  lastWeek: number;
  initialTemplates: Template[];
}) {
  const [templates, setTemplates] = useState<Template[]>(initialTemplates);
  const templateByWeek = new Map(templates.map((t) => [t.week, t]));
  const nextUntemplatedWeek = Array.from({ length: lastWeek - firstWeek + 1 }, (_, i) => firstWeek + i)
    .find((w) => !templateByWeek.has(w)) ?? firstWeek;

  const [week, setWeek] = useState(nextUntemplatedWeek);
  const [file, setFile] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleUpload() {
    if (!file) {
      setMessage({ type: 'error', text: 'Choose a .xlsx file first' });
      return;
    }
    setMessage(null);
    const formData = new FormData();
    formData.set('seasonId', String(seasonId));
    formData.set('week', String(week));
    formData.set('file', file);

    startTransition(async () => {
      const result = await uploadWeekTemplate(formData);
      if (result.success) {
        setTemplates((prev) => [
          ...prev.filter((t) => t.week !== week),
          { week, fileName: file.name, uploadedBy: null, uploadedAt: new Date().toISOString() },
        ].sort((a, b) => a.week - b.week));
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setMessage({ type: 'success', text: `Week ${week} template uploaded.` });
      } else {
        setMessage({ type: 'error', text: result.error ?? 'Upload failed' });
      }
    });
  }

  function handleRemove(w: number) {
    setMessage(null);
    startTransition(async () => {
      const result = await deleteWeekTemplate(seasonId, w);
      if (result.success) {
        setTemplates((prev) => prev.filter((t) => t.week !== w));
        setMessage({ type: 'success', text: `Week ${w} reverted to the default template.` });
      } else {
        setMessage({ type: 'error', text: result.error ?? 'Failed to remove' });
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Upload a week&apos;s template</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Drop in the commissioner&apos;s spreadsheet for that week (new quip, reshuffled game order, whatever).
          Exported picks only overwrite the &quot;Week N&quot; header and the game rows — the header must stay in cell
          B4 and the game grid in rows 7&ndash;22, or picks will land in the wrong cells. Any week with no upload
          here just uses the default template.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">Week</span>
            <select
              value={week}
              onChange={(e) => setWeek(Number(e.target.value))}
              className="mt-1 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white px-2 py-1.5 text-sm"
            >
              {Array.from({ length: lastWeek - firstWeek + 1 }, (_, i) => firstWeek + i).map((w) => (
                <option key={w} value={w}>
                  Week {w}{templateByWeek.has(w) ? ' (has upload)' : ''}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">File</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-1 block text-sm text-gray-700 dark:text-gray-200"
            />
          </label>

          <button
            onClick={handleUpload}
            disabled={isPending || !file}
            className="rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white transition-colors"
          >
            {isPending ? 'Uploading…' : 'Upload'}
          </button>
        </div>

        {message && (
          <p className={`mt-3 text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
            {message.text}
          </p>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Uploaded templates</h2>
        {templates.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            No uploads yet — every week is using the default template.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <th className="pb-2 pr-4">Week</th>
                  <th className="pb-2 pr-4">File</th>
                  <th className="pb-2 pr-4">Uploaded by</th>
                  <th className="pb-2 pr-4">Uploaded</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.week} className="border-t border-gray-100 dark:border-gray-700">
                    <td className="py-2 pr-4 text-gray-900 dark:text-white">{t.week}</td>
                    <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">{t.fileName}</td>
                    <td className="py-2 pr-4 text-gray-500 dark:text-gray-400">{t.uploadedBy ?? '—'}</td>
                    <td className="py-2 pr-4 text-gray-500 dark:text-gray-400">
                      {new Date(t.uploadedAt).toLocaleString()}
                    </td>
                    <td className="py-2">
                      <button
                        onClick={() => handleRemove(t.week)}
                        disabled={isPending}
                        className="text-red-600 hover:text-red-500 disabled:opacity-50"
                      >
                        Revert to default
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
