import ClassPerformanceReport from "@/components/teacher/ClassPerformanceReport";
import TeacherLayout from "@/components/teacher/TeacherLayout";

export default function TeacherClassPerformanceReportPage() {
  return (
    <TeacherLayout title="Class Performance Report">
      <div className="space-y-4">
        <div className="flex items-center justify-end print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-extrabold text-gray-800 hover:bg-gray-50"
          >
            Print
          </button>
        </div>
        <ClassPerformanceReport />
      </div>
    </TeacherLayout>
  );
}
