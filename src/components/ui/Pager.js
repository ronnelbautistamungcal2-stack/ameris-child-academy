// First / previous / page numbers / next / last, for paged tables.
export default function Pager({ page, pages, onPage }) {
  const start = Math.max(1, Math.min(page - 2, pages - 4));
  const numbers = Array.from({ length: Math.min(5, pages) }, (_, i) => start + i);
  const btn = "min-w-[32px] rounded-md border border-gray-300 px-2 py-1 disabled:opacity-30 dark:border-gray-600";
  return (
    <nav className="flex items-center gap-1" aria-label="Pages">
      <button type="button" className={btn} onClick={() => onPage(1)} disabled={page <= 1} aria-label="First page">{"«"}</button>
      <button type="button" className={btn} onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page">{"‹"}</button>
      {numbers.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onPage(n)}
          aria-current={n === page ? "page" : undefined}
          className={`${btn} ${n === page ? "border-[#0b2a5b] bg-[#0b2a5b] text-white" : ""}`}
        >
          {n}
        </button>
      ))}
      <button type="button" className={btn} onClick={() => onPage(page + 1)} disabled={page >= pages} aria-label="Next page">{"›"}</button>
      <button type="button" className={btn} onClick={() => onPage(pages)} disabled={page >= pages} aria-label="Last page">{"»"}</button>
    </nav>
  );
}
