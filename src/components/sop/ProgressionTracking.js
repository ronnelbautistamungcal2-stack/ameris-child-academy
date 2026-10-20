import Pager from "@/components/ui/Pager";
import { apiJson } from "@/lib/api";
import { SOP_LEVELS, SOP_STATUSES } from "@/lib/sop";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

// Progression Tracking (client mockup 2026-10-02): the children with their
// active goals and status, and for the selected child each category with
// its status mix and a slider per active goal (Not Started, Exposure,
// Competency, Mastery). Reaching Competency or Mastery brings in the next
// goal when saved.

const NAVY = "text-[#0b2a5b] dark:text-blue-100";
const PAGE_SIZE = 8;

function StatusPill({ status }) {
  const meta = SOP_STATUSES.find((s) => s.value === status);
  if (!meta) return <span className="text-xs text-gray-400">{"—"}</span>;
  return <span className={`inline-block min-w-[90px] rounded-md px-3 py-1 text-center text-xs font-bold ${meta.pill}`}>{meta.label}</span>;
}

function Distribution({ distribution }) {
  return (
    <div className="flex w-full max-w-md overflow-hidden rounded" aria-label="Goal status mix">
      {SOP_STATUSES.map((s) => (
        <div key={s.value} className="flex-1 text-center">
          <div className={`h-3 ${s.bar}`} />
          <div className="text-[10px] font-bold text-gray-700 dark:text-gray-300">{distribution?.[s.value] ?? 0}%</div>
          <div className="text-[9px] text-gray-500">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

function ageText(birthDate) {
  if (!birthDate) return "";
  const b = new Date(birthDate);
  const now = new Date();
  let m = (now.getFullYear() - b.getFullYear()) * 12 + now.getMonth() - b.getMonth();
  if (now.getDate() < b.getDate()) m -= 1;
  return m >= 12 ? `${Math.floor(m / 12)}y ${m % 12}m` : `${m}m`;
}

function initials(name) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2);
}

function Avatar({ child, size = "h-9 w-9" }) {
  return child.photoUrl ? (
    <img src={child.photoUrl} alt="" className={`${size} rounded-full object-cover`} />
  ) : (
    <span className={`${size} flex shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-black text-blue-800`} aria-hidden>{initials(child.name)}</span>
  );
}

/** profileHref(childId) links "View Full Profile"; omit to hide it. */
export default function ProgressionTracking({ profileHref }) {
  const [children, setChildren] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState("");
  const [classroom, setClassroom] = useState("");
  const [sort, setSort] = useState({ key: "name", dir: 1 });
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState(null);
  const [open, setOpen] = useState({});
  const [edits, setEdits] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadList = useCallback(async () => {
    try {
      const list = await apiJson("/api/v1/sop/tracking");
      setChildren(list);
      setSelectedId((id) => id || list[0]?.id || "");
    } catch (e) {
      setError(e.message || "Could not load the children");
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    if (!selectedId) return;
    setDetail(null);
    setEdits({});
    setNotice("");
    apiJson(`/api/v1/sop/${selectedId}`)
      .then(setDetail)
      .catch((e) => setError(e.message || "Could not load the child"));
  }, [selectedId]);

  const classrooms = useMemo(() => [...new Set(children.map((c) => c.classroom).filter(Boolean))].sort(), [children]);
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = children.filter((c) => (!q || c.name.toLowerCase().includes(q)) && (!classroom || c.classroom === classroom));
    const order = Object.fromEntries(SOP_STATUSES.map((s, i) => [s.value, i]));
    return list.sort((a, b) => {
      const x = sort.key === "status" ? order[a.status] ?? -1 : a[sort.key] ?? "";
      const y = sort.key === "status" ? order[b.status] ?? -1 : b[sort.key] ?? "";
      const cmp = typeof x === "number" ? x - y : String(x).localeCompare(String(y));
      return cmp * sort.dir;
    });
  }, [children, search, classroom, sort]);
  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const shown = visible.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const categories = useMemo(() => {
    if (!detail) return [];
    const map = new Map();
    for (const s of detail.steps.filter((x) => x.active)) {
      if (!map.has(s.category)) map.set(s.category, []);
      map.get(s.category).push(s);
    }
    return [...map.entries()].sort(([a], [b]) => (a === "General" ? -1 : b === "General" ? 1 : a.localeCompare(b)));
  }, [detail]);

  const levelOf = (s) => edits[s.id] ?? s.level ?? "NOT_STARTED";
  const dirty = Object.keys(edits).length > 0;

  async function save() {
    setSaving(true);
    setError("");
    try {
      const levels = Object.entries(edits).map(([stepId, level]) => ({ stepId, level }));
      const next = await apiJson(`/api/v1/sop/${selectedId}`, { method: "PUT", body: JSON.stringify({ mode: "tracking", levels }) });
      setDetail(next);
      setEdits({});
      setNotice("Progress saved.");
      loadList();
    } catch (e) {
      setError(e.message || "Could not save");
    } finally {
      setSaving(false);
    }
  }

  function select(id) {
    if (dirty && !window.confirm("You have unsaved changes. Switch child without saving?")) return;
    setSelectedId(id);
  }

  const header = (key, text) => (
    <th className="px-3 py-2">
      <button type="button" onClick={() => setSort((s) => ({ key, dir: s.key === key ? -s.dir : 1 }))} className="inline-flex items-center gap-1" aria-label={`Sort by ${text}`}>
        {text}
        <span aria-hidden className="text-[10px] text-gray-400">{sort.key === key ? (sort.dir === 1 ? "▲" : "▼") : "↕"}</span>
      </button>
    </th>
  );

  return (
    <div className="space-y-4">
      <h1 className={`text-3xl font-black ${NAVY}`}>Progression Tracking</h1>
      {error && <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
        <section className="rounded-2xl border border-gray-200 bg-white p-4 xl:w-[46%] dark:border-gray-700 dark:bg-gray-900">
          <h2 className={`text-2xl font-black ${NAVY}`}>Children</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search by name..." aria-label="Search children" className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800" />
            {classrooms.length > 1 && (
              <select value={classroom} onChange={(e) => { setClassroom(e.target.value); setPage(1); }} aria-label="Classroom" className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800">
                <option value="">All classrooms</option>
                {classrooms.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
          </div>
          <p className={`mt-2 text-sm ${NAVY}`}>{visible.length} children</p>
          <div className="mt-1 overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className={`bg-blue-50 text-xs font-bold dark:bg-gray-800 ${NAVY}`}>
                  {header("name", "Child Name")}
                  {header("activeGoals", "Active Goals")}
                  {header("lastUpdate", "Last Update")}
                  {header("status", "Status")}
                </tr>
              </thead>
              <tbody>
                {loadingList && (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-500">Loading...</td></tr>
                )}
                {!loadingList && !shown.length && (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-500">No children.</td></tr>
                )}
                {shown.map((c) => (
                  <tr key={c.id} className={`border-t border-gray-100 dark:border-gray-800 ${c.id === selectedId ? "bg-blue-50/70 dark:bg-gray-800/70" : ""}`}>
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => select(c.id)} className="flex items-center gap-2 text-left font-semibold text-blue-700 hover:underline dark:text-blue-300" aria-current={c.id === selectedId ? "true" : undefined}>
                        <Avatar child={c} />
                        {c.name}
                      </button>
                    </td>
                    <td className="px-3 py-2">{c.activeGoals} Active Goals</td>
                    <td className="px-3 py-2">{c.lastUpdate ? new Date(c.lastUpdate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}</td>
                    <td className="px-3 py-2"><StatusPill status={c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={`mt-2 flex items-center justify-between text-sm ${NAVY}`}>
            <span>Showing {visible.length ? (current - 1) * PAGE_SIZE + 1 : 0}-{Math.min(current * PAGE_SIZE, visible.length)} of {visible.length} children</span>
            <Pager page={current} pages={pages} onPage={setPage} />
          </div>
        </section>

        <section className="min-w-0 flex-1 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          {!detail ? (
            <p className="text-sm text-gray-500">{selectedId ? "Loading..." : "Choose a child."}</p>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar child={detail.child} size="h-14 w-14" />
                  <div>
                    <div className={`text-xl font-black ${NAVY}`}>{detail.child.name}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                      {ageText(detail.child.birthDate)}
                      {detail.child.classroom ? ` • ${detail.child.classroom}` : ""}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill status={detail.activeGoals ? detail.status : null} />
                  {profileHref && (
                    <Link href={profileHref(detail.child.id)} className="rounded-lg border border-blue-600 px-3 py-1.5 text-sm font-semibold text-blue-700 dark:text-blue-300">
                      View Full Profile
                    </Link>
                  )}
                </div>
              </div>

              {!categories.length && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  No active goals yet. They are created from the Initial Developmental Assessment (Generate Active Goals).
                </p>
              )}

              {categories.map(([name, goals]) => {
                const isOpen = open[name] ?? false;
                return (
                  <div key={name} className="rounded-xl border border-gray-200 dark:border-gray-700">
                    <button type="button" onClick={() => setOpen({ ...open, [name]: !isOpen })} aria-expanded={isOpen} className="flex w-full flex-wrap items-center gap-3 px-3 py-2 text-left">
                      <span className="w-48">
                        <span className={`block font-black ${NAVY}`}>
                          <span aria-hidden className="mr-1">{isOpen ? "▾" : "›"}</span>
                          {name}
                        </span>
                        <span className="block text-xs text-gray-500">{goals.length} Active Goals</span>
                      </span>
                      <Distribution distribution={detail.categories?.[name]?.distribution} />
                    </button>
                    {isOpen && (
                      <div className="border-t border-gray-100 p-3 dark:border-gray-800">
                        <div className="grid grid-cols-[minmax(140px,1fr)_minmax(320px,2fr)] gap-2">
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
                          {goals.map((g) => {
                            const index = SOP_LEVELS.findIndex((l) => l.value === levelOf(g));
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
                                    onChange={(e) => {
                                      setNotice("");
                                      setEdits((prev) => ({ ...prev, [g.id]: SOP_LEVELS[Number(e.target.value)].value }));
                                    }}
                                    aria-label={`Level for ${g.title}`}
                                    aria-valuetext={SOP_LEVELS[index]?.label}
                                    className="sop-slider relative w-full"
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {notice && <div role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{notice}</div>}
              <div className="flex justify-end">
                <button type="button" onClick={save} disabled={!dirty || saving} className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
      <style jsx global>{`
        .sop-slider {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          height: 24px;
        }
        .sop-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 18px;
          width: 18px;
          border-radius: 9999px;
          background: #1d4ed8;
          border: 3px solid #fff;
          box-shadow: 0 0 0 1px #1d4ed8;
          cursor: grab;
        }
        .sop-slider::-moz-range-thumb {
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
