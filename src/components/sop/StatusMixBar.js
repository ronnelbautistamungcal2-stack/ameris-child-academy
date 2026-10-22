import { SOP_STATUSES } from "@/lib/sop";

// The Critical / At Risk / On Track / Ahead / Excelling bar from the client's
// mockups: each segment sized by its share, with the percentage under it.
// onSegment(status) makes the segments clickable (Center Performance).
export default function StatusMixBar({ distribution, className = "", onSegment }) {
  const total = SOP_STATUSES.reduce((sum, s) => sum + (distribution?.[s.value] || 0), 0);
  return (
    <div className={`w-full ${className}`} aria-label="Status mix">
      <div className="flex h-3 w-full overflow-hidden rounded">
        {SOP_STATUSES.map((s) => {
          const share = total ? (distribution?.[s.value] || 0) : 20;
          const Tag = onSegment ? "button" : "div";
          return (
            <Tag
              key={s.value}
              type={onSegment ? "button" : undefined}
              onClick={onSegment ? () => onSegment(s.value) : undefined}
              title={`${s.label}: ${distribution?.[s.value] ?? 0}%`}
              aria-label={onSegment ? `Show ${s.label}` : undefined}
              className={`${s.bar} ${total ? "" : "opacity-30"} ${onSegment ? "cursor-pointer hover:brightness-110" : ""}`}
              style={{ width: `${share}%` }}
            />
          );
        })}
      </div>
      <div className="mt-0.5 grid grid-cols-5 text-center">
        {SOP_STATUSES.map((s) => (
          <div key={s.value} className="leading-tight">
            <div className="text-[11px] font-bold text-gray-700 dark:text-gray-300">{distribution?.[s.value] ?? 0}%</div>
            <div className="text-[10px] text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
