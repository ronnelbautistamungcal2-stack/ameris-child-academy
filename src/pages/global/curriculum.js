import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import GlobalLayout from "@/components/global/GlobalLayout";
import { apiJson } from "@/lib/api";
import { normalizeRoles } from "@/lib/roles";

// Global admin > Lesson Bank / SOP Bank (client 2026-11-07, step E). The
// Ameris Solutions curriculum lives in one center: its Lesson Bank, Lesson
// Planner (one per age group) and Steps of Progression Bank feed every
// subscriber's Lesson Calendar and Initial Developmental Assessment. Editing
// uses the curriculum pages of the Admin portal, opened on that center.

const card = "rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900";
const primary = "rounded-xl bg-blue-800 px-4 py-2 text-sm font-bold text-white hover:bg-blue-900 disabled:opacity-50";
const button =
  "rounded-xl border border-blue-700 px-4 py-2 text-sm font-bold text-blue-800 hover:bg-blue-50 disabled:opacity-50 dark:border-blue-400 dark:text-blue-200 dark:hover:bg-blue-900/30";

const PAGES = [
  { href: "/admin/lessons", label: "Lesson Bank", text: "Every Ameris lesson, with its types, supplies and lesson file." },
  { href: "/admin/curriculum/planner", label: "Lesson Planner", text: "The lessons for each day number, one planner per age group." },
  { href: "/admin/curriculum?tab=lessons", label: "Steps of Progression Bank", text: "The steps used by every subscriber's Initial Developmental Assessment." },
  { href: "/admin/curriculum?tab=categories", label: "Categories", text: "The category, subject and age lists the forms offer." },
];

export default function GlobalCurriculumPage() {
  const { data: session } = useSession();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [moving, setMoving] = useState(false);
  const [target, setTarget] = useState("");
  const [opening, setOpening] = useState("");

  const load = useCallback(async () => {
    try {
      const next = await apiJson("/api/v1/global/curriculum");
      setData(next);
      setTarget(next.source?.id || "");
      setError("");
    } catch (e) {
      setError(e.message || "Could not load the curriculum");
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const canAdmin = normalizeRoles(session?.user?.roles, session?.user?.role).includes("ADMIN");

  async function open(href) {
    if (!data?.source) return;
    setOpening(href);
    try {
      // The curriculum pages pick their center from this remembered choice.
      window.localStorage.setItem("aca:curriculumClassroom", JSON.stringify({ centerId: data.source.id }));
    } catch {
      // Storage can be blocked; the pages then prefer the curriculum center anyway.
    }
    // Switch the role on the server and load the page fresh: updating the
    // session here would make this Global page redirect before we leave it.
    try {
      const { csrfToken } = await (await fetch("/api/auth/csrf")).json();
      await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csrfToken, data: { user: { role: "ADMIN" } } }),
      });
      window.location.assign(href);
    } catch {
      setError("Could not switch to the Admin role");
      setOpening("");
    }
  }

  async function moveSource() {
    setMoving(true);
    try {
      await apiJson("/api/v1/global/curriculum", { method: "PUT", body: JSON.stringify({ sourceCenterId: target }) });
      await load();
    } catch (e) {
      setError(e.message || "Could not change the curriculum center");
    } finally {
      setMoving(false);
    }
  }

  return (
    <GlobalLayout title="Curriculum">
      <h1 className="mb-5 text-3xl font-extrabold text-gray-900 dark:text-gray-100">Lesson Bank &amp; SOP Bank</h1>
      {error ? <div className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {!data ? (
        <div className={card}>Loading...</div>
      ) : (
        <div className="space-y-5">
          <div className={card}>
            <h2 className="text-lg font-extrabold text-gray-900 dark:text-gray-100">Ameris Solutions curriculum</h2>
            {data.source ? (
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                The banks and planners are kept in <strong>{data.source.name}</strong>. Subscribers see its planned lessons on their Lesson Calendar
                and its steps in their Initial Developmental Assessment, limited to the curriculum types and age groups on their account. Changes show
                right away.
              </p>
            ) : (
              <p className="mt-1 text-sm text-amber-800">No curriculum center is set. Choose the center that holds the Ameris lessons.</p>
            )}
            {!canAdmin ? (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Editing opens the Admin portal. Your user also needs the Admin role.
              </p>
            ) : null}
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {PAGES.map((p) => (
                <div key={p.href} className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                  <div className="font-bold text-gray-900 dark:text-gray-100">{p.label}</div>
                  <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{p.text}</p>
                  <button type="button" className={`${primary} mt-3`} disabled={!data.source || !canAdmin || Boolean(opening)} onClick={() => open(p.href)}>
                    {opening === p.href ? "Opening..." : `Open ${p.label}`}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className={card}>
            <h2 className="text-lg font-extrabold text-gray-900 dark:text-gray-100">Age groups</h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Each classroom of the curriculum center is one age group with its own Lesson Planner. Pick a subscriber&apos;s age groups on their
              subscription.
            </p>
            {data.ageGroups.length ? (
              <ul className="mt-3 flex flex-wrap gap-2">
                {data.ageGroups.map((g) => (
                  <li key={g.id} className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-900 dark:bg-blue-900/30 dark:text-blue-100">
                    {g.name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-gray-500">The curriculum center has no classrooms yet.</p>
            )}
          </div>

          <div className={card}>
            <h2 className="text-lg font-extrabold text-gray-900 dark:text-gray-100">Curriculum center</h2>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="text-sm">
                <span className="mb-1 block font-semibold text-gray-700 dark:text-gray-200">Center</span>
                <select
                  className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                >
                  {!target && <option value="">Choose a center</option>}
                  {data.centers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.lessons} lessons and steps)
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className={button} disabled={moving || !target || target === data.source?.id} onClick={moveSource}>
                {moving ? "Saving..." : "Use This Center"}
              </button>
            </div>
          </div>
        </div>
      )}
    </GlobalLayout>
  );
}
