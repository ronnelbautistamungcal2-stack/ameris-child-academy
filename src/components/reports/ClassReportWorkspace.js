import ClassPerformance from "@/components/reports/ClassPerformance";
import { NAVY } from "@/components/reports/reportUi";
import { apiJson } from "@/lib/api";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

// Class Performance Report with the Classes list (client mockup 2026-10-02):
// clicking a class name opens its report. ?classRoomId= opens one directly.
// A teacher with a single class just sees that class's report.

function schoolYear(now = new Date()) {
  const start = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start} – ${start + 1}`;
}

/** classHref(classRoomId) adds a View Class Details button; omit to hide it. */
export default function ClassReportWorkspace({ classHref }) {
  const router = useRouter();
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [classRoomId, setClassRoomId] = useState("");

  useEffect(() => {
    apiJson("/api/v1/reports/classes")
      .then(setClasses)
      .catch((e) => setError(e.message || "Could not load the classes"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!router.isReady || classRoomId || !classes.length) return;
    const wanted = typeof router.query.classRoomId === "string" ? router.query.classRoomId : "";
    setClassRoomId(classes.find((c) => c.id === wanted)?.id || classes[0].id);
  }, [router.isReady, router.query.classRoomId, classes, classRoomId]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return classes.filter((c) => !q || c.name.toLowerCase().includes(q));
  }, [classes, search]);

  function choose(id) {
    setClassRoomId(id);
    router.replace({ pathname: router.pathname, query: { ...router.query, classRoomId: id } }, undefined, { shallow: true });
  }

  const showList = classes.length > 1;

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      {showList && (
        <aside className="rounded-2xl border border-gray-200 bg-white p-4 lg:sticky lg:top-20 lg:w-64 lg:shrink-0 dark:border-gray-700 dark:bg-gray-900">
          <h1 className={`text-3xl font-black ${NAVY}`}>Classes</h1>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search classes..." aria-label="Search classes" className="mt-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800" />
          <ul className="mt-3 max-h-[70vh] space-y-1.5 overflow-y-auto">
            {visible.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => choose(c.id)}
                  aria-current={c.id === classRoomId ? "true" : undefined}
                  className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-[15px] ${
                    c.id === classRoomId ? "border-blue-200 bg-blue-50 font-semibold text-[#0b2a5b] dark:bg-gray-800 dark:text-blue-100" : "border-gray-200 text-[#0b2a5b] hover:bg-blue-50 dark:border-gray-700 dark:text-blue-100 dark:hover:bg-gray-800"
                  }`}
                >
                  <span>
                    {c.name}
                    {c.center && <span className="block text-xs font-normal text-gray-500">{c.center}</span>}
                  </span>
                  <span aria-hidden>{"›"}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
      )}

      <div className="min-w-0 flex-1">
        {error && <div role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        {loading && <p className="text-sm text-gray-500">Loading...</p>}
        {!loading && !classes.length && !error && <p className="text-sm text-gray-500">No classes to show.</p>}
        {classRoomId && (
          <ClassPerformance
            classRoomId={classRoomId}
            header={(room) => (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
                <div>
                  <div className={`text-3xl font-black ${NAVY}`}>{room.name}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    {room.teacher ? `Teacher: ${room.teacher} | ` : ""}School Year: {schoolYear()}
                  </div>
                </div>
                {classHref && (
                  <Link href={classHref(room.id)} className="rounded-lg border-2 border-blue-700 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50 dark:text-blue-300">
                    View Class Details
                  </Link>
                )}
              </div>
            )}
          />
        )}
      </div>
    </div>
  );
}
