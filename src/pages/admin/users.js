import AdminLayout from "@/components/admin/AdminLayout";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import { hasEmployeeRole, ROLE_OPTIONS, userRoles } from "@/lib/roles";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const ROLES = ROLE_OPTIONS;

const ROLE_CONFIG = {
  ADMIN: { color: "#7c3aed", bg: "#f5f3ff", darkBg: "rgba(124,58,237,0.18)", label: "Admin", icon: "shield" },
  TEACHER: { color: "#2563eb", bg: "#eff6ff", darkBg: "rgba(37,99,235,0.18)", label: "Teacher", icon: "book" },
  OTHER_STAFF: { color: "#0891b2", bg: "#ecfeff", darkBg: "rgba(8,145,178,0.18)", label: "Other Staff", icon: "briefcase" },
  PARENT: { color: "#059669", bg: "#ecfdf5", darkBg: "rgba(5,150,105,0.18)", label: "Parent", icon: "heart" },
  COACH: { color: "#d97706", bg: "#fffbeb", darkBg: "rgba(217,119,6,0.18)", label: "Coach", icon: "star" },
  SUBSCRIBER: { color: "#6b7280", bg: "#f9fafb", darkBg: "rgba(107,114,128,0.18)", label: "Subscriber", icon: "user" },
};

const PAGE_SIZE = 15;

const DAY_OPTIONS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

function emptyScheduleBlock() {
  return { daysOfWeek: [], startTime: "08:00", endTime: "16:00" };
}

function normalizeWeeklySchedules(user) {
  const schedules = Array.isArray(user?.weeklySchedules) ? user.weeklySchedules : [];
  return schedules.map((s) => ({
    daysOfWeek: Array.isArray(s.daysOfWeek) ? [...s.daysOfWeek] : [],
    startTime: s.startTime || "08:00",
    endTime: s.endTime || "16:00",
  }));
}

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roles, setRoles] = useState(["PARENT"]);
  const [centerId, setCenterId] = useState("");
  const [dob, setDob] = useState("");
  const [hireDate, setHireDate] = useState("");
  const [aboutMe, setAboutMe] = useState("");
  const [pictureUrl, setPictureUrl] = useState("");
  const [weeklySchedules, setWeeklySchedules] = useState([]);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  async function refresh() {
    setError("");
    setLoading(true);
    try {
      const [u, c] = await Promise.all([
        apiJson("/api/v1/users"),
        apiJson("/api/v1/centers"),
      ]);
      setUsers(Array.isArray(u) ? u : []);
      setCenters(Array.isArray(c) ? c : []);
    } catch (e) {
      setError(e.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  // Auto-dismiss success messages
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(""), 3000);
    return () => clearTimeout(t);
  }, [success]);

  const [roleTab, setRoleTab] = useState("ALL");

  const sorted = useMemo(() => {
    let filtered = roleTab === "ALL" ? users : users.filter((u) => userRoles(u).includes(roleTab));
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (u) =>
          (u.email || "").toLowerCase().includes(q) ||
          (u.name || "").toLowerCase().includes(q),
      );
    }
    return [...filtered].sort((a, b) =>
      (a.name || a.email || "").localeCompare(b.name || b.email || ""),
    );
  }, [users, roleTab, search]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paged = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [roleTab, search]);

  const roleCounts = useMemo(() => {
    const counts = { ALL: users.length };
    for (const u of users) {
      for (const r of userRoles(u)) {
        counts[r] = (counts[r] || 0) + 1;
      }
    }
    return counts;
  }, [users]);

  const employeeProfileNeeded = useMemo(() => hasEmployeeRole(roles), [roles]);

  const validScheduleBlocks = useMemo(
    () => weeklySchedules.filter((b) => b.daysOfWeek.length > 0 && b.startTime && b.endTime),
    [weeklySchedules],
  );

  function toggleRole(roleKey, checked) {
    setRoles((current) => {
      const existing = Array.isArray(current) ? current : [];
      const next = checked
        ? [...existing, roleKey]
        : existing.filter((r) => r !== roleKey);
      return next.length ? next : ["PARENT"];
    });
  }

  const resetForm = useCallback(() => {
    setEditing(null);
    setName("");
    setEmail("");
    setPassword("");
    setRoles(["PARENT"]);
    setCenterId("");
    setDob("");
    setHireDate("");
    setAboutMe("");
    setPictureUrl("");
    setWeeklySchedules([]);
  }, []);

  const startEdit = useCallback((user) => {
    setEditing(user);
    setName(user.name || "");
    setEmail(user.email || "");
    setRoles(userRoles(user));
    setPassword("");
    setCenterId("");
    setDob(user.dob ? String(user.dob).slice(0, 10) : "");
    setHireDate(user.hireDate ? String(user.hireDate).slice(0, 10) : "");
    setAboutMe(user.aboutMe || "");
    setPictureUrl(user.pictureUrl || "");
    setWeeklySchedules(normalizeWeeklySchedules(user));
  }, []);

  function addScheduleBlock() {
    setWeeklySchedules((current) => [...current, emptyScheduleBlock()]);
  }

  function removeScheduleBlock(index) {
    setWeeklySchedules((current) => current.filter((_, i) => i !== index));
  }

  function toggleScheduleDay(index, day) {
    setWeeklySchedules((current) =>
      current.map((block, i) => {
        if (i !== index) return block;
        const has = block.daysOfWeek.includes(day);
        return {
          ...block,
          daysOfWeek: has ? block.daysOfWeek.filter((d) => d !== day) : [...block.daysOfWeek, day],
        };
      }),
    );
  }

  function updateScheduleTime(index, field, value) {
    setWeeklySchedules((current) =>
      current.map((block, i) => (i === index ? { ...block, [field]: value } : block)),
    );
  }

  const openCreate = useCallback(() => {
    setError("");
    resetForm();
    setModalOpen(true);
  }, [resetForm]);

  const openEdit = useCallback(
    (user) => {
      setError("");
      startEdit(user);
      setModalOpen(true);
    },
    [startEdit],
  );

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setError("");
    resetForm();
  }, [resetForm]);

  useEffect(() => {
    if (!modalOpen) return;

    const prevOverflow = document?.body?.style?.overflow || "";
    document.body.style.overflow = "hidden";

    function onKeyDown(e) {
      if (e.key === "Escape") closeModal();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [modalOpen, closeModal]);

  async function createUser(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await apiJson("/api/v1/users", {
        method: "POST",
        body: JSON.stringify({
          email,
          name: name || null,
          password,
          roles,
          centerId: centerId || undefined,
          dob: employeeProfileNeeded ? dob || null : null,
          hireDate: employeeProfileNeeded ? hireDate || null : null,
          aboutMe: employeeProfileNeeded ? aboutMe || null : null,
          pictureUrl: employeeProfileNeeded ? pictureUrl || null : null,
          weeklySchedules: employeeProfileNeeded ? validScheduleBlocks : [],
        }),
      });
      resetForm();
      setModalOpen(false);
      setSuccess("User created successfully");
      await refresh();
    } catch (e2) {
      setError(e2.message || "Failed to create user");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editing) return;
    setError("");
    setSaving(true);
    try {
      await apiJson(`/api/v1/users/${editing.id}`, {
        method: "PUT",
        body: JSON.stringify({
          email,
          name: name || null,
          roles,
          password: password || undefined,
          dob: employeeProfileNeeded ? dob || null : null,
          hireDate: employeeProfileNeeded ? hireDate || null : null,
          aboutMe: employeeProfileNeeded ? aboutMe || null : null,
          pictureUrl: employeeProfileNeeded ? pictureUrl || null : null,
          weeklySchedules: employeeProfileNeeded ? validScheduleBlocks : [],
        }),
      });
      resetForm();
      setModalOpen(false);
      setSuccess("User updated successfully");
      await refresh();
    } catch (e2) {
      setError(e2.message || "Failed to update user");
    } finally {
      setSaving(false);
    }
  }

  async function deleteUser(id) {
    if (!confirm("Delete this user? This cannot be undone.")) return;
    setError("");
    try {
      await apiJson(`/api/v1/users/${id}`, { method: "DELETE" });
      setSuccess("User deleted");
      await refresh();
    } catch (e2) {
      setError(e2.message || "Failed to delete user");
    }
  }

  return (
    <AdminLayout title="Users & Roles">
      {/* Success toast */}
      {success && (
        <div style={toastStyle}>
          <span style={{ marginRight: 8, fontSize: 16 }}>&#10003;</span>
          {success}
        </div>
      )}

      {/* Stats cards */}
      <div style={statsGrid}>
        <StatCard label="Total Users" value={users.length} color="#2563eb" icon={IconUsers} />
        <StatCard label="Teachers" value={roleCounts.TEACHER || 0} color="#2563eb" icon={IconBook} />
        <StatCard label="Parents" value={roleCounts.PARENT || 0} color="#059669" icon={IconHeart} />
        <StatCard label="Staff" value={(roleCounts.ADMIN || 0) + (roleCounts.COACH || 0) + (roleCounts.OTHER_STAFF || 0)} color="#7c3aed" icon={IconShield} />
      </div>

      <Panel>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ marginTop: 0, marginBottom: 4, fontSize: 18, fontWeight: 800 }}>Users & Role-Based Access</h2>
            <p style={{ color: "var(--admin-text-muted)", marginTop: 0, fontSize: 13 }}>
              Manage user accounts, roles, and permissions.
            </p>
          </div>
          <button type="button" style={primaryButton} onClick={openCreate}>
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Add User
          </button>
        </div>

        {/* Search bar */}
        <div style={{ marginTop: 16, position: "relative" }}>
          <div style={searchIconWrap}>
            <SearchIcon />
          </div>
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={searchInputStyle}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              style={searchClearBtn}
              title="Clear search"
            >
              &#215;
            </button>
          )}
        </div>

        {error && !modalOpen ? <ErrorBanner message={error} /> : null}

        {modalOpen ? (
          <Modal
            title={editing ? "Edit User" : "New User"}
            onClose={closeModal}
          >
            {error ? <ErrorBanner message={error} /> : null}
            <form onSubmit={editing ? saveEdit : createUser}>
              {/* Section: Roles */}
              <FormSection title="Select Role First">
                <Field label="Roles">
                  <div style={rolePickerStyle}>
                    {ROLES.map((r) => {
                      const checked = roles.includes(r);
                      return (
                        <label key={r} style={{ ...roleCheckStyle, ...(checked ? roleCheckActiveStyle : {}) }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => toggleRole(r, e.target.checked)}
                          />
                          <span>{ROLE_CONFIG[r]?.label || r}</span>
                        </label>
                      );
                    })}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 11, color: "var(--admin-text-muted)" }}>
                    Users with more than one role can switch roles from the app header.
                  </div>
                </Field>
              </FormSection>

              {/* Section: Account */}
              <FormSection title="Account Information">
                <div style={formGrid}>
                  <Field label="Full Name">
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      style={inputStyle}
                      placeholder="e.g. Jane Doe"
                    />
                  </Field>
                  <Field label="Email Address">
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      style={inputStyle}
                      required
                      placeholder="e.g. jane@example.com"
                      type="email"
                    />
                  </Field>
                  <Field label={editing ? "New Password (leave blank to keep)" : "Password"}>
                    <input
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      style={inputStyle}
                      type="password"
                      required={!editing}
                      minLength={editing ? undefined : 8}
                      placeholder={editing ? "••••••••" : "Min 8 characters"}
                    />
                  </Field>
                </div>
              </FormSection>

              {/* Section: Profile */}
              {employeeProfileNeeded ? (
              <FormSection title="Employee Profile Details">
                <div style={formGrid}>
                  <Field label="Date of Birth">
                    <input
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      style={inputStyle}
                      type="date"
                    />
                  </Field>
                  <Field label="Date of Hire">
                    <input
                      value={hireDate}
                      onChange={(e) => setHireDate(e.target.value)}
                      style={inputStyle}
                      type="date"
                    />
                  </Field>
                  <Field label="Profile Picture">
                    <PictureUpload value={pictureUrl} onChange={setPictureUrl} />
                  </Field>
                </div>
                <div style={{ marginTop: 12 }}>
                  <Field label="About Me">
                    <textarea
                      value={aboutMe}
                      onChange={(e) => setAboutMe(e.target.value)}
                      style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
                      placeholder="A short bio..."
                    />
                  </Field>
                </div>
              </FormSection>
              ) : null}

              {employeeProfileNeeded ? (
              <FormSection title="Weekly Schedule">
                <div style={{ marginBottom: 10, fontSize: 12, color: "var(--admin-text-muted)" }}>
                  Set the days and hours this person typically works. This will automatically populate the weekly Shift Schedule, and can still be adjusted there.
                </div>
                {weeklySchedules.length === 0 ? (
                  <div style={helperBoxStyle}>No weekly schedule set yet.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {weeklySchedules.map((block, index) => (
                      <div key={index} style={scheduleBlockStyle}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                          {DAY_OPTIONS.map((d) => {
                            const active = block.daysOfWeek.includes(d.value);
                            return (
                              <button
                                key={d.value}
                                type="button"
                                onClick={() => toggleScheduleDay(index, d.value)}
                                style={active ? dayPillActiveStyle : dayPillStyle}
                              >
                                {d.label}
                              </button>
                            );
                          })}
                        </div>
                        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
                          <Field label="Start Time">
                            <input
                              type="time"
                              value={block.startTime}
                              onChange={(e) => updateScheduleTime(index, "startTime", e.target.value)}
                              style={inputStyle}
                            />
                          </Field>
                          <Field label="End Time">
                            <input
                              type="time"
                              value={block.endTime}
                              onChange={(e) => updateScheduleTime(index, "endTime", e.target.value)}
                              style={inputStyle}
                            />
                          </Field>
                          <button
                            type="button"
                            onClick={() => removeScheduleBlock(index)}
                            style={{ ...secondaryButton, color: "#ef4444", borderColor: "#fecaca" }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <button type="button" onClick={addScheduleBlock} style={{ ...secondaryButton, marginTop: 10 }}>
                  + Add another schedule
                </button>
              </FormSection>
              ) : (
                <FormSection title="Parent Profile">
                  <div style={helperBoxStyle}>
                    Parent-only users only need account and assignment details. Employee profile fields are hidden unless an employee role is selected.
                  </div>
                </FormSection>
              )}

              {/* Section: Access */}
              <FormSection title="Center Assignment">
                <div style={formGrid}>
                  <Field label={editing ? "Assign Center (create only)" : "Assign Center"}>
                    <select
                      value={centerId}
                      onChange={(e) => setCenterId(e.target.value)}
                      style={inputStyle}
                      disabled={!!editing}
                    >
                      <option value="">(none)</option>
                      {centers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </FormSection>

              {/* Actions */}
              <div style={modalActions}>
                <button type="button" style={secondaryButton} onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" style={primaryButton} disabled={saving}>
                  {saving ? "Saving..." : editing ? "Save Changes" : "Create User"}
                </button>
              </div>
            </form>
          </Modal>
        ) : null}

        {/* Tabs */}
        <div style={{ marginTop: 16 }}>
          <div style={tabBarStyle}>
            {[
              { key: "ALL", label: "All" },
              { key: "TEACHER", label: "Teachers" },
              { key: "OTHER_STAFF", label: "Other Staff" },
              { key: "PARENT", label: "Parents" },
              { key: "ADMIN", label: "Admins" },
              { key: "COACH", label: "Coaches" },
              { key: "SUBSCRIBER", label: "Subscribers" },
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setRoleTab(t.key)}
                style={roleTab === t.key ? activeTabStyle : inactiveTabStyle}
              >
                {t.label}
                {roleCounts[t.key] ? (
                  <span
                    style={{
                      ...tabCountStyle,
                      ...(roleTab === t.key ? tabCountActiveStyle : {}),
                    }}
                  >
                    {roleCounts[t.key]}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          {loading ? (
            <SkeletonTable rows={5} cols={4} />
          ) : sorted.length === 0 ? (
            <EmptyState search={search} roleTab={roleTab} onClear={() => { setSearch(""); setRoleTab("ALL"); }} />
          ) : (
            <>
              <div style={{ overflowX: "auto" }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>User</th>
                      <th style={thStyle}>Role</th>
                      <th style={{ ...thStyle, display: "none", "@media(minWidth:768px)": { display: "table-cell" } }}>Joined</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((u) => (
                      <UserRow
                        key={u.id}
                        user={u}
                        onEdit={() => openEdit(u)}
                        onDelete={() => deleteUser(u.id)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={paginationWrap}>
                  <span style={{ fontSize: 13, color: "var(--admin-text-muted)" }}>
                    Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sorted.length)} of {sorted.length}
                  </span>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button
                      type="button"
                      style={pageBtn}
                      disabled={page === 0}
                      onClick={() => setPage(page - 1)}
                    >
                      &#8592; Prev
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => (
                      <button
                        key={i}
                        type="button"
                        style={i === page ? pageBtnActive : pageBtn}
                        onClick={() => setPage(i)}
                      >
                        {i + 1}
                      </button>
                    ))}
                    <button
                      type="button"
                      style={pageBtn}
                      disabled={page >= totalPages - 1}
                      onClick={() => setPage(page + 1)}
                    >
                      Next &#8594;
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </Panel>
    </AdminLayout>
  );
}

/* ── Sub-components ── */

function UserRow({ user, onEdit, onDelete }) {
  const [hovered, setHovered] = useState(false);
  const roles = userRoles(user);
  const primaryRole = roles[0] || user.role || "SUBSCRIBER";
  const rc = ROLE_CONFIG[primaryRole] || ROLE_CONFIG.SUBSCRIBER;
  const initials = getInitials(user.name || user.email);

  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        transition: "background 0.15s",
        background: hovered ? "var(--admin-bg-secondary)" : "transparent",
      }}
    >
      <td style={tdStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {user.pictureUrl ? (
            <img
              src={user.pictureUrl}
              alt=""
              style={avatarStyle}
            />
          ) : (
            <div
              style={{
                ...avatarStyle,
                background: rc.bg,
                color: rc.color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              {initials}
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {roles.includes("TEACHER") ? (
                <Link href={`/admin/teachers/${encodeURIComponent(user.id)}`} style={teacherLink}>
                  {user.name || "Unnamed"}
                </Link>
              ) : (
                user.name || "Unnamed"
              )}
            </div>
            <div style={{ fontSize: 12, color: "var(--admin-text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {user.email}
            </div>
          </div>
        </div>
      </td>
      <td style={tdStyle}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {roles.map((role) => {
            const roleConfig = ROLE_CONFIG[role] || ROLE_CONFIG.SUBSCRIBER;
            return (
              <span
                key={role}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "3px 10px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 700,
                  color: roleConfig.color,
                  background: roleConfig.bg,
                  border: `1px solid ${roleConfig.color}22`,
                  whiteSpace: "nowrap",
                }}
              >
                {roleConfig.label}
              </span>
            );
          })}
        </div>
      </td>
      <td style={{ ...tdStyle, fontSize: 13, color: "var(--admin-text-muted)" }}>
        {user.createdAt ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
      </td>
      <td style={{ ...tdStyle, textAlign: "right" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
          <button
            type="button"
            style={iconButton}
            onClick={onEdit}
            title="Edit user"
          >
            <EditIcon />
          </button>
          <button
            type="button"
            style={iconButtonDanger}
            onClick={onDelete}
            title="Delete user"
          >
            <TrashIcon />
          </button>
        </div>
      </td>
    </tr>
  );
}

function StatCard({ label, value, color, icon: Icon }) {
  return (
    <div style={statCardStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: `${color}14`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon color={color} />
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.1, color: "var(--admin-text)" }}>{value}</div>
          <div style={{ fontSize: 12, color: "var(--admin-text-muted)", marginTop: 2 }}>{label}</div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ search, roleTab, onClear }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 16px" }}>
      <div style={{ fontSize: 40, marginBottom: 8, opacity: 0.3 }}>&#128100;</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--admin-text)", marginBottom: 4 }}>
        {search ? "No users match your search" : "No users found"}
      </div>
      <div style={{ fontSize: 13, color: "var(--admin-text-muted)", marginBottom: 16 }}>
        {search
          ? `Try a different search term or clear filters.`
          : roleTab !== "ALL"
            ? "No users with this role yet."
            : "Get started by adding your first user."}
      </div>
      {(search || roleTab !== "ALL") && (
        <button type="button" style={secondaryButton} onClick={onClear}>
          Clear Filters
        </button>
      )}
    </div>
  );
}

function Panel({ children }) {
  return (
    <div
      style={{
        background: "var(--admin-bg)",
        border: "1px solid var(--admin-border)",
        borderRadius: 12,
        padding: 20,
        marginTop: 16,
      }}
    >
      {children}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={modalOverlayStyle}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={modalCardStyle}>
        <div style={modalHeader}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{title}</div>
          <button
            type="button"
            onClick={onClose}
            style={modalCloseBtn}
            title="Close"
          >
            &#215;
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FormSection({ title, children }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--admin-text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 13, color: "var(--admin-text-secondary)", marginBottom: 6, fontWeight: 600 }}>
        {label}
      </div>
      {children}
    </label>
  );
}

function ErrorBanner({ message }) {
  return (
    <div
      style={{
        padding: 12,
        background: "var(--admin-error-bg)",
        color: "var(--admin-error-text)",
        borderRadius: 8,
        marginTop: 12,
        border: "1px solid var(--admin-error-border)",
        fontSize: 13,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span style={{ fontSize: 16 }}>&#9888;</span>
      {message}
    </div>
  );
}

function PictureUpload({ value, onChange }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("File too large. Max 5MB.");
      return;
    }
    setUploading(true);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await apiJson("/api/v1/upload", {
        method: "POST",
        body: JSON.stringify({ file: base64, fileName: file.name }),
      });
      onChange(res.url);
    } catch (e) {
      alert(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? "#2563eb" : "var(--admin-border)"}`,
          borderRadius: 10,
          padding: 12,
          textAlign: "center",
          cursor: "pointer",
          background: dragOver ? "#eff6ff" : "var(--admin-bg-secondary)",
          transition: "all 0.15s",
          position: "relative",
        }}
      >
        {value ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img
              src={value}
              alt="Profile"
              style={{
                width: 48,
                height: 48,
                borderRadius: 10,
                objectFit: "cover",
                border: "1px solid var(--admin-border)",
              }}
            />
            <div style={{ flex: 1, textAlign: "left" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--admin-text)" }}>
                Photo uploaded
              </div>
              <div style={{ fontSize: 11, color: "var(--admin-text-muted)", marginTop: 2 }}>
                Click or drag to replace
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(""); }}
              style={{
                background: "transparent",
                color: "#ef4444",
                border: "1px solid #fca5a5",
                borderRadius: 6,
                padding: "4px 10px",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Remove
            </button>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 20, color: "var(--admin-text-muted)" }}>
              {uploading ? "..." : "\u2191"}
            </div>
            <div style={{ fontSize: 12, color: "var(--admin-text-muted)", marginTop: 4 }}>
              {uploading ? "Uploading..." : "Click or drag photo"}
            </div>
            <div style={{ fontSize: 10, color: "var(--admin-text-faint)", marginTop: 2 }}>
              JPG, PNG — max 5MB
            </div>
          </div>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}

/* ── Icons ── */

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

function IconUsers({ color }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconBook({ color }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
    </svg>
  );
}

function IconHeart({ color }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  );
}

function IconShield({ color }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
    </svg>
  );
}

/* ── Helpers ── */

function getInitials(str) {
  if (!str) return "?";
  const parts = str.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return str.slice(0, 2).toUpperCase();
}

/* ── Styles ── */

const inputStyle = {
  width: "100%",
  padding: "9px 12px",
  border: "1px solid var(--admin-border)",
  borderRadius: 8,
  boxSizing: "border-box",
  fontSize: 14,
  background: "var(--admin-bg)",
  color: "var(--admin-text)",
  transition: "border-color 0.15s",
  outline: "none",
};

const formGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const rolePickerStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
  gap: 8,
};

const roleCheckStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "9px 10px",
  border: "1px solid var(--admin-border)",
  borderRadius: 8,
  background: "var(--admin-bg-secondary)",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

const roleCheckActiveStyle = {
  borderColor: "#2563eb",
  background: "#eff6ff",
  color: "#1d4ed8",
};

const scheduleBlockStyle = {
  border: "1px solid var(--admin-border)",
  borderRadius: 10,
  background: "var(--admin-bg-secondary)",
  padding: 12,
};

const dayPillStyle = {
  padding: "6px 12px",
  borderRadius: 999,
  border: "1px solid var(--admin-border)",
  background: "var(--admin-bg)",
  color: "var(--admin-text-secondary)",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const dayPillActiveStyle = {
  ...dayPillStyle,
  borderColor: "#2563eb",
  background: "#2563eb",
  color: "white",
};

const helperBoxStyle = {
  border: "1px solid var(--admin-border)",
  borderRadius: 8,
  background: "var(--admin-bg-secondary)",
  color: "var(--admin-text-muted)",
  padding: 12,
  fontSize: 13,
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
};

const thStyle = {
  textAlign: "left",
  fontSize: 11,
  fontWeight: 700,
  color: "var(--admin-text-muted)",
  padding: "10px 12px",
  borderBottom: "2px solid var(--admin-border)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const tdStyle = {
  padding: "10px 12px",
  borderBottom: "1px solid var(--admin-border-light)",
  verticalAlign: "middle",
};

const avatarStyle = {
  width: 36,
  height: 36,
  borderRadius: 10,
  objectFit: "cover",
  flexShrink: 0,
};

const modalOverlayStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 80,
  background: "var(--admin-modal-overlay)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  animation: "overlayIn 0.15s ease-out",
};

const modalCardStyle = {
  width: "min(640px, 100%)",
  maxHeight: "min(88vh, 900px)",
  overflow: "auto",
  background: "var(--admin-bg)",
  border: "1px solid var(--admin-border)",
  borderRadius: 14,
  padding: 24,
  boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
  animation: "modalIn 0.2s ease-out",
};

const modalHeader = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  paddingBottom: 16,
  borderBottom: "1px solid var(--admin-border)",
};

const modalCloseBtn = {
  width: 32,
  height: 32,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 20,
  background: "var(--admin-bg-secondary)",
  color: "var(--admin-text-muted)",
  border: "1px solid var(--admin-border)",
  borderRadius: 8,
  cursor: "pointer",
  lineHeight: 1,
};

const modalActions = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  marginTop: 20,
  paddingTop: 16,
  borderTop: "1px solid var(--admin-border)",
};

const primaryButton = {
  padding: "10px 18px",
  background: "linear-gradient(135deg, #1e3a8a, #0284c7)",
  color: "white",
  border: "none",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 13,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  transition: "background 0.15s",
};

const secondaryButton = {
  padding: "9px 18px",
  background: "var(--admin-bg)",
  color: "var(--admin-text)",
  border: "1px solid var(--admin-border)",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13,
};

const iconButton = {
  width: 32,
  height: 32,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--admin-bg)",
  color: "var(--admin-text-muted)",
  border: "1px solid var(--admin-border)",
  borderRadius: 8,
  cursor: "pointer",
  transition: "all 0.15s",
};

const iconButtonDanger = {
  ...iconButton,
  color: "#ef4444",
  borderColor: "#fecaca",
};

const teacherLink = {
  color: "var(--admin-accent-text)",
  fontWeight: 600,
  textDecoration: "none",
};

const tabBarStyle = {
  display: "flex",
  gap: 0,
  borderBottom: "2px solid var(--admin-border)",
  marginBottom: 16,
  overflowX: "auto",
};

const activeTabStyle = {
  padding: "10px 16px",
  fontSize: 13,
  fontWeight: 700,
  color: "#2563eb",
  background: "none",
  border: "none",
  borderBottom: "2px solid #2563eb",
  marginBottom: -2,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: 6,
  whiteSpace: "nowrap",
};

const inactiveTabStyle = {
  padding: "10px 16px",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--admin-text-muted)",
  background: "none",
  border: "none",
  borderBottom: "2px solid transparent",
  marginBottom: -2,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: 6,
  whiteSpace: "nowrap",
};

const tabCountStyle = {
  background: "var(--admin-bg-tertiary)",
  color: "var(--admin-text-secondary)",
  padding: "1px 7px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 700,
};

const tabCountActiveStyle = {
  background: "#2563eb18",
  color: "#2563eb",
};

const statsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
};

const statCardStyle = {
  background: "var(--admin-bg)",
  border: "1px solid var(--admin-border)",
  borderRadius: 12,
  padding: 16,
};

const searchInputStyle = {
  width: "100%",
  padding: "10px 12px 10px 40px",
  border: "1px solid var(--admin-border)",
  borderRadius: 10,
  boxSizing: "border-box",
  fontSize: 14,
  background: "var(--admin-bg-secondary)",
  color: "var(--admin-text)",
  outline: "none",
};

const searchIconWrap = {
  position: "absolute",
  left: 12,
  top: "50%",
  transform: "translateY(-50%)",
  color: "var(--admin-text-muted)",
  pointerEvents: "none",
  display: "flex",
};

const searchClearBtn = {
  position: "absolute",
  right: 8,
  top: "50%",
  transform: "translateY(-50%)",
  width: 24,
  height: 24,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--admin-bg-tertiary)",
  color: "var(--admin-text-muted)",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 16,
  lineHeight: 1,
};

const toastStyle = {
  position: "fixed",
  bottom: 24,
  right: 24,
  zIndex: 100,
  background: "var(--admin-success-bg)",
  color: "var(--admin-success-text)",
  border: "1px solid var(--admin-success-border)",
  borderRadius: 10,
  padding: "10px 20px",
  fontSize: 13,
  fontWeight: 600,
  display: "flex",
  alignItems: "center",
  boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)",
  animation: "toastIn 0.3s ease-out",
};

const paginationWrap = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginTop: 16,
  flexWrap: "wrap",
  gap: 8,
};

const pageBtn = {
  padding: "6px 12px",
  fontSize: 13,
  fontWeight: 600,
  background: "var(--admin-bg)",
  color: "var(--admin-text-muted)",
  border: "1px solid var(--admin-border)",
  borderRadius: 6,
  cursor: "pointer",
};

const pageBtnActive = {
  ...pageBtn,
  background: "#2563eb",
  color: "white",
  borderColor: "#2563eb",
};
