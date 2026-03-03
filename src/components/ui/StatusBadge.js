const DEFAULT_COLORS = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  completed: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400",
  passed: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400",
  in_progress: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  pending: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
  not_started: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  archived: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400",
};

const SIZE_CLASSES = {
  sm: "px-2 py-0.5 text-[11px]",
  md: "px-2.5 py-1 text-xs",
};

export default function StatusBadge({
  status,
  label,
  size = "sm",
  colorMap,
  className = "",
}) {
  const key = (status || "").toLowerCase().replace(/\s+/g, "_");
  const colors = colorMap || DEFAULT_COLORS;
  const colorCls = colors[key] || DEFAULT_COLORS.pending;
  const sizeCls = SIZE_CLASSES[size] || SIZE_CLASSES.sm;
  const displayLabel = label || (status || "").replace(/_/g, " ");

  return (
    <span className={`inline-flex items-center rounded-full font-semibold capitalize ${sizeCls} ${colorCls} ${className}`}>
      {displayLabel}
    </span>
  );
}
