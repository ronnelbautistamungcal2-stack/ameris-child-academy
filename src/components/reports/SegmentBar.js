// A stacked bar of ranges (e.g. grades 0-59 ... 90-100), each segment sized
// by how many people fall in it, with its share and label underneath.
// Clicking a segment calls onSelect(key) to list the people in that range.

export const RANGE_COLORS = ["bg-red-400", "bg-orange-400", "bg-yellow-300", "bg-green-300", "bg-green-700"];
export const RANGE_TEXT = ["text-red-600", "text-orange-500", "text-yellow-600", "text-green-600", "text-green-800"];

export default function SegmentBar({ title, segments, selected, onSelect }) {
  const total = segments.reduce((sum, s) => sum + s.count, 0);
  return (
    <div>
      <div className="text-lg font-bold text-[#0b2a5b] dark:text-blue-100">{title}</div>
      <div className="mt-1 flex h-9 w-full overflow-hidden rounded-md bg-gray-100 dark:bg-gray-800">
        {segments.map((s) =>
          s.count ? (
            <button
              key={s.key}
              type="button"
              onClick={() => onSelect(s.key)}
              title={`${s.label}: ${s.count}`}
              aria-label={`${title} ${s.label}: ${s.count}`}
              aria-pressed={selected === s.key}
              className={`${s.color} transition hover:brightness-105 ${selected === s.key ? "ring-4 ring-inset ring-blue-600" : ""}`}
              style={{ width: `${(s.count * 100) / total}%` }}
            />
          ) : null,
        )}
        {!total && <div className="flex w-full items-center justify-center text-xs text-gray-500">No data in these dates</div>}
      </div>
      <div className="mt-1 flex w-full">
        {segments.map((s) => (
          <button
            key={s.key}
            type="button"
            disabled={!s.count}
            onClick={() => onSelect(s.key)}
            className="flex-1 text-center leading-tight disabled:cursor-default"
          >
            <div className={`text-base font-bold ${s.text}`}>{total ? Math.round((s.count * 100) / total) : 0}%</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">{s.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
