import StudentPerformance from "@/components/reports/StudentPerformance";
import { apiJson } from "@/lib/api";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

// Teacher / Coach / Student Support - Student Performance Report (client
// mockup 2026-10-02): the students on the left, the chosen student's report
// on the right. ?childId= opens a student directly, so any link to a
// student can land here.

const NAVY = "text-[#0b2a5b] dark:text-blue-100";

function initials(name) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2);
}

function Avatar({ person, size = "h-10 w-10" }) {
  return person.photoUrl ? (
    <img src={person.photoUrl} alt="" className={`${size} rounded-full object-cover`} />
  ) : (
    <span className={`${size} flex shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-black text-blue-800`} aria-hidden>{initials(person.name)}</span>
  );
}

/** profileHref(childId) adds a View Profile button; omit to hide it. */
export default function StudentReportWorkspace({ profileHref }) {
  const router = useRouter();
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [desc, setDesc] = useState(false);
  const [childId, setChildId] = useState("");

  useEffect(() => {
    apiJson("/api/v1/sop/tracking")
      .then((list) => setChildren(list))
      .catch((e) => setError(e.message || "Could not load the students"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!router.isReady || childId || !children.length) return;
    const wanted = typeof router.query.childId === "string" ? router.query.childId : "";
    setChildId(children.find((c) => c.id === wanted)?.id || children[0].id);
  }, [router.isReady, router.query.childId, children, childId]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = children.filter((c) => !q || c.name.toLowerCase().includes(q));
    list.sort((a, b) => a.name.localeCompare(b.name) * (desc ? -1 : 1));
    return list;
  }, [children, search, desc]);

  function choose(id) {
    setChildId(id);
    router.replace({ pathname: router.pathname, query: { ...router.query, childId: id } }, undefined, { shallow: true });
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <aside className="rounded-2xl border border-gray-200 bg-white p-4 lg:sticky lg:top-20 lg:w-72 lg:shrink-0 dark:border-gray-700 dark:bg-gray-900">
        <h1 className={`text-3xl font-black ${NAVY}`}>Students</h1>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name..." aria-label="Search students" className="mt-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800" />
        <p className={`mt-3 text-sm ${NAVY}`}>{visible.length} students</p>
        <button type="button" onClick={() => setDesc((d) => !d)} className={`mt-1 flex w-full items-center gap-1 rounded-t-lg bg-blue-50 px-3 py-2 text-sm font-bold dark:bg-gray-800 ${NAVY}`}>
          Student Name <span aria-hidden>{desc ? "↓" : "↑"}</span>
        </button>
        {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
        <ul className="max-h-[70vh] divide-y divide-gray-100 overflow-y-auto dark:divide-gray-800">
          {loading && <li className="py-3 text-sm text-gray-500">Loading...</li>}
          {visible.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => choose(c.id)}
                aria-current={c.id === childId ? "true" : undefined}
                className={`flex w-full items-center gap-3 px-2 py-2 text-left text-[15px] text-blue-800 hover:bg-blue-50 dark:text-blue-200 dark:hover:bg-gray-800 ${c.id === childId ? "bg-blue-50 font-semibold dark:bg-gray-800" : ""}`}
              >
                <Avatar person={c} />
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <div className="min-w-0 flex-1">
        {childId ? (
          <StudentPerformance
            childId={childId}
            header={(child) => (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
                <div className="flex items-center gap-4">
                  <Avatar person={child} size="h-16 w-16" />
                  <div>
                    <div className={`text-2xl font-black ${NAVY}`}>{child.name}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">{[child.classroom, child.teacher && `Teacher: ${child.teacher}`].filter(Boolean).join(" • ")}</div>
                  </div>
                </div>
                {profileHref && (
                  <Link href={profileHref(child.id)} className="rounded-lg border-2 border-blue-700 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50 dark:text-blue-300">
                    View Profile
                  </Link>
                )}
              </div>
            )}
          />
        ) : (
          !loading && <p className="text-sm text-gray-500">No students to show.</p>
        )}
      </div>
    </div>
  );
}
