import TrainingModule from "@/components/training/TrainingModule";
import { NAVY, card, fmtDate } from "@/components/training/trainingUi";
import Skeleton from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

// Teacher Training Pathway - detail of one pathway (client mockup 02): the
// training modules down the side and the selected module's materials,
// requests and acknowledgment. Every staff portal shares it.

export default function LearnerPathway({ pathwayId, backHref }) {
  const [data, setData] = useState(null);
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!pathwayId) return;
    try {
      const res = await apiJson(`/api/v1/training/pathways/${pathwayId}`);
      setData(res);
      setSelectedId((current) => {
        if (current && res.pathway.items.some((i) => i.id === current)) return current;
        const next = res.pathway.items.find((i) => i.myProgress?.status !== "COMPLETED") || res.pathway.items[0];
        return next?.id || "";
      });
    } catch (e) {
      setError(e.message || "Failed to load the pathway");
    }
  }, [pathwayId]);

  useEffect(() => {
    load();
  }, [load]);

  const items = data?.pathway.items || [];
  const selectedIndex = items.findIndex((i) => i.id === selectedId);
  const selected = items[selectedIndex];
  const completed = items.filter((i) => i.myProgress?.status === "COMPLETED").length;
  const pct = items.length ? Math.round((completed * 100) / items.length) : 0;

  async function choose(item) {
    setSelectedId(item.id);
    if (!item.myProgress) {
      await apiJson(`/api/v1/training/items/${item.id}/progress`, { method: "PUT", body: JSON.stringify({ action: "start" }) }).catch(() => {});
      load();
    }
  }

  if (error) return <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>;
  if (!data) return <Skeleton count={6} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href={backHref} className="text-sm font-semibold text-blue-700 hover:underline">← Back to Staff Training Pathway</Link>
          <h1 className={`mt-1 text-3xl font-black ${NAVY}`}>{data.pathway.title}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">{data.pathway.description}</p>
        </div>
        <div className={`${card} w-full max-w-sm p-4`}>
          <div className="flex items-center justify-between text-sm">
            <span className={`font-bold ${NAVY}`}>Overall Progress</span>
            <span className="text-gray-600">{completed} of {items.length} completed</span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1 text-right text-xs font-semibold text-gray-600">{pct}%</div>
        </div>
      </div>

      {data.pathway.materials.length ? (
        <div className={`${card} p-4`}>
          <div className={`text-sm font-bold ${NAVY}`}>Pathway Materials</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {data.pathway.materials.map((m, i) => (
              <a key={`${m.url}-${i}`} href={m.url} target="_blank" rel="noreferrer" className="rounded-lg border border-blue-200 px-3 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-50">
                {m.name}
              </a>
            ))}
          </div>
        </div>
      ) : null}

      {!items.length ? (
        <p className={`${card} p-4 text-sm text-gray-600`}>No trainings have been added to this pathway yet.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className={`${card} p-3`}>
            <div className={`px-2 pb-2 text-base font-black ${NAVY}`}>Training Modules ({items.length})</div>
            <ol className="space-y-1">
              {items.map((item, i) => {
                const status = item.myProgress?.status || "NOT_STARTED";
                const done = status === "COMPLETED";
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => choose(item)}
                      className={`flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left ${item.id === selectedId ? "bg-blue-50 dark:bg-gray-800" : "hover:bg-gray-50 dark:hover:bg-gray-800"}`}
                    >
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${done ? "bg-emerald-500 text-white" : status === "IN_PROGRESS" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600"}`}>
                        {done ? "✓" : i + 1}
                      </span>
                      <span>
                        <span className="block text-sm font-bold text-gray-900 dark:text-gray-100">{item.title}</span>
                        <span className="block text-xs text-gray-500">
                          {done ? `Completed on ${fmtDate(item.myProgress.completedAt)}` : status === "IN_PROGRESS" ? "In Progress" : "Not Started"}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
          <div className={`${card} p-5`}>
            {selected ? (
              <TrainingModule item={selected} progress={selected.myProgress} heading={`Module ${selectedIndex + 1} of ${items.length}`} onChanged={load} />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
