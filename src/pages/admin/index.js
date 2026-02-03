import AdminLayout from "@/components/admin/AdminLayout";
import Link from "next/link";

export default function AdminHome() {
  return (
    <AdminLayout title="Overview">
      <div
        style={{
          background: "white",
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          padding: 16,
        }}
      >
        <h2 style={{ marginTop: 0 }}>Admin Console</h2>
        <p style={{ color: "#6b7280" }}>
          Full access to children, classrooms, teachers, and lesson plans.
          Override teacher activity entries (including backdating) when needed,
          manage subscriptions for external daycare users, and configure
          role-based access controls.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 12,
            marginTop: 16,
          }}
        >
          <Card
            href="/admin/users"
            title="Access Controls"
            description="Create/modify/delete users and set roles (RBAC)."
          />
          <Card
            href="/admin/invites"
            title="Invite Codes"
            description="Generate invite codes for parents and staff to join a center."
          />
          <Card
            href="/admin/teachers"
            title="Teachers"
            description="Manage teachers and assign centers/classrooms."
          />
          <Card
            href="/admin/children"
            title="Students"
            description="Student setup: create/modify/delete children."
          />
          <Card
            href="/admin/classes"
            title="Classrooms"
            description="Classroom setup: manage classrooms."
          />
          <Card
            href="/admin/lessons"
            title="Lesson Plans"
            description="Manage lessons, policies links, and training media."
          />
          <Card
            href="/admin/forms"
            title="Forms"
            description="Create form templates (enrollment/health/emergency) for parents to submit."
          />
          <Card
            href="/admin/activity-overrides"
            title="Activity Overrides"
            description="Override teacher entries; backdate activity logs when needed."
          />
          <Card
            href="/admin/subscriptions"
            title="Subscriptions"
            description="Approve/manage external daycare subscriptions."
          />
          <Card
            href="/admin/centers"
            title="Centers"
            description="Manage centers (required for classroom/student setup)."
          />
        </div>
      </div>
    </AdminLayout>
  );
}

function Card({ href, title, description }) {
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          padding: 14,
          cursor: "pointer",
          background: "white",
        }}
      >
        <div style={{ fontWeight: 700, color: "#111827" }}>{title}</div>
        <div style={{ color: "#6b7280", marginTop: 4, fontSize: 14 }}>
          {description}
        </div>
      </div>
    </Link>
  );
}
