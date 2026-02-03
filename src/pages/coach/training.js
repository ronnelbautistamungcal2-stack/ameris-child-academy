import CoachLayout from "@/components/coach/CoachLayout";

export default function CoachTraining() {
  return (
    <CoachLayout title="Training">
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-extrabold text-gray-900">Training Materials</h2>
        <p className="mt-1 text-sm text-gray-600">
          Training material tracking and staff progression are not implemented in the backend yet.
        </p>
      </div>
    </CoachLayout>
  );
}

