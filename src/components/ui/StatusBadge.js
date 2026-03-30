const DEFAULT_COLORS = {
  active:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300",
  completed:
    "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-300",
  passed:
    "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-300",
  in_progress:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300",
  pending:
    "border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300",
  not_started:
    "border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300",
  failed:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300",
  archived:
    "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900/60 dark:bg-purple-950/30 dark:text-purple-300",
  open:
    "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-300",
  cancelled:
    "border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300",
  low:
    "border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300",
  medium:
    "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-300",
  high:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300",
  critical:
    "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300",
};

const SIZE_CLASSES = {
  sm: "px-2.5 py-1 text-[11px]",
  md: "px-3 py-1 text-xs",
};

export default function StatusBadge({
  status,
  label,
  size = "sm",
  colorMap,
  className = "",
  wrap = true,
}) {
  const key = (status || "").toLowerCase().replace(/\s+/g, "_");
  const colors = colorMap || DEFAULT_COLORS;
  const colorCls = colors[key] || DEFAULT_COLORS.pending;
  const sizeCls = SIZE_CLASSES[size] || SIZE_CLASSES.sm;
  const displayLabel = label || (status || "").replace(/_/g, " ");

  return (
    <span
      className={[
        "inline-flex max-w-full items-center rounded-full border font-semibold capitalize",
        wrap ? "break-words text-center" : "truncate whitespace-nowrap",
        sizeCls,
        colorCls,
        className,
      ].join(" ")}
    >
      {displayLabel}
    </span>
  );
}
