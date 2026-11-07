import EnrollmentStatusModal from "@/components/children/EnrollmentStatusModal";
import { ageInMonths } from "@/lib/ageUtils";
import { apiJson } from "@/lib/api";
import { getLinkedParentUsers } from "@/lib/child-parent-links";
import { isEnrolledNow } from "@/lib/enrollment";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

// Student List (client mockup, sheet 2026-11-07 R43): a filterable table of
// students with classroom and carpool set in place, a clock for the time
// sheet and a ⋮ menu (View Profile, Enrollment Status); under it Student
// Attendance for a day with Check In / Check Out and Move Today.

const NAVY = "text-[#0b2a5b] dark:text-blue-100";
const control = "rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100";
const PAGE_SIZES = [10, 25, 50];

const fullName = (c) => `${c.firstName || ""} ${c.lastName || ""}`.trim();
const initialsOf = (c) => `${(c.firstName || "")[0] || ""}${(c.lastName || "")[0] || ""}`.toUpperCase() || "?";
const timeOf = (v) => (v ? new Date(v).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "—");
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function ageLabel(birthDate) {
  const months = ageInMonths(birthDate);
  if (months == null || months < 0) return "—";
  return months < 24 ? `${months} mo` : `${Math.floor(months / 12)} yrs`;
}

function Avatar({ child }) {
  if (child.photoUrl) return <img src={child.photoUrl} alt="" className="h-8 w-8 rounded-full object-cover" />;
  return <span className="grid h-8 w-8 place-items-center rounded-full bg-sky-100 text-xs font-black text-sky-800">{initialsOf(child)}</span>;
}

function SortHeader({ label, sortKey, sort, setSort }) {
  const active = sort.key === sortKey;
  return (
    <button type="button" onClick={() => setSort((s) => ({ key: sortKey, dir: s.key === sortKey ? -s.dir : 1 }))} className="inline-flex items-center gap-1" aria-label={`Sort by ${label}`}>
      {label}
      <span aria-hidden className="text-gray-400">{active ? (sort.dir === 1 ? "▲" : "▼") : "↕"}</span>
    </button>
  );
}

function RowMenu({ child, profileHref, onEnrollment, onDelete }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label={`More actions for ${fullName(child)}`} aria-expanded={open} className="rounded-md border border-gray-300 px-2 py-1 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200">
        ⋮
      </button>
      {open ? (
        <div className="absolute right-0 z-20 mt-1 w-48 rounded-xl border border-gray-200 bg-white p-1 text-left shadow-lg dark:border-gray-700 dark:bg-gray-900" onMouseLeave={() => setOpen(false)}>
          <Link href={profileHref(child.id)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50 dark:text-blue-200 dark:hover:bg-gray-800">
            <span aria-hidden>{"\u{1F441}"}</span> View Profile
          </Link>
          <button type="button" onClick={() => { setOpen(false); onEnrollment(child); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800">
            <span aria-hidden className="text-orange-500">●</span> Enrollment Status
          </button>
          {onDelete ? (
            <button type="button" onClick={() => { setOpen(false); onDelete(child); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 dark:hover:bg-gray-800">
              <span aria-hidden>✕</span> Delete Student
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * children: the center's children (with linked parents and today's
 * attendance); classes: classrooms; onChanged(): reload after an update;
 * onTimeSheet(child), onCheck(child, "CHECK_IN" | "CHECK_OUT"),
 * onMoveToday(child, classRoomId) and onDelete(child) come from the Student
 * List page.
 */
export default function StudentListTable({ children, classes, centerId, loading, profileHref, onChanged, onTimeSheet, onCheck, onMoveToday, onDelete, savingId }) {
  const [view, setView] = useState("ENROLLED");
  const [name, setName] = useState("");
  const [parent, setParent] = useState("");
  const [age, setAge] = useState("");
  const [classroom, setClassroom] = useState("");
  const [carpool, setCarpool] = useState("");
  const [sort, setSort] = useState({ key: "name", dir: 1 });
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [enrollmentChild, setEnrollmentChild] = useState(null);
  const [error, setError] = useState("");

  const classById = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);
  const centerClasses = useMemo(() => classes.filter((c) => !centerId || c.centerId === centerId), [classes, centerId]);
  const parentNameOf = (c) => getLinkedParentUsers(c).map((p) => p.name || p.email).filter(Boolean).join(", ");
  const carpools = useMemo(() => [...new Set(children.map((c) => c.carpool).filter(Boolean))].sort(), [children]);
  const parents = useMemo(() => [...new Set(children.map(parentNameOf).filter(Boolean))].sort(), [children]);
  const ages = useMemo(() => [...new Set(children.map((c) => ageLabel(c.birthDate)).filter((a) => a !== "—"))].sort((a, b) => parseFloat(a) - parseFloat(b)), [children]);

  const rows = useMemo(() => {
    const q = name.trim().toLowerCase();
    const list = children.filter(
      (c) =>
        (view === "ALL" || (view === "ENROLLED" ? isEnrolledNow(c) : !isEnrolledNow(c))) &&
        (!q || fullName(c).toLowerCase().includes(q)) &&
        (!parent || parentNameOf(c) === parent) &&
        (!age || ageLabel(c.birthDate) === age) &&
        (!classroom || c.classRoomId === classroom) &&
        (!carpool || (carpool === "NONE" ? !c.carpool : c.carpool === carpool)),
    );
    const value = {
      name: (c) => fullName(c).toLowerCase(),
      parent: (c) => parentNameOf(c).toLowerCase(),
      age: (c) => -new Date(c.birthDate || 0).getTime(),
      classroom: (c) => (classById.get(c.classRoomId)?.name || "").toLowerCase(),
      carpool: (c) => (c.carpool || "").toLowerCase(),
    }[sort.key];
    return list.sort((a, b) => (value(a) > value(b) ? 1 : value(a) < value(b) ? -1 : 0) * sort.dir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children, view, name, parent, age, classroom, carpool, sort, classById]);

  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pages);
  const shown = rows.slice((current - 1) * pageSize, current * pageSize);
  const clearFilters = () => {
    setView("ENROLLED");
    setName("");
    setParent("");
    setAge("");
    setClassroom("");
    setCarpool("");
    setPage(1);
  };

  async function saveField(child, patch) {
    setError("");
    try {
      await apiJson(`/api/v1/children/${child.id}`, { method: "PUT", body: JSON.stringify(patch) });
      await onChanged();
    } catch (e) {
      setError(e.message || "Could not save the change");
    }
  }

  const filter = (label, value, setter, options, all) => (
    <label className={`text-xs font-bold ${NAVY}`}>
      {label}
      <select value={value} onChange={(e) => { setter(e.target.value); setPage(1); }} className={`${control} mt-1 block w-40`}>
        <option value="">{all}</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );

  return (
    <div className="space-y-6">
      <section>
        <div className="flex flex-wrap items-end gap-3">
          <label className={`text-xs font-bold ${NAVY}`}>
            View
            <select value={view} onChange={(e) => { setView(e.target.value); setPage(1); }} className={`${control} mt-1 block w-36`}>
              <option value="ENROLLED">Enrolled Only</option>
              <option value="NOT_ENROLLED">Not Enrolled</option>
              <option value="ALL">All Students</option>
            </select>
          </label>
          <label className={`text-xs font-bold ${NAVY}`}>
            Student Name
            <input value={name} onChange={(e) => { setName(e.target.value); setPage(1); }} placeholder="Search..." aria-label="Search student name" className={`${control} mt-1 block w-44`} />
          </label>
          {filter("Parent Name", parent, setParent, parents.map((p) => [p, p]), "All")}
          {filter("Age", age, setAge, ages.map((a) => [a, a]), "All")}
          {filter("Classroom", classroom, setClassroom, centerClasses.map((c) => [c.id, c.name]), "All Classrooms")}
          {filter("Carpool", carpool, setCarpool, [["NONE", "None"], ...carpools.map((c) => [c, c])], "All Carpools")}
          <button type="button" onClick={clearFilters} className="ml-auto rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:text-gray-200">
            ⨯ Clear Filters
          </button>
        </div>
        {error ? <div role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        <div className="mt-3 overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className={`bg-blue-50 text-left text-xs font-bold dark:bg-gray-800 ${NAVY}`}>
                <th className="px-3 py-2">Photo</th>
                <th className="px-3 py-2"><SortHeader label="Student Name" sortKey="name" sort={sort} setSort={setSort} /></th>
                <th className="px-3 py-2"><SortHeader label="Parent Name" sortKey="parent" sort={sort} setSort={setSort} /></th>
                <th className="px-3 py-2"><SortHeader label="Age" sortKey="age" sort={sort} setSort={setSort} /></th>
                <th className="px-3 py-2"><SortHeader label="Classroom" sortKey="classroom" sort={sort} setSort={setSort} /></th>
                <th className="px-3 py-2"><SortHeader label="Carpool" sortKey="carpool" sort={sort} setSort={setSort} /></th>
                <th className="px-3 py-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {shown.map((c) => (
                <tr key={c.id} className="text-gray-800 dark:text-gray-200">
                  <td className="px-3 py-1.5"><Avatar child={c} /></td>
                  <td className="px-3 py-1.5">
                    <Link href={profileHref(c.id)} className="font-semibold text-blue-700 hover:underline dark:text-blue-300">{fullName(c)}</Link>
                  </td>
                  <td className="px-3 py-1.5">{parentNameOf(c) || "—"}</td>
                  <td className="px-3 py-1.5">{ageLabel(c.birthDate)}</td>
                  <td className="px-3 py-1.5">
                    <select value={c.classRoomId || ""} onChange={(e) => saveField(c, { classRoomId: e.target.value || null })} aria-label={`Classroom for ${fullName(c)}`} className={`${control} w-44`}>
                      <option value="">No classroom</option>
                      {classes.filter((r) => r.centerId === c.centerId).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-1.5">
                    <select value={c.carpool || ""} onChange={(e) => saveField(c, { carpool: e.target.value })} aria-label={`Carpool for ${fullName(c)}`} className={`${control} w-44`}>
                      <option value="">None</option>
                      {carpools.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center justify-center gap-2">
                      <button type="button" onClick={() => onTimeSheet(c)} aria-label={`Time sheet for ${fullName(c)}`} title="Time sheet" className="rounded-md border border-blue-300 px-2 py-1 text-blue-700 hover:bg-blue-50">
                        {"\u{1F552}"}
                      </button>
                      <RowMenu child={c} profileHref={profileHref} onEnrollment={setEnrollmentChild} onDelete={onDelete} />
                    </div>
                  </td>
                </tr>
              ))}
              {!shown.length ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-gray-500">{loading ? "Loading..." : "No students match."}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className={`mt-2 flex flex-wrap items-center justify-between gap-2 text-sm ${NAVY}`}>
          <span>
            Showing {rows.length ? (current - 1) * pageSize + 1 : 0} to {Math.min(current * pageSize, rows.length)} of {rows.length} students
          </span>
          <span className="flex items-center gap-2">
            Rows per page
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className={control} aria-label="Rows per page">
              {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <button type="button" onClick={() => setPage(current - 1)} disabled={current <= 1} className="rounded border px-2 disabled:opacity-30" aria-label="Previous page">‹</button>
            <span>{current} / {pages}</span>
            <button type="button" onClick={() => setPage(current + 1)} disabled={current >= pages} className="rounded border px-2 disabled:opacity-30" aria-label="Next page">›</button>
          </span>
        </div>
      </section>

      <StudentAttendance children={children} classes={centerClasses} centerId={centerId} onCheck={onCheck} onMoveToday={onMoveToday} savingId={savingId} />

      {enrollmentChild ? (
        <EnrollmentStatusModal childId={enrollmentChild.id} onClose={() => setEnrollmentChild(null)} onSaved={onChanged} />
      ) : null}
    </div>
  );
}

/** Student Attendance for a day: today with Check In / Check Out and Move Today; other days read-only. */
function StudentAttendance({ children, classes, centerId, onCheck, onMoveToday, savingId }) {
  const [open, setOpen] = useState(true);
  const [day, setDay] = useState(todayKey);
  const [search, setSearch] = useState("");
  const [classroom, setClassroom] = useState("");
  const [status, setStatus] = useState("");
  const [history, setHistory] = useState(null);
  const [moving, setMoving] = useState("");
  const isToday = day === todayKey();

  useEffect(() => {
    if (isToday || !centerId) {
      setHistory(null);
      return;
    }
    // Attendance days are stored at the server's local midnight, so ask for
    // the whole local day rather than a UTC date.
    apiJson(`/api/v1/attendance/history?centerId=${encodeURIComponent(centerId)}&from=${day}T00:00:00&to=${day}T23:59:59`)
      .then((records) => setHistory(new Map((Array.isArray(records) ? records : []).map((r) => [r.childId, r]))))
      .catch(() => setHistory(new Map()));
  }, [day, isToday, centerId]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return children
      .filter((c) => isEnrolledNow(c))
      .map((c) => {
        const att = isToday ? c.todayAttendance : history?.get(c.id);
        const state = att?.checkedOutAt ? "OUT" : att?.checkedInAt ? "IN" : "NONE";
        return { child: c, att, state };
      })
      .filter(
        (r) =>
          (!q || fullName(r.child).toLowerCase().includes(q)) &&
          (!classroom || r.child.classRoomId === classroom) &&
          (!status || r.state === status),
      )
      .sort((a, b) => fullName(a.child).localeCompare(fullName(b.child)));
  }, [children, history, isToday, search, classroom, status]);

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={`flex items-center gap-2 text-2xl font-black ${NAVY}`}>
          <span aria-hidden className="text-base">{open ? "▾" : "▸"}</span> Student Attendance
        </button>
        <input type="date" value={day} max={todayKey()} onChange={(e) => e.target.value && setDay(e.target.value)} aria-label="Attendance date" className={control} />
      </div>
      {open ? (
        <>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search child's name..." aria-label="Search child's name" className={`${control} w-60`} />
            <select value={classroom} onChange={(e) => setClassroom(e.target.value)} aria-label="Attendance classroom" className={`${control} ml-auto w-44`}>
              <option value="">All Classrooms</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Attendance status" className={`${control} w-40`}>
              <option value="">All Statuses</option>
              <option value="IN">Signed In</option>
              <option value="OUT">Signed Out</option>
              <option value="NONE">Not Signed In</option>
            </select>
          </div>
          <div className="mt-3 overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className={`bg-blue-50 text-left text-xs font-bold dark:bg-gray-800 ${NAVY}`}>
                  <th className="px-3 py-2">Child Name</th>
                  <th className="px-3 py-2 text-center">Sign In Time</th>
                  <th className="px-3 py-2 text-center">Sign Out Time</th>
                  <th className="px-3 py-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {rows.map(({ child, att, state }) => (
                  <tr key={child.id} className="text-gray-800 dark:text-gray-200">
                    <td className="px-3 py-1.5">
                      <span className="flex items-center gap-2">
                        <Avatar child={child} />
                        <span className="font-semibold">{fullName(child)}</span>
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-center">{timeOf(att?.checkedInAt)}</td>
                    <td className="px-3 py-1.5 text-center">{timeOf(att?.checkedOutAt)}</td>
                    <td className="px-3 py-1.5">
                      {isToday ? (
                        <div className="flex items-center justify-center gap-2">
                          {state === "IN" ? (
                            <button type="button" disabled={savingId === child.id} onClick={() => onCheck(child, "CHECK_OUT")} className="w-28 rounded-md bg-[#16305e] px-3 py-1 text-xs font-bold text-white disabled:opacity-60">
                              Check Out
                            </button>
                          ) : (
                            <button type="button" disabled={savingId === child.id} onClick={() => onCheck(child, "CHECK_IN")} className="w-28 rounded-md bg-emerald-600 px-3 py-1 text-xs font-bold text-white disabled:opacity-50">
                              Check In
                            </button>
                          )}
                          {moving === child.id ? (
                            <select
                              autoFocus
                              aria-label={`Move ${fullName(child)} today`}
                              defaultValue=""
                              onChange={(e) => {
                                setMoving("");
                                if (e.target.value) onMoveToday(child, e.target.value);
                              }}
                              onBlur={() => setMoving("")}
                              className={`${control} w-36 py-1 text-xs`}
                            >
                              <option value="">Move to...</option>
                              {classes.filter((r) => r.id !== child.classRoomId).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                            </select>
                          ) : (
                            <button type="button" disabled={state !== "IN"} onClick={() => setMoving(child.id)} title={state !== "IN" ? "Check the child in first" : ""} className="w-28 rounded-md bg-sky-100 px-3 py-1 text-xs font-bold text-sky-800 disabled:opacity-50">
                              ⇄ Move Today
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="text-center text-xs text-gray-500">{state === "NONE" ? "Not signed in" : ""}</div>
                      )}
                    </td>
                  </tr>
                ))}
                {!rows.length ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-gray-500">No children match.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  );
}
