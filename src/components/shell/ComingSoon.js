/**
 * Placeholder body for pages in the client's navigation that are not built
 * yet. Each placeholder lives at the page's final URL, so the real page
 * replaces it without changing any links.
 */
export default function ComingSoon({ title, description }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white px-6 py-16 text-center dark:border-gray-700 dark:bg-gray-900">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300">
        <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
        </svg>
      </div>
      <h2 className="mt-4 text-lg font-bold text-gray-900 dark:text-gray-100">{title} is coming soon</h2>
      <p className="mt-1 max-w-md text-sm text-gray-500 dark:text-gray-400">
        {description || "This page is being built and will be available here shortly."}
      </p>
    </div>
  );
}
