import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import {
  AGE_GROUPS,
  COMPONENTS,
  MAX_ITEM_LENGTH,
  MEALS,
  addDays,
  componentsFor,
  formatWeekRange,
  getMeal,
  lineKey,
  requirementsFor,
  toDateKey,
  weekDays,
  weekStartOf,
} from "@/lib/menuPlan";

const NAVY = "text-[#0b2a5b] dark:text-blue-200";

const TONES = {
  purple: {
    row: "bg-purple-50/70 dark:bg-purple-900/10",
    label: "text-purple-700 dark:text-purple-300",
    head: "bg-purple-100/70 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    card: "border-purple-100 dark:border-purple-900/40",
  },
  blue: {
    row: "bg-sky-50/70 dark:bg-sky-900/10",
    label: "text-blue-700 dark:text-blue-300",
    head: "bg-blue-100/60 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    card: "border-blue-100 dark:border-blue-900/40",
  },
  green: {
    row: "bg-green-50/70 dark:bg-green-900/10",
    label: "text-green-700 dark:text-green-300",
    head: "bg-green-100/70 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    card: "border-green-100 dark:border-green-900/40",
  },
};

const TAB_ACTIVE = {
  breakfast: "bg-amber-50 border-b-amber-400 dark:bg-amber-900/20",
  amSnack: "bg-green-50 border-b-green-500 dark:bg-green-900/20",
  lunch: "bg-blue-50 border-b-blue-600 dark:bg-blue-900/20",
  pmSnack: "bg-purple-50 border-b-purple-500 dark:bg-purple-900/20",
  dinner: "bg-orange-50 border-b-orange-500 dark:bg-orange-900/20",
  eveningSnack: "bg-cyan-50 border-b-cyan-600 dark:bg-cyan-900/20",
};

/**
 * Weekly Menu Planner: meal tabs across the top, Monday–Friday columns and
 * one row per age group. With `editable` the component lines are text inputs
 * the admin fills in and saves; otherwise it shows the posted items.
 */
export default function MenuPlanner({ editable = false, title = "Menu Planner", subtitle }) {
  const router = useRouter();
  const [weekStart, setWeekStart] = useState(() => weekStartOf(new Date()));
  const [mealKey, setMealKey] = useState("breakfast");
  const [saved, setSaved] = useState({});
  const [edits, setEdits] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const dayKeys = useMemo(() => days.map(toDateKey), [days]);
  const meal = getMeal(mealKey);

  const loadWeek = useCallback(async (monday) => {
    const start = toDateKey(monday);
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/v1/menus?start=${start}&days=5`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Request failed");
      const data = await res.json();
      const weekKeys = new Set(weekDays(monday).map(toDateKey));
      setSaved((prev) => {
        const next = {};
        for (const [key, value] of Object.entries(prev)) {
          if (!weekKeys.has(key.slice(0, 10))) next[key] = value;
        }
        for (const i of data.items || []) {
          next[lineKey(i.date, i.meal, i.ageGroup, i.component)] = i.item;
        }
        return next;
      });
    } catch (e) {
      setError(e.message || "Could not load the menu.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWeek(weekStart);
  }, [loadWeek, weekStart]);

  // Edits made on other tabs or weeks are kept until saved.
  const changedLines = useMemo(
    () =>
      Object.entries(edits)
        .filter(([key, value]) => value.trim() !== (saved[key] || ""))
        .map(([key, value]) => {
          const [date, lineMeal, ageGroup, component] = key.split("|");
          return { date, meal: lineMeal, ageGroup, component, item: value.trim() };
        }),
    [edits, saved],
  );
  const dirty = changedLines.length > 0;

  const dirtyRef = useRef(false);
  dirtyRef.current = editable && dirty;

  useEffect(() => {
    if (!editable) return undefined;
    const beforeUnload = (e) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    const routeChange = () => {
      if (dirtyRef.current && !window.confirm("You have unsaved menu changes. Leave without saving?")) {
        router.events.emit("routeChangeError");
        throw "Route change aborted: unsaved menu changes";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    router.events.on("routeChangeStart", routeChange);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      router.events.off("routeChangeStart", routeChange);
    };
  }, [editable, router.events]);

  const valueFor = (key) => (key in edits ? edits[key] : saved[key] || "");

  const setValue = (key, value) => {
    setNotice("");
    setEdits((prev) => ({ ...prev, [key]: value }));
  };

  async function save() {
    if (!dirty) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/v1/menus", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: changedLines }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Save failed");
      setSaved((prev) => {
        const next = { ...prev };
        for (const line of changedLines) {
          const key = lineKey(line.date, line.meal, line.ageGroup, line.component);
          if (line.item) next[key] = line.item;
          else delete next[key];
        }
        return next;
      });
      setEdits({});
      setNotice("Menu saved.");
    } catch (e) {
      setError(e.message || "Could not save the menu.");
    } finally {
      setSaving(false);
    }
  }

  function printMenu() {
    const done = () => {
      document.body.classList.remove("printing-menu");
      window.removeEventListener("afterprint", done);
    };
    document.body.classList.add("printing-menu");
    window.addEventListener("afterprint", done);
    window.print();
  }

  const weekIsEmpty =
    !loading && !Object.keys(saved).some((key) => dayKeys.includes(key.slice(0, 10)));
  const today = toDateKey(new Date());

  return (
    <div className="menu-print-area space-y-4 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 sm:p-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className={`text-2xl font-black uppercase tracking-tight ${NAVY}`}>{title}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {subtitle || (editable ? "Plan Meals" : "Planned Meals")} – {meal.label}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="menu-no-print inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
            onClick={() => setWeekStart((d) => addDays(d, -7))}
          >
            <span aria-hidden>‹</span> Previous Week
          </button>
          <div className={`flex items-center gap-2 px-2 text-base font-extrabold sm:text-lg ${NAVY}`}>
            <CalendarIcon />
            {formatWeekRange(weekStart)}
          </div>
          <button
            type="button"
            className="menu-no-print inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
            onClick={() => setWeekStart((d) => addDays(d, 7))}
          >
            Next Week <span aria-hidden>›</span>
          </button>
          {toDateKey(weekStart) !== toDateKey(weekStartOf(new Date())) && (
            <button
              type="button"
              className="menu-no-print text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300"
              onClick={() => setWeekStart(weekStartOf(new Date()))}
            >
              This week
            </button>
          )}
        </div>

        <div className="menu-no-print flex items-center gap-2">
          {editable && (
            <button
              type="button"
              onClick={save}
              disabled={!dirty || saving}
              className="rounded-lg bg-[#0b2a5b] px-4 py-1.5 text-sm font-bold text-white hover:bg-[#123a78] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : dirty ? `Save changes (${changedLines.length})` : "Saved"}
            </button>
          )}
          <button
            type="button"
            onClick={printMenu}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          >
            <PrintIcon /> Print / Export
          </button>
        </div>
      </div>

      {(error || notice) && (
        <div
          role="status"
          className={`menu-no-print rounded-lg px-3 py-2 text-sm font-semibold ${
            error
              ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300"
              : "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300"
          }`}
        >
          {error || notice}
        </div>
      )}

      {/* Meal tabs */}
      <div className="menu-no-print overflow-x-auto">
        <div role="tablist" className="inline-flex min-w-max rounded-xl border border-gray-200 dark:border-gray-700">
          {MEALS.map((m) => {
            const active = m.key === mealKey;
            return (
              <button
                key={m.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setMealKey(m.key)}
                className={`flex items-center gap-2 border-b-2 border-r border-r-gray-200 px-5 py-2.5 text-sm font-bold last:border-r-0 dark:border-r-gray-700 ${
                  active
                    ? `${TAB_ACTIVE[m.key]} ${NAVY}`
                    : "border-b-transparent text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700/40"
                }`}
              >
                <MealIcon name={m.icon} />
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {!editable && weekIsEmpty && !error && (
        <p className="menu-no-print rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:bg-gray-900/40 dark:text-gray-300">
          The menu for this week has not been posted yet.
        </p>
      )}

      {/* Grid */}
      <div className="overflow-x-auto">
        <table
          className={`w-full min-w-[980px] table-fixed border-collapse text-left ${loading ? "opacity-60" : ""}`}
          aria-busy={loading}
        >
          <thead>
            <tr>
              <th className={`w-[130px] border border-gray-200 px-2 py-3 text-center text-xs font-black uppercase dark:border-gray-700 ${NAVY}`}>
                Age Groups
              </th>
              {days.map((day, i) => (
                <th
                  key={dayKeys[i]}
                  className={`border border-gray-200 px-2 py-2 text-center dark:border-gray-700 ${NAVY} ${
                    dayKeys[i] === today ? "bg-amber-50/70 dark:bg-amber-900/10" : ""
                  }`}
                >
                  <div className="text-sm font-black uppercase">
                    {day.toLocaleDateString("en-US", { weekday: "long" })}
                  </div>
                  <div className="text-xs font-bold">
                    {day.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {AGE_GROUPS.map((group) => {
              const tone = TONES[group.tone];
              const components = componentsFor(mealKey, group.key);
              return (
                <tr key={group.key}>
                  <th scope="row" className={`border border-gray-200 px-2 py-3 text-center align-middle dark:border-gray-700 ${tone.row}`}>
                    <div className={`flex flex-col items-center gap-1 ${tone.label}`}>
                      <AgeIcon group={group.key} />
                      <span className="text-sm font-black leading-tight">{group.label}</span>
                      {group.range && <span className="text-[11px] font-semibold">({group.range})</span>}
                    </div>
                  </th>
                  {dayKeys.map((date) => (
                    <td key={date} className="border border-gray-200 p-1.5 align-top dark:border-gray-700">
                      <div className={`h-full overflow-hidden rounded-lg border ${tone.card}`}>
                        <div className={`px-2 py-1.5 text-[10px] font-black uppercase tracking-wide ${tone.head}`}>
                          Planned Menu
                        </div>
                        <div className="space-y-1.5 px-2 py-2">
                          {components.map((component) => {
                            const key = lineKey(date, mealKey, group.key, component);
                            const label = COMPONENTS[component];
                            const value = valueFor(key);
                            return (
                              <label key={component} className="flex items-end gap-1.5 text-[11px] text-gray-700 dark:text-gray-300">
                                <span className="w-[52%] shrink-0 leading-tight">{label}</span>
                                {editable ? (
                                  <input
                                    type="text"
                                    value={value}
                                    maxLength={MAX_ITEM_LENGTH}
                                    onChange={(e) => setValue(key, e.target.value)}
                                    aria-label={`${meal.label}, ${group.label}, ${date}: ${label}`}
                                    className={`min-w-0 flex-1 border-0 border-b bg-transparent px-0.5 py-0 text-[11px] font-semibold text-[#0b2a5b] focus:border-blue-600 focus:outline-none focus:ring-0 dark:text-blue-100 ${
                                      key in edits && edits[key].trim() !== (saved[key] || "")
                                        ? "border-amber-500"
                                        : "border-gray-300 dark:border-gray-600"
                                    }`}
                                  />
                                ) : (
                                  <span
                                    className={`min-w-0 flex-1 border-b border-gray-200 px-0.5 font-semibold dark:border-gray-700 ${
                                      value ? "text-[#0b2a5b] dark:text-blue-100" : "text-gray-300 dark:text-gray-600"
                                    }`}
                                  >
                                    {value || "—"}
                                  </span>
                                )}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Quick reference */}
      <div className="flex gap-3 rounded-xl bg-blue-50 px-4 py-3 dark:bg-blue-900/20">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-black text-white">
          i
        </span>
        <div className="text-xs text-[#0b2a5b] dark:text-blue-100">
          <div className="mb-1 text-sm font-extrabold text-blue-700 dark:text-blue-300">
            {meal.label} Requirements (Quick Reference)
          </div>
          {requirementsFor(mealKey).map(([who, what]) => (
            <div key={who}>
              <span className="font-bold">{who}:</span> {what}
            </div>
          ))}
          <div className="mt-0.5">Follow USDA CACFP meal pattern requirements for portion sizes and age groups.</div>
        </div>
      </div>
    </div>
  );
}

// ---- Icons ---------------------------------------------------------------

function Svg({ children, className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {children}
    </svg>
  );
}

function CalendarIcon() {
  return (
    <Svg>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18M8 14h2M14 14h2M8 17h2M14 17h2" />
    </Svg>
  );
}

function PrintIcon() {
  return (
    <Svg className="h-4 w-4">
      <path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2" />
      <rect x="6" y="14" width="12" height="7" rx="1" />
    </Svg>
  );
}

function MealIcon({ name }) {
  switch (name) {
    case "sun":
      return (
        <Svg className="h-5 w-5 text-amber-500">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </Svg>
      );
    case "apple":
      return (
        <Svg className="h-5 w-5 text-green-600">
          <path d="M12 7c-1.5-1-5-1.5-6.5 1.5S5 16 7.5 19c1.3 1.6 2.7 1.8 4.5 1 1.8.8 3.2.6 4.5-1 2.5-3 3.5-7.5 2-10.5S13.5 6 12 7z" />
          <path d="M12 7c0-2 1-3.5 3-4" />
        </Svg>
      );
    case "plate":
      return (
        <Svg className="h-5 w-5 text-blue-600">
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="3" />
          <path d="M3 5v5a1.5 1.5 0 0 0 1.5 1.5V19M21 5c-1.2.8-1.5 2.5-1.5 4.5 0 1.2.5 2 1.5 2.3V19" />
        </Svg>
      );
    case "cup":
      return (
        <Svg className="h-5 w-5 text-purple-600">
          <path d="M5 8h11v7a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V8zM16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3v2M12 3v2" />
        </Svg>
      );
    case "cloche":
      return (
        <Svg className="h-5 w-5 text-orange-500">
          <path d="M4 17a8 8 0 0 1 16 0M2 17h20M12 7V5M10 5h4" />
        </Svg>
      );
    case "moon":
      return (
        <Svg className="h-5 w-5 text-cyan-600">
          <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
        </Svg>
      );
    default:
      return null;
  }
}

function AgeIcon({ group }) {
  if (group === "children") {
    return (
      <Svg className="h-10 w-10">
        <circle cx="12" cy="6" r="3" />
        <path d="M9 4.5c1-1.5 5-1.5 6 0M7 11h10M12 9v7M12 16l-3 5M12 16l3 5M7 11l-1 4M17 11l1 4" />
      </Svg>
    );
  }
  return (
    <Svg className="h-10 w-10">
      <circle cx="12" cy="8" r="4.5" />
      <path d="M10.5 7.5h.01M13.5 7.5h.01M10.8 9.8c.7.5 1.7.5 2.4 0" />
      <path d="M7.5 21v-3.5a4.5 4.5 0 0 1 9 0V21M10 17h4" />
      {group === "youngerInfants" && <path d="M12 3.5c0-1 1-1.5 1.5-1" />}
    </Svg>
  );
}
