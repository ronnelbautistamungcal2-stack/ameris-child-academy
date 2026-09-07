import AdminComingSoon from "@/components/admin/AdminComingSoon";

export default function AdminBilling() {
  return (
    <AdminComingSoon
      icon="💳"
      title="Billing"
      description="Family invoicing, payments, and tuition tracking."
      planned={[
        "Confirm what billing covers: tuition, fees, subsidies, or all three",
        "Decide whether payments are processed here or tracked from an outside system",
        "Confirm how this relates to the existing Subscriptions page",
      ]}
    />
  );
}
