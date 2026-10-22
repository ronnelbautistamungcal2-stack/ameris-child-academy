import { apiJson } from "@/lib/api";
import { SOP_LEVELS, formatExpectedAge, linkedStepFor } from "@/lib/sop";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Initial Developmental Assessment (client mockup 2026-10-02). Tabs are the
// step categories, each sub category is a collapsible group, and every step
// gets a level. Marking a step Not Started adds its previous step right under
// it; Competency or Mastery adds its next step. Save records the levels;
// Generate Active Goals also sends the goals to the teacher's Progression
// Tracking and the Student Performance Report.

const NAVY = "text-[#0b2a5b] dark:text-blue-100";
const LEVEL_ON = {
  NOT_STARTED: "border-red-400 bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  EXPOSURE: "border-orange-400 bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200",
  COMPETENCY: "border-yellow-400 bg-yellow-100 text-yellow-900 dark:bg-yellow-900/40 dark:text-yellow-100",
  MASTERY: "border-green-500 bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
};

function initials(name) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2);
}

function age(birthDate) {
  if (!birthDate) return "";
  const b = new Date(birthDate);
  const now = new Date();
  let m = (now.getFullYear() - b.getFullYear()) * 12 + now.getMonth() - b.getMonth();
  if (now.getDate() < b.getDate()) m -= 1;
  const y = Math.floor(m / 12);
  return y ? `${y} year${y === 1 ? "" : "s"} ${m % 12} month${m % 12 === 1 ? "" : "s"}` : `${m} month${m === 1 ? "" : "s"}`;
}

export default function DevelopmentalAssessment() {
  const router = useRouter();
  const [children, setChildren] = useState([]);
  const [childId, setChildId] = useState("");
  const [data, setData] = useState(null);
  const [edits, setEdits] = useState({}); // stepId -> { level?, notes? }
  const [tab, setTab] = useState("");
  const [open, setOpen] = useState({});
  const [dismissed, setDismissed] = useState({});
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    apiJson("/api/v1/sop/tracking")
      .then((list) => {
        setChildren(list);
        const wanted = typeof router.query.childId === "string" ? router.query.childId : "";
        setChildId(list.find((c) => c.id === wanted)?.id || list[0]?.id || "");
      })
      .catch((e) => setError(e.message || "Could not load the children"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async (id) => {
    if (!id) return;
    setError("");
    try {
      const next = await apiJson(`/api/v1/sop/${id}`);
      setData(next);
      setEdits({});
      setDismissed({});
    } catch (e) {
      setError(e.message || "Could not load the assessment");
    }
  }, []);

  useEffect(() => {
    load(childId);
  }, [childId, load]);

  const dirty = Object.keys(edits).length > 0;
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  useEffect(() => {
    const warn = (e) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const steps = useMemo(() => data?.steps || [], [data]);
  const byId = useMemo(() => Object.fromEntries(steps.map((s) => [s.id, s])), [steps]);
  const levelOf = (s) => edits[s.id]?.level ?? s.level;
  const notesOf = (s) => edits[s.id]?.notes ?? s.notes;
  const categories = useMemo(() => {
    const names = [...new Set(steps.map((s) => s.category))];
    return names.sort((a, b) => (a === "General" ? -1 : b === "General" ? 1 : a.localeCompare(b)));
  }, [steps]);
  const currentTab = categories.includes(tab) ? tab : categories[0];

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const map = new Map();
    for (const s of steps) {
      if (s.category !== currentTab) continue;
      if (q && ![s.title, s.question, notesOf(s)].some((v) => (v || "").toLowerCase().includes(q))) continue;
      if (!map.has(s.subCategory)) map.set(s.subCategory, []);
      map.get(s.subCategory).push(s);
    }
    return [...map.entries()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps, currentTab, search, edits]);

  function setLevel(step, level) {
    setNotice("");
    setEdits((prev) => ({ ...prev, [step.id]: { ...prev[step.id], level } }));
  }
  function setNotes(step, notes) {
    setEdits((prev) => ({ ...prev, [step.id]: { ...prev[step.id], notes } }));
  }

  async function save(generate) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const levels = Object.entries(edits)
        .map(([stepId, e]) => ({ stepId, level: e.level ?? byId[stepId]?.level, ...(e.notes !== undefined ? { notes: e.notes } : {}) }))
        .filter((l) => l.level);
      const next = await apiJson(`/api/v1/sop/${childId}`, { method: "PUT", body: JSON.stringify({ mode: "assessment", levels, generate }) });
      setData(next);
      setEdits({});
      setNotice(generate ? `Saved. ${next.activeGoals} active goal${next.activeGoals === 1 ? "" : "s"} sent to Progression Tracking.` : "Assessment saved.");
    } catch (e) {
      setError(e.message || "Could not save");
    } finally {
      setBusy(false);
    }
  }

  function switchChild(id) {
    if (dirty && !window.confirm("You have unsaved changes. Switch child without saving?")) return;
    setChildId(id);
  }

  // Rows for one group. A step brought in by another (its previous step for
  // Not Started, its next step for Competency or Mastery) moves right under
  // the step that brought it in, after a banner saying why.
  function rowsFor(list) {
    const linkOf = (step) => {
      const link = linkedStepFor(step, levelOf(step));
      return link && byId[link.stepId] && !dismissed[`${step.id}:${link.stepId}`] ? link : null;
    };
    const pullerOf = {};
    const walk = (step, depth) => {
      const link = linkOf(step);
      if (!link || depth > 4 || link.stepId === step.id || pullerOf[link.stepId] || pullerOf[step.id] === link.stepId) return;
      pullerOf[link.stepId] = step.id;
      walk(byId[link.stepId], depth + 1);
    };
    for (const step of list) if (!pullerOf[step.id]) walk(step, 0);

    const rows = [];
    const shown = new Set();
    const visit = (step, via) => {
      if (shown.has(step.id)) return;
      shown.add(step.id);
      rows.push({ step, via });
      const link = linkOf(step);
      if (link && pullerOf[link.stepId] === step.id) {
        rows.push({ banner: link.reason, from: step, to: byId[link.stepId] });
        visit(byId[link.stepId], link.reason);
      }
    };
    for (const step of list) if (!pullerOf[step.id]) visit(step, null);
    for (const step of list) visit(step, null); // anything left by a loop
    return rows;
  }

  const child = data?.child;
  const icon = (step, via) => {
    const level = levelOf(step);
    if (via) return <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs text-blue-700" title="Added from another step">{"⏲"}</span>;
    if (level === "COMPETENCY" || level === "MASTERY") return <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-600 text-xs text-white">{"✓"}</span>;
    if (level === "NOT_STARTED") return <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-xs font-black text-white">!</span>;
    return <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-400 text-xs font-black text-white">i</span>;
  };

  return (
    <div className="space-y-4">
      {child && (
        <div className="flex items-center gap-4">
          {child.photoUrl ? (
            <img src={child.photoUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-xl font-black text-blue-800" aria-hidden>{initials(child.name)}</div>
          )}
          <div>
            <div className={`text-2xl font-black ${NAVY}`}>{child.name}</div>
            <div className="text-sm text-gray-600 dark:text-gray-300">
              {age(child.birthDate)}
              {child.classroom ? ` | ${child.classroom}` : ""}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className={`text-3xl font-black ${NAVY}`}>Initial Developmental Assessment</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <select value={childId} onChange={(e) => switchChild(e.target.value)} aria-label="Switch child" className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800">
              {!children.length && <option value="">No children</option>}
              {children.map((c) => (
                <option key={c.id} value={c.id}>{c.name}{c.classroom ? ` — ${c.classroom}` : ""}</option>
              ))}
            </select>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search goals, questions or notes..." aria-label="Search the assessment" className="w-64 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800" />
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => save(false)} disabled={busy || !dirty} className="rounded-md bg-[#1d4f6e] px-5 py-2 text-sm font-bold text-white disabled:opacity-50">
            Save
          </button>
          <button type="button" onClick={() => save(true)} disabled={busy || !childId} className="rounded-md bg-[#1d4f6e] px-5 py-2 text-sm font-bold text-white disabled:opacity-50">
            Generate Active Goals
          </button>
        </div>
      </div>

      {(error || notice) && (
        <div role="status" className={`rounded-lg px-3 py-2 text-sm ${error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-800"}`}>{error || notice}</div>
      )}

      {data && !steps.length && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          This center has no Steps of Progression yet. Add or import them in Curriculum &gt; Steps of Progression Bank.
        </p>
      )}

      {categories.length > 0 && (
        <div role="tablist" className="flex overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={c === currentTab}
              onClick={() => setTab(c)}
              className={`min-w-[140px] flex-1 whitespace-nowrap border-b-4 px-4 py-3 text-sm font-semibold ${c === currentTab ? "border-blue-600 bg-blue-50 text-blue-800 dark:bg-gray-800 dark:text-blue-200" : `border-transparent ${NAVY} hover:bg-blue-50 dark:hover:bg-gray-800`}`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {groups.map(([sub, list]) => {
        const assessed = list.filter((s) => levelOf(s)).length;
        const isOpen = open[`${currentTab}:${sub}`] ?? true;
        return (
          <section key={sub} className="overflow-hidden rounded-2xl border border-blue-100 bg-white dark:border-gray-700 dark:bg-gray-900">
            <button type="button" onClick={() => setOpen({ ...open, [`${currentTab}:${sub}`]: !isOpen })} aria-expanded={isOpen} className="flex w-full items-center gap-4 bg-blue-50 px-4 py-3 text-left dark:bg-gray-800">
              <span className={`flex-1 text-lg font-black ${NAVY}`}>{sub}</span>
              <span className="text-sm text-gray-600 dark:text-gray-300">{assessed} of {list.length} assessed</span>
              <span className="h-2 w-28 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <span className="block h-full rounded-full bg-green-500" style={{ width: `${list.length ? (assessed * 100) / list.length : 0}%` }} />
              </span>
              <span aria-hidden className={NAVY}>{isOpen ? "▴" : "▾"}</span>
            </button>
            {isOpen && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead>
                    <tr className={`text-left text-xs font-bold ${NAVY}`}>
                      <th className="w-8 px-3 py-2" />
                      <th className="px-3 py-2">Goal (Age Expectation)</th>
                      <th className="px-3 py-2">Assessment Question</th>
                      <th className="px-3 py-2">Level</th>
                      <th className="w-52 px-3 py-2">Notes (Optional)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rowsFor(list).map((row) =>
                      row.banner ? (
                        <tr key={`banner-${row.from.id}-${row.to.id}`}>
                          <td colSpan={5} className="px-3 py-1">
                            <div className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${row.banner === "PREVIOUS" ? "bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-200" : "bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-200"}`}>
                              <span aria-hidden>{"↷"}</span>
                              <span className="flex-1">
                                <b>{row.banner === "PREVIOUS" ? "Previous Step Added" : "Next Step Added"}</b>
                                <span className="block text-xs">
                                  {row.banner === "PREVIOUS"
                                    ? `Because "${row.from.title}" was marked "Not Started," the previous step has been added to assess.`
                                    : `Because "${row.from.title}" reached ${levelOf(row.from) === "MASTERY" ? "Mastery" : "Competency"}, the next step has been added.`}
                                </span>
                              </span>
                              <button type="button" onClick={() => setDismissed({ ...dismissed, [`${row.from.id}:${row.to.id}`]: true })} aria-label="Dismiss" className="text-lg">&times;</button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        <tr key={row.step.id} className={`border-t border-gray-100 align-middle dark:border-gray-800 ${row.via ? "bg-blue-50/40 dark:bg-gray-800/40" : ""}`}>
                          <td className="px-3 py-2">{icon(row.step, row.via)}</td>
                          <td className="px-3 py-2">
                            <div className={`font-bold ${NAVY}`}>{row.step.title}</div>
                            {formatExpectedAge(row.step) && <div className="text-xs text-gray-500">({formatExpectedAge(row.step)})</div>}
                          </td>
                          <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{row.step.question || "—"}</td>
                          <td className="px-3 py-2">
                            <div className="flex gap-1.5" role="radiogroup" aria-label={`Level for ${row.step.title}`}>
                              {SOP_LEVELS.map((l) => {
                                const on = levelOf(row.step) === l.value;
                                return (
                                  <button
                                    key={l.value}
                                    type="button"
                                    role="radio"
                                    aria-checked={on}
                                    title={l.hint}
                                    onClick={() => setLevel(row.step, l.value)}
                                    className={`whitespace-nowrap rounded-md border px-2.5 py-1.5 text-xs font-semibold ${on ? LEVEL_ON[l.value] : "border-gray-300 bg-white text-[#0b2a5b] hover:bg-blue-50 dark:border-gray-600 dark:bg-gray-800 dark:text-blue-100"}`}
                                  >
                                    {l.label}
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              value={notesOf(row.step)}
                              onChange={(e) => setNotes(row.step, e.target.value)}
                              maxLength={500}
                              placeholder="Add notes..."
                              aria-label={`Notes for ${row.step.title}`}
                              className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800"
                            />
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
