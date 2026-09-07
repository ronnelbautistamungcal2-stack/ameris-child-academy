import AdminLayout from "@/components/admin/AdminLayout";
import { ADMIN_REPORTS } from "@/components/admin/AdminReportsWorkspace";
import Link from "next/link";

export default function AdminReportsIndex() {
  return (
    <AdminLayout title="Reports">
      <div className="space-y-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="flex items-center gap-2 text-xl font-extrabold text-gray-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-lg">
              📈
            </span>
            Reports
          </h2>
          <p className="mt-1.5 text-sm text-gray-500">
            Every report available to administrators. Pick one to set its filters and view it.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {ADMIN_REPORTS.map((report) => (
            <Link
              key={report.key}
              href={`/admin/reports/${report.key}`}
              className="group flex flex-col rounded-2xl border border-gray-200 bg-white p-5 transition hover:border-sky-300 hover:shadow-sm"
            >
              <span
                aria-hidden="true"
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-50 text-lg group-hover:bg-sky-50"
              >
                {report.icon}
              </span>
              <span className="mt-3 text-sm font-bold text-gray-900 group-hover:text-sky-800">
                {report.label}
              </span>
              <span className="mt-1 text-sm text-gray-500">{report.description}</span>
            </Link>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
