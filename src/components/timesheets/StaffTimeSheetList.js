import EmploymentStatusModal from "@/components/timesheets/EmploymentStatusModal";
import TimeSheetModal from "@/components/timesheets/TimeSheetModal";
import { CURRENTLY_EMPLOYED, employmentStatusLabel } from "@/lib/employment";
import { apiJson } from "@/lib/api";
import { useEffect, useState } from "react";

// Staff List with each employee's clock icon (Employee Time). Used by the
// admin and HR Staff List pages until the full Staff List from the client's
// mockup (attendance dropdown, reset PIN, employment status) is built on it.

const time = (v) => (v ? new Date(v).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "");

export default function StaffTimeSheetList() {
  const [staff, setStaff] = useState(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState(null);
  const [employmentId, setEmploymentId] = useState(null);
  const [employment, setEmployment] = useState("ACTIVE");

  async function load() {
    try {
      setStaff(await apiJson("/api/v1/time-sheets/staff"));
    } catch (e) {
      setError(e.message || "Failed to load staff");
    }
  }

  useEffect(() => {
    load();
  }, []);

  const q = query.trim().toLowerCase();
  const visible = (staff || []).filter((s) => {
    const active = s.employmentStatus === CURRENTLY_EMPLOYED;
    if (employment === "ACTIVE" && !active) return false;
    if (employment === "INACTIVE" && active) return false;
    return !q || s.name.toLowerCase().includes(q) || s.role.toLowerCase().includes(q);
  });

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-black text-gray-900 dark:text-white">Staff List</h2>
        <div className="flex flex-wrap gap-2">
        <select
          value={employment}
          onChange={(e) => setEmployment(e.target.value)}
          aria-label="Employment status"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          <option value="ACTIVE">Active Staff</option>
          <option value="INACTIVE">Inactive Staff</option>
          <option value="ALL">All Staff</option>
        </select>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or role..."
          className="w-64 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        />
        </div>
      </div>
      {error ? <div className="mt-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div> : null}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-xs font-bold uppercase tracking-wide text-gray-500 dark:border-gray-700">
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Today</th>
              <th className="px-3 py-2 text-right">Time Sheet</th>
            </tr>
          </thead>
          <tbody>
            {staff === null ? (
              <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-500">Loading...</td></tr>
            ) : visible.length === 0 ? (
              <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-500">No staff found.</td></tr>
            ) : (
              visible.map((person) => (
                <tr key={person.id} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="px-3 py-2 font-semibold text-gray-900 dark:text-white">{person.name}</td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-300">
                    {person.role}
                    {person.employmentStatus !== CURRENTLY_EMPLOYED ? (
                      <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">{employmentStatusLabel(person.employmentStatus)}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    {person.clockedIn ? (
                      <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-bold text-green-700">In since {time(person.clockIn)}</span>
                    ) : person.clockOut ? (
                      <span className="text-xs text-gray-500">Out at {time(person.clockOut)}</span>
                    ) : (
                      <span className="text-xs text-gray-400">{"—"}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => setOpenId(person.id)}
                      className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-sm font-semibold text-blue-900 hover:bg-sky-100"
                      title="Employee time sheet"
                      aria-label={`Time sheet for ${person.name}`}
                    >
                      &#128339;
                    </button>
                    <button
                      type="button"
                      onClick={() => setEmploymentId(person.id)}
                      className="ml-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-bold text-gray-700 hover:bg-gray-50"
                      title="Employment status"
                      aria-label={`Employment status for ${person.name}`}
                    >
                      &#8942;
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {employmentId ? (
        <EmploymentStatusModal userId={employmentId} onClose={() => setEmploymentId(null)} onSaved={load} />
      ) : null}
      {openId ? (
        <TimeSheetModal
          kind="staff"
          subjectId={openId}
          subjects={(staff || []).map(({ id, name }) => ({ id, name }))}
          onClose={() => {
            setOpenId(null);
            load();
          }}
        />
      ) : null}
    </div>
  );
}
