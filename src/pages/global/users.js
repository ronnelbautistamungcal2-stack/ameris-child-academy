import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import GlobalLayout from "@/components/global/GlobalLayout";
import { apiJson } from "@/lib/api";
import { ACTIONS, ACTION_LABELS, GLOBAL_SECTIONS } from "@/lib/globalPermissions";

// Global admin > Permissions & Users (client mockup 2026-11-06): the Ameris
// Solutions team, their roles and what each can view, add, edit and delete.
// Only Global Administrators open this page.

const card = "rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900";
const input =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100";
const button =
  "rounded-xl border border-blue-700 px-3 py-1.5 text-sm font-bold text-blue-800 hover:bg-blue-50 disabled:opacity-50 dark:border-blue-400 dark:text-blue-200 dark:hover:bg-blue-900/30";
const primary = "rounded-xl bg-blue-800 px-4 py-2 text-sm font-bold text-white hover:bg-blue-900 disabled:opacity-50";
const h2 = "font-serif text-2xl font-bold text-[#0b2a5b] dark:text-blue-100";

function AddUserDialog({ roles, onClose, onAdded }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", teamRole: "CUSTOMER_SERVICE" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Add User">
      <form
        className={`${card} w-full max-w-md space-y-3 p-5`}
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          setError("");
          try {
            onAdded(await apiJson("/api/v1/global/users", { method: "POST", body: JSON.stringify(form) }));
          } catch (err) {
            setError(err.message || "Could not add the user");
            setSaving(false);
          }
        }}
      >
        <h2 className="text-xl font-extrabold text-gray-900 dark:text-gray-100">Add User</h2>
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
          Name
          <input className={input} value={form.name} onChange={(e) => set({ name: e.target.value })} required />
        </label>
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
          Email
          <input className={input} type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} required />
        </label>
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
          Temporary Password
          <input className={input} type="password" minLength={8} autoComplete="new-password" value={form.password} onChange={(e) => set({ password: e.target.value })} required />
          <span className="text-xs font-normal text-gray-500">They choose their own password at first sign-in.</span>
        </label>
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
          Role
          <select className={input} value={form.teamRole} onChange={(e) => set({ teamRole: e.target.value })}>
            {roles.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        {error ? <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        <div className="flex justify-end gap-2">
          <button type="button" className={button} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className={primary} disabled={saving}>
            {saving ? "Adding..." : "Add User"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function GlobalUsersPage() {
  const { data: session } = useSession();
  const [data, setData] = useState(null);
  const [drafts, setDrafts] = useState({}); // id -> { teamRole, disabled, permissions, custom }
  const [selected, setSelected] = useState("");
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const d = await apiJson("/api/v1/global/users");
      setData(d);
      setDrafts({});
      setSelected((s) => s || d.users[0]?.id || "");
      setError("");
    } catch (e) {
      setError(e.message || "Could not load the team");
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const users = data?.users || [];
  const roleLabel = (v) => data?.roles.find((r) => r.value === v)?.label || v;
  const view = (u) => ({ ...u, ...(drafts[u.id] || {}) });
  const draft = (id, patch) => {
    setDrafts((d) => ({ ...d, [id]: { ...(d[id] || {}), ...patch } }));
    setNotice("");
  };
  const current = users.find((u) => u.id === selected);
  const shown = current ? view(current) : null;
  const isAdminRole = shown?.teamRole === "GLOBAL_ADMINISTRATOR";

  function setRole(u, teamRole) {
    // A new role starts from that role's rights unless the matrix was customised.
    draft(u.id, { teamRole, permissions: data.roleDefaults[teamRole], custom: false });
  }

  function toggle(section, action) {
    const perms = { ...shown.permissions };
    let list = [...(perms[section] || [])];
    if (list.includes(action)) {
      list = action === "VIEW" ? [] : list.filter((a) => a !== action);
    } else {
      list = [...new Set([...list, action, "VIEW"])];
    }
    perms[section] = ACTIONS.filter((a) => list.includes(a));
    draft(shown.id, { permissions: perms, custom: true });
  }

  async function saveAll() {
    setSaving(true);
    setError("");
    try {
      for (const [id, d] of Object.entries(drafts)) {
        const body = {};
        if (d.teamRole !== undefined) body.teamRole = d.teamRole;
        if (d.disabled !== undefined) body.disabled = d.disabled;
        if (d.custom) body.permissions = d.permissions;
        else if (d.teamRole !== undefined) body.resetPermissions = true;
        await apiJson(`/api/v1/global/users/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      }
      await load();
      setNotice("Changes saved.");
    } catch (e) {
      setError(e.message || "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <GlobalLayout title="Permissions & Users">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100">Permissions &amp; Users</h1>
        <button type="button" className={primary} onClick={saveAll} disabled={saving || !Object.keys(drafts).length}>
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
      {error ? <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {notice ? <div className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{notice}</div> : null}
      {!data ? (
        <div className={`${card} p-6`}>{error ? "" : "Loading..."}</div>
      ) : (
        <div className="space-y-5">
          <section className={card}>
            <div className="flex items-center justify-between border-b border-gray-100 p-4 dark:border-gray-800">
              <h2 className={h2}>Users</h2>
              <button type="button" className={primary} onClick={() => setAdding(true)}>
                + Add User
              </button>
            </div>
            <div className="overflow-x-auto p-2">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-xs font-bold text-gray-600 dark:text-gray-300">
                  <tr>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Role</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {users.map((raw) => {
                    const u = view(raw);
                    const self = u.id === session?.user?.id;
                    return (
                      <tr key={u.id} className="border-t border-gray-100 dark:border-gray-800">
                        <td className="px-3 py-2 font-semibold text-gray-900 dark:text-gray-100">{u.name || "—"}</td>
                        <td className="px-3 py-2">{u.email}</td>
                        <td className="px-3 py-2">
                          <select className={input} aria-label={`Role for ${u.name || u.email}`} value={u.teamRole} disabled={self} onChange={(e) => setRole(u, e.target.value)}>
                            {data.roles.map((r) => (
                              <option key={r.value} value={r.value}>
                                {r.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <select
                            className={`${input} ${u.disabled ? "bg-gray-100 text-gray-600" : "bg-green-50 text-green-800"}`}
                            aria-label={`Status for ${u.name || u.email}`}
                            value={u.disabled ? "DISABLED" : "ACTIVE"}
                            disabled={self}
                            onChange={(e) => draft(u.id, { disabled: e.target.value === "DISABLED" })}
                          >
                            <option value="ACTIVE">Active</option>
                            <option value="DISABLED">Disabled</option>
                          </select>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button type="button" className={button} onClick={() => setSelected(u.id)}>
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className={card}>
            <div className="border-b border-gray-100 p-4 dark:border-gray-800">
              <h2 className={h2}>User Permissions</h2>
            </div>
            <div className="grid gap-4 p-4 lg:grid-cols-[260px_1fr]">
              <div className="rounded-xl border border-gray-200 p-2 dark:border-gray-700">
                <h3 className="px-2 py-1 font-serif text-lg font-bold text-[#0b2a5b] dark:text-blue-100">Select a User</h3>
                <ul>
                  {users.map((u) => (
                    <li key={u.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(u.id)}
                        className={`w-full rounded-lg px-3 py-2 text-left text-sm ${selected === u.id ? "bg-blue-100 font-bold text-blue-900 dark:bg-blue-900/40 dark:text-blue-100" : "hover:bg-gray-50 dark:hover:bg-gray-800"}`}
                      >
                        {u.name || u.email}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              {shown ? (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700">
                  <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-4 py-3 font-serif text-lg font-bold text-[#0b2a5b] dark:border-gray-800 dark:text-blue-100">
                    {shown.name || shown.email} <span aria-hidden="true">|</span> Role: {roleLabel(shown.teamRole)}
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs font-bold text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                      <tr>
                        <th className="px-4 py-2 text-left">Permission</th>
                        {ACTIONS.map((a) => (
                          <th key={a} className="px-4 py-2 text-center">
                            {ACTION_LABELS[a]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {GLOBAL_SECTIONS.map((s) => (
                        <tr key={s.key} className="border-t border-gray-100 dark:border-gray-800">
                          <td className="px-4 py-1.5 text-gray-900 dark:text-gray-100">{s.label}</td>
                          {ACTIONS.map((a) => (
                            <td key={a} className="px-4 py-1.5 text-center">
                              <input
                                type="checkbox"
                                className="h-4 w-4"
                                aria-label={`${s.label}: ${ACTION_LABELS[a]}`}
                                checked={(shown.permissions[s.key] || []).includes(a)}
                                disabled={isAdminRole}
                                onChange={() => toggle(s.key, a)}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="border-t border-gray-100 px-4 py-2 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
                    {isAdminRole
                      ? "Global Administrators have every permission and manage Permissions & Users."
                      : `Changing the role resets these to the role's defaults${shown.customPermissions ? " (this user has custom permissions)" : ""}.`}
                  </p>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      )}
      {adding ? (
        <AddUserDialog
          roles={data.roles}
          onClose={() => setAdding(false)}
          onAdded={async (u) => {
            setAdding(false);
            setSelected(u.id);
            await load();
            setNotice(`${u.name} added. Give them their email and temporary password; they'll choose a new password at first sign-in.`);
          }}
        />
      ) : null}
    </GlobalLayout>
  );
}
