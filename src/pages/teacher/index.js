import Link from "next/link";
import TeacherLayout from "@/components/teacher/TeacherLayout";
import { useSession } from "next-auth/react";

export default function TeacherHome() {
  const { data: session } = useSession();

  return (
    <TeacherLayout title="Overview">
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-extrabold">Teacher Console</h2>
        <p className="mt-1 text-sm text-gray-600">
          Daily activity logging (no backdating), lesson plans/training media,
          checklists, and reports.
        </p>

        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm">
          <div className="font-semibold text-gray-900">Signed in as</div>
          <div className="mt-1 text-gray-700">
            {session?.user?.email}{" "}
            <span className="text-gray-500">({session?.user?.role})</span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Card
            href="/teacher/logs"
            title="Daily Activity Logging"
            description="Log activities for children (no backdating)."
          />
          <Card
            href="/teacher/children"
            title="Children"
            description="View children in your assigned centers."
          />
          <Card
            href="/teacher/lessons"
            title="Lessons & Training Media"
            description="Access lesson plans and linked media."
          />
          <Card
            href="/teacher/checklists"
            title="Daily/Weekly Checklists"
            description="Review tasks, policies and training links."
          />
          <Card
            href="/teacher/metrics"
            title="Metrics & Reports"
            description="View basic performance metrics and reports."
          />
          <Card
            href="/teacher/policies"
            title="Policies & Handbook"
            description="Policies and procedures handbook."
          />
        </div>
      </div>
    </TeacherLayout>
  );
}

function Card({ href, title, description }) {
  return (
    <Link
      href={href}
      className="block rounded-xl border border-gray-200 bg-white p-4 hover:bg-gray-50"
    >
      <div className="font-extrabold text-gray-900">{title}</div>
      <div className="mt-1 text-sm text-gray-600">{description}</div>
    </Link>
  );
}

