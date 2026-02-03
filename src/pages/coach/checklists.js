import CoachLayout from "@/components/coach/CoachLayout";

export default function CoachChecklists() {
  return (
    <CoachLayout title="Follow-ups">
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-extrabold text-gray-900">Follow-up Forms & Checklists</h2>
        <p className="mt-1 text-sm text-gray-600">
          Coach follow-up workflows are not implemented in the backend yet.
        </p>
      </div>
    </CoachLayout>
  );
}

