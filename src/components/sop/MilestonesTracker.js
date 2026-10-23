import StatusMixBar from "@/components/sop/StatusMixBar";
import { apiJson } from "@/lib/api";
import { SOP_LEVELS } from "@/lib/sop";
import { useState } from "react";

// The Student Performance Report's Milestones section, laid out like SOP
// Tracking (client request 2026-10-23): the Milestones % at the top, then per
// category its status mix and "N Active Goals"; opening a category shows a
// slider per active goal. canTrack: "ALL" (staff), "GENERAL" (parents mark off
// General goals only) or null (read only).

const NAVY = "text-[#0b2a5b] dark:text-blue-100";

export default function MilestonesTracker({ childId, milestones, percent, canTrack, onSaved, heading }) {
  const [open, setOpen] = useState({});
  const [edits, setEdits] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const editable = (category) => canTrack === "ALL" || (canTrack === "GENERAL" && category === "General");
  const dirty = Object.keys(edits).length > 0;

  async function save() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await apiJson(`/api/v1/sop/${encodeURIComponent(childId)}`, {
        method: "PUT",
        body: JSON.stringify({ mode: "tracking", levels: Object.entries(edits).map(([stepId, level]) => ({ stepId, level })) }),
      });
      setEdits({});
      setNotice("Saved.");
      await onSaved?.();
    } catch (e) {
      setError(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        {heading}
        {percent != null ? <span className={`text-2xl font-black ${NAVY}`}>{percent}%</span> : null}
      </div>
      {!milestones.length && <p className="text-sm text-gray-500">No milestones assessed yet.</p>}
      <div className="space-y-2">
        {milestones.map((m) => {
          const isOpen = open[m.name] ?? false;
          const canEdit = editable(m.name);
          return (
            <div key={m.name} className="rounded-xl border border-gray-200 dark:border-gray-700">
              <button type="button" onClick={() => setOpen({ ...open, [m.name]: !isOpen })} aria-expanded={isOpen} className="flex w-full flex-wrap items-center gap-3 px-3 py-2 text-left">
                <span className="w-52">
                  <span className={`block text-lg font-black ${NAVY}`}>
                    <span aria-hidden className="mr-1">{isOpen ? "▾" : "›"}</span>
                    {m.name}
                  </span>
                  <span className="block text-xs text-gray-500">{m.goals.length} Active Goals</span>
                </span>
                <StatusMixBar distribution={m.distribution} className="flex-1 md:max-w-[65%]" />
              </button>
              {isOpen && (
                <div className="border-t border-gray-100 p-3 dark:border-gray-800">
                  {!m.goals.length ? (
                    <p className="text-sm text-gray-500">No active goals in this category.</p>
                  ) : (
                    <div className="grid grid-cols-[minmax(140px,1fr)_minmax(300px,2fr)] gap-2">
                      <div />
                      <div className="grid grid-cols-4 text-center">
                        {SOP_LEVELS.map((l) => (
                          <div key={l.value} className="px-1">
                            <span className={`mx-auto block h-2.5 w-2.5 rounded-full ${l.dot}`} />
                            <div className={`text-xs font-bold ${NAVY}`}>{l.label === "Competency" ? "Competence" : l.label}</div>
                            <div className="text-[10px] text-gray-500">{l.hint}</div>
                          </div>
                        ))}
                      </div>
                      {m.goals.map((g) => {
                        const level = edits[g.id] || g.level || "NOT_STARTED";
                        const index = SOP_LEVELS.findIndex((l) => l.value === level);
                        return (
                          <div key={g.id} className="contents">
                            <div className={`self-center text-sm ${NAVY}`} title={g.question}>{g.title}</div>
                            <div className="relative flex items-center" style={{ padding: "0 calc(12.5% - 9px)" }}>
                              <div className="absolute left-[12.5%] right-[12.5%] h-0.5 bg-gray-300 dark:bg-gray-600" aria-hidden />
                              <input
                                type="range"
                                min="0"
                                max="3"
                                step="1"
                                value={index}
                                disabled={!canEdit}
                                onChange={(e) => {
                                  setNotice("");
                                  const next = SOP_LEVELS[Number(e.target.value)].value;
                                  setEdits((prev) => {
                                    const copy = { ...prev };
                                    if (next === (g.level || "NOT_STARTED")) delete copy[g.id];
                                    else copy[g.id] = next;
                                    return copy;
                                  });
                                }}
                                aria-label={`Level for ${g.title}`}
                                aria-valuetext={SOP_LEVELS[index]?.label}
                                className="milestone-slider relative w-full disabled:cursor-default"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {canTrack === "GENERAL" && !canEdit ? <p className="mt-2 text-xs text-gray-500">Only goals in the General category can be marked off here.</p> : null}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {error ? <div role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {notice ? <div role="status" className="mt-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{notice}</div> : null}
      {canTrack && milestones.length ? (
        <div className="mt-3 flex justify-end">
          <button type="button" onClick={save} disabled={!dirty || saving} className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      ) : null}
      <style jsx global>{`
        .milestone-slider {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          height: 24px;
        }
        .milestone-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 18px;
          width: 18px;
          border-radius: 9999px;
          background: #1d4ed8;
          border: 3px solid #fff;
          box-shadow: 0 0 0 1px #1d4ed8;
          cursor: grab;
        }
        .milestone-slider:disabled::-webkit-slider-thumb {
          background: #64748b;
          box-shadow: 0 0 0 1px #64748b;
          cursor: default;
        }
        .milestone-slider::-moz-range-thumb {
          height: 14px;
          width: 14px;
          border-radius: 9999px;
          background: #1d4ed8;
          border: 3px solid #fff;
          cursor: grab;
        }
      `}</style>
    </div>
  );
}
