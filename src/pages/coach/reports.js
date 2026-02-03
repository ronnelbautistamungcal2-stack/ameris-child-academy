import CoachLayout from "@/components/coach/CoachLayout";

export default function CoachReports() {
  return (
    <CoachLayout title="Reports">
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-extrabold text-gray-900">Reports & Analytics</h2>
        <p className="mt-1 text-sm text-gray-600">
          Advanced analytics (query builder, charts, behavior scoring) are not implemented in the backend yet.
        </p>
      </div>
    </CoachLayout>
  );
}

