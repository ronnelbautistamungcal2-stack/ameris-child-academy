import AdminComingSoon from "@/components/admin/AdminComingSoon";

export default function AdminCharacterGuide() {
  return (
    <AdminComingSoon
      icon="🌟"
      title="Character Guide"
      description="Center-wide character traits and the guidance staff use to teach them."
      planned={[
        "Define the character traits covered across the program year",
        "Attach teaching guidance and classroom activities to each trait",
        "Decide which roles can view versus edit the guide",
      ]}
    />
  );
}
