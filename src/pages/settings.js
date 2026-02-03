import AppShell from "@/components/shell/AppShell";
import { useRequireRole } from "@/hooks/useRequireRole";

export default function SettingsPage() {
  const { session, status, allowed } = useRequireRole(
    ["ADMIN", "TEACHER", "PARENT", "COACH", "SUBSCRIBER"],
    "/login",
  );

  if (status === "loading")
    return <div className="p-6 text-sm text-gray-600">Loading...</div>;
  if (!allowed)
    return <div className="p-6 text-sm text-gray-600">Redirecting...</div>;

  return (
    <AppShell
      title="Account Settings"
      userName={session?.user?.name || session?.user?.email}
      userLabel={session?.user?.email}
      navItems={[
        { href: "/dashboard", label: "Dashboard" },
        { href: "/settings", label: "Account Settings" },
      ]}
      showBack={false}
    >
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-extrabold text-gray-900">Account</h2>
        <p className="mt-1 text-sm text-gray-600">
          Your profile and basic account information.
        </p>

        <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <Field label="Name" value={session?.user?.name || "Not set"} />
            <Field label="Email" value={session?.user?.email || "—"} />
            <Field label="Role" value={session?.user?.role || "—"} />
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                User ID
              </div>
              <div className="mt-1 font-mono text-xs text-gray-900">
                {session?.user?.id}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 border-t border-gray-200 pt-6">
          <h3 className="text-sm font-extrabold text-red-700">Danger Zone</h3>
          <p className="mt-1 text-sm text-gray-600">
            Account deletion is not implemented yet.
          </p>
          <button
            type="button"
            className="mt-3 rounded-2xl bg-red-500 px-4 py-2 text-sm font-extrabold text-white hover:bg-red-600"
            onClick={() => alert("Delete account not implemented yet")}
          >
            Delete Account
          </button>
        </div>
      </div>
    </AppShell>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="mt-1 font-semibold text-gray-900">{value}</div>
    </div>
  );
}

