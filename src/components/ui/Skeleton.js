export default function Skeleton({ variant = "line", count = 1, className = "" }) {
  const base = "animate-pulse rounded bg-gray-200 dark:bg-gray-700";

  const variants = {
    line: `${base} h-4 w-full`,
    circle: `${base} h-10 w-10 rounded-full`,
    card: `${base} h-32 w-full rounded-2xl`,
    "table-row": `${base} h-12 w-full`,
  };

  const cls = variants[variant] || variants.line;

  if (count <= 1) return <div className={`${cls} ${className}`} />;

  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={`${cls} ${className}`} />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = "" }) {
  return (
    <div className={`rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800 ${className}`}>
      <div className="animate-pulse space-y-3">
        <div className="h-4 w-2/3 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-3 w-full rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-3 w-5/6 rounded bg-gray-200 dark:bg-gray-700" />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4, className = "" }) {
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex gap-4">
        {Array.from({ length: cols }, (_, i) => (
          <div key={i} className="h-4 flex-1 animate-pulse rounded bg-gray-300 dark:bg-gray-600" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex gap-4">
          {Array.from({ length: cols }, (_, c) => (
            <div key={c} className="h-10 flex-1 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          ))}
        </div>
      ))}
    </div>
  );
}
