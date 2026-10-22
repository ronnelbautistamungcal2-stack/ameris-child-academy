import { apiJson } from "@/lib/api";
import { useCallback, useEffect, useMemo, useState } from "react";

const SUPPLY_STATUS_OPTIONS = [
  { value: "in_class", label: "In Class" },
  { value: "in_inventory", label: "In Inventory" },
  { value: "requested", label: "Request Supply" },
];

export default function NextWeekSupplies({ centerId, classRoomId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [itemStatus, setItemStatus] = useState({});
  const [requesting, setRequesting] = useState({});
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!centerId || !classRoomId) return;
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({ centerId, classRoomId });
      const result = await apiJson(`/api/v1/lessons/next-week-supplies?${qs}`);
      setData(result);
      setItemStatus({});
    } catch (e) {
      setError(e.message || "Failed to load next week's supplies");
    } finally {
      setLoading(false);
    }
  }, [centerId, classRoomId]);

  useEffect(() => { load(); }, [load]);

  const weekLabel = useMemo(() => {
    if (!data?.weekStart || !data?.weekEnd) return "Next Week";
    const start = new Date(data.weekStart + "T00:00:00");
    const end = new Date(data.weekEnd + "T00:00:00");
    const fmt = (d) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return `${fmt(start)} – ${fmt(end)}`;
  }, [data]);

  const supplies = data?.supplies || [];
  const resolvedCount = Object.keys(itemStatus).length;

  async function handleStatusChange(supply, key, status) {
    setItemStatus((prev) => ({ ...prev, [key]: status }));
    if (status !== "requested") return;

    setRequesting((prev) => ({ ...prev, [key]: true }));
    setError("");
    try {
      const lessonTitles = (supply.lessons || []).map((l) => l.title).join(", ");
      await apiJson("/api/v1/supply-requests", {
        method: "POST",
        body: JSON.stringify({
          centerId,
          classRoomId,
          item: supply.name,
          quantity: supply.totalQuantity || 1,
          purpose: lessonTitles ? `Needed for: ${lessonTitles}` : null,
          lessonId: supply.lessons?.[0]?.id || null,
        }),
      });
    } catch (e) {
      setError(e.message || "Failed to send supply request");
      setItemStatus((prev) => ({ ...prev, [key]: undefined }));
    } finally {
      setRequesting((prev) => ({ ...prev, [key]: false }));
    }
  }

  return (
    <div className="rounded-xl border border-emerald-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div>
          <h3 className="text-sm font-extrabold text-gray-900">
            Supplies Needed for {weekLabel}
          </h3>
          {supplies.length > 0 && (
            <p className="mt-0.5 text-xs text-gray-500">
              {resolvedCount}/{supplies.length} items marked
            </p>
          )}
        </div>
        <span className="text-xs text-gray-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="border-t border-emerald-100 px-4 pb-4 pt-2">
          {error ? (
            <div className="mb-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</div>
          ) : null}
          {loading ? (
            <div className="text-xs text-gray-500 py-2">Loading supplies…</div>
          ) : supplies.length === 0 ? (
            <div className="text-xs text-gray-500 py-2">
              No supplies are attached to lessons planned for next week. Supplies are added by admins when a lesson is created.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {supplies.map((s) => {
                const key = `${s.name}|${s.unit || ""}`;
                const status = itemStatus[key];
                const isRequesting = !!requesting[key];
                return (
                  <div key={key} className="rounded-lg border border-gray-100 p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className={`text-sm font-semibold ${status ? "text-gray-500" : "text-amber-700"}`}>
                          {s.name}
                          {s.unit ? ` (${s.unit})` : ""}
                        </div>
                        <div className="text-xs text-gray-500">
                          Needed: {s.totalQuantity || 1}
                          {s.lessons?.length ? (
                            <span> · For: {s.lessons.map((l) => l.title).join(", ")}</span>
                          ) : null}
                        </div>
                      </div>
                      {status === "requested" && (
                        <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                          {isRequesting ? "Sending…" : "Requested ✓"}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {SUPPLY_STATUS_OPTIONS.map((opt) => {
                        const active = status === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            disabled={isRequesting}
                            onClick={() => handleStatusChange(s, key, opt.value)}
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                              active
                                ? opt.value === "requested"
                                  ? "bg-rose-600 text-white"
                                  : "bg-emerald-600 text-white"
                                : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                            } disabled:opacity-60`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <button
            type="button"
            onClick={load}
            className="mt-3 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
          >
            Refresh
          </button>
        </div>
      )}
    </div>
  );
}

