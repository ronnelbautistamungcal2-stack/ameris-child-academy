import ParentLayout from "@/components/parent/ParentLayout";

export default function ParentBilling() {
  return (
    <ParentLayout title="Billing">
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-extrabold text-gray-900">Billing</h2>
        <p className="mt-1 text-sm text-gray-600">
          Billing/payment workflows and auto-suspension are not implemented in the current backend yet.
        </p>
      </div>
    </ParentLayout>
  );
}

