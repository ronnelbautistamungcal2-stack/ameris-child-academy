import StudentPerformanceReport from "@/components/teacher/StudentPerformanceReport";
import TeacherLayout from "@/components/teacher/TeacherLayout";

export default function TeacherStudentPerformanceReportPage() {
  return (
    <TeacherLayout title="Student Performance Report">
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
        <StudentPerformanceReport />
      </div>
    </TeacherLayout>
  );
}
