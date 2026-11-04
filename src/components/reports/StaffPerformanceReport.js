import { ReportMessage, input, useReportCenters } from "@/components/reports/ReportSheet";
import { NAVY } from "@/components/reports/reportUi";
import TeacherSelfPerformanceReport from "@/components/teacher/TeacherSelfPerformanceReport";
import { apiJson } from "@/lib/api";
import { roleLabel, userRoles } from "@/lib/roles";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

// Staff Performance Report (client request 2026-10-29): one report for every
// staff member, teachers, coaches and other staff alike, picked on the page.
// Replaces the separate Teacher, Coach and Other Staff Performance reports.

export default function StaffPerformanceReport() {
  const router = useRouter();
  const { centers, centerId, setCenterId } = useReportCenters();
  const [staff, setStaff] = useState([]);
  const [search, setSearch] = useState("");
  const [staffId, setStaffId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!centerId) return;
    apiJson(`/api/v1/users?staffOnly=true&centerId=${encodeURIComponent(centerId)}`)
      .then((rows) => {
        const list = (Array.isArray(rows) ? rows : []).sort((a, b) => String(a.name || a.email).localeCompare(String(b.name || b.email)));
        setStaff(list);
        const wanted = typeof router.query.staffId === "string" ? router.query.staffId : typeof router.query.teacherId === "string" ? router.query.teacherId : "";
        setStaffId((cur) => (list.some((u) => u.id === cur) ? cur : list.some((u) => u.id === wanted) ? wanted : ""));
      })
      .catch((e) => setError(e.message || "Failed to load staff"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerId]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    return staff.filter((u) => !q || String(u.name || u.email).toLowerCase().includes(q) || u.id === staffId);
  }, [staff, search, staffId]);

  return (
    <div className="space-y-4">
      <div className="no-print space-y-3 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
        <h1 className={`text-2xl font-black ${NAVY}`}>Staff Performance Report</h1>
        <div className="grid gap-3 sm:grid-cols-3">
          {centers.length > 1 ? (
            <label className="block text-sm font-bold">
              Center
              <select value={centerId} onChange={(e) => setCenterId(e.target.value)} className={input}>
                {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          ) : null}
          <label className="block text-sm font-bold">
            Search Staff
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Type a name..." className={input} />
          </label>
          <label className="block text-sm font-bold">
            Staff Member
            <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className={input}>
              <option value="">{matches.length ? "Select a staff member..." : "No staff match"}</option>
              {matches.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name || u.email} · {userRoles(u).filter((r) => r !== "PARENT").map(roleLabel).join(", ")}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      {error ? <ReportMessage tone="red">{error}</ReportMessage> : null}
      {!staffId ? (
        <ReportMessage>Choose a staff member to see their performance.</ReportMessage>
      ) : (
        <TeacherSelfPerformanceReport key={staffId} centerId={centerId} centers={centers} loading={false} setCenterId={setCenterId} userId={staffId} />
      )}
    </div>
  );
}
