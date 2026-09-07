import AdminComingSoon from "@/components/admin/AdminComingSoon";

export default function AdminMenus() {
  return (
    <AdminComingSoon
      icon="🍽️"
      title="Menus"
      description="Meal and snack menus published to staff and families."
      planned={[
        "Decide the menu cycle (weekly, monthly, rotating)",
        "Confirm how allergies and feeding plans surface alongside the menu",
        "Decide whether parents see menus in the parent portal",
      ]}
    />
  );
}
