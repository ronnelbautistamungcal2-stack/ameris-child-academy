import { SkeletonTable } from "@/components/ui/Skeleton";

/**
 * Small presentational helpers shared by the admin operations pages
 * (Staff Management, Classroom Budgets).
 */

export function Card({ children }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6">
      {children}
    </div>
  );
}

export function KpiCard({ label, value, color = "gray" }) {
  const colorMap = {
    sky: "border-sky-200 bg-sky-50 text-sky-800",
    blue: "border-blue-200 bg-blue-50 text-blue-900",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    red: "border-red-200 bg-red-50 text-red-800",
    gray: "border-gray-200 bg-gray-50 text-gray-800",
  };
  return (
    <div
      className={`rounded-xl border p-4 ${colorMap[color] || colorMap.gray}`}
    >
      <div className="text-2xl font-extrabold">{String(value)}</div>
      <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wider">
        {label}
      </div>
    </div>
  );
}

export function PrimaryButton({ onClick, children, size = "md" }) {
  const sizeClass =
    size === "sm" ? "px-3 py-1.5 text-xs" : "px-5 py-2.5 text-sm";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl bg-gradient-to-r from-blue-800 to-sky-600 font-bold text-white shadow-sm hover:from-blue-900 hover:to-sky-700 transition ${sizeClass}`}
    >
      {children}
    </button>
  );
}

export function SaveButton({ saving, label = "Save", disabled = false }) {
  return (
    <button
      type="submit"
      disabled={saving || disabled}
      className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition"
    >
      {saving ? "Saving…" : label}
    </button>
  );
}

export function FilterSelect({ label, value, onChange, disabled, children }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
        {label}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-medium text-gray-900 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
        disabled={disabled}
      >
        {children}
      </select>
    </label>
  );
}

export function FilterInput({ label, type, value, onChange }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
        {label}
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-medium text-gray-900 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
      />
    </label>
  );
}

export function Loading() {
  return (
    <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50/50 p-6">
      <SkeletonTable rows={4} cols={4} />
    </div>
  );
}

export function EmptyCard({ icon, title, msg }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white py-12 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-2xl">
        {icon}
      </div>
      <p className="mt-4 text-sm font-bold text-gray-700">{title}</p>
      <p className="mt-1 text-xs text-gray-500">{msg}</p>
    </div>
  );
}
