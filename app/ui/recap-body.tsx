import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Renders a recap's body as Markdown — bold/italic, links, lists, tables (via remark-gfm),
 * blockquotes. Deliberately NOT rendering raw HTML (no rehype-raw) — react-markdown's default
 * behavior already treats stray HTML in the text as literal, inert characters rather than
 * executing it, so this stays safe without any sanitization step of our own, at the cost of
 * not supporting hand-written HTML tags (Markdown covers the same ground for a recap's needs).
 * Styled by hand to match the rest of the site's Tailwind classes rather than pulling in the
 * typography plugin for one component.
 */
export default function RecapBody({ body }: { body: string }) {
  return (
    <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p>{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-gray-900 dark:text-white">{children}</strong>,
          a: ({ href, children }) => (
            <a href={href} className="text-blue-600 hover:text-blue-500 underline" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          h1: ({ children }) => <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{children}</h2>,
          h2: ({ children }) => <h3 className="text-base font-semibold text-gray-900 dark:text-white">{children}</h3>,
          h3: ({ children }) => <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{children}</h4>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-gray-300 dark:border-gray-600 pl-3 italic text-gray-600 dark:text-gray-400">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="border-gray-200 dark:border-gray-700" />,
          code: ({ children }) => (
            <code className="rounded bg-gray-100 dark:bg-gray-700 px-1 py-0.5 text-xs">{children}</code>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="px-2 py-1.5 text-left font-medium text-gray-500 dark:text-gray-400">{children}</th>,
          td: ({ children }) => <td className="px-2 py-1.5">{children}</td>,
        }}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}
