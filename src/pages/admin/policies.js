import AdminLayout from "@/components/admin/AdminLayout";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

const ROLES = ["ADMIN", "TEACHER", "PARENT", "COACH", "SUBSCRIBER"];

export default function AdminPolicies() {
  const [docs, setDocs] = useState([]);
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [centerId, setCenterId] = useState("");
  const [roles, setRoles] = useState(["TEACHER"]);
  const [saving, setSaving] = useState(false);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const [p, c] = await Promise.all([
        apiJson("/api/v1/policies"),
        apiJson("/api/v1/centers"),
      ]);
      setDocs(Array.isArray(p) ? p : []);
      setCenters(Array.isArray(c) ? c : []);
    } catch (e) {
      setError(e.message || "Failed to load policies");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const sorted = useMemo(() => {
    return [...docs].sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  }, [docs]);

  function toggleRole(r) {
    setRoles((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));
  }

  async function create(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await apiJson("/api/v1/policies", {
        method: "POST",
        body: JSON.stringify({
          title,
          description: description || null,
          url,
          roles,
          centerId: centerId || null,
        }),
      });
      setTitle("");
      setDescription("");
      setUrl("");
      setCenterId("");
      setRoles(["TEACHER"]);
      setSuccess("Policy published.");
      await refresh();
    } catch (e2) {
      setError(e2.message || "Failed to publish policy");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminLayout title="Policies">
      <Panel>
        <h2 style={{ marginTop: 0 }}>Policies & Procedures</h2>
        <p style={{ color: "#6b7280", marginTop: 6 }}>
          Publish role-based policy documents (URLs to PDFs/pages). Use the Upload API to store files first if needed.
        </p>

        {error ? <Banner kind="error" message={error} /> : null}
        {success ? <Banner kind="success" message={success} /> : null}

        <form onSubmit={create} style={{ marginTop: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Title">
              <input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} required />
            </Field>
            <Field label="URL (PDF or page)">
              <input value={url} onChange={(e) => setUrl(e.target.value)} style={inputStyle} required />
            </Field>
          </div>
          <div style={{ marginTop: 10 }}>
            <Field label="Description (optional)">
              <input value={description} onChange={(e) => setDescription(e.target.value)} style={inputStyle} />
            </Field>
          </div>
          <div style={{ marginTop: 10 }}>
            <Field label="Center (optional)">
              <select value={centerId} onChange={(e) => setCenterId(e.target.value)} style={inputStyle}>
                <option value="">(all centers)</option>
                {centers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>Roles</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => toggleRole(r)}
                  style={chip(roles.includes(r))}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <button type="submit" disabled={saving || roles.length === 0} style={primaryButton}>
              {saving ? "Publishing…" : "Publish"}
            </button>
          </div>
        </form>

        <div style={{ marginTop: 16 }}>
          <h3 style={{ margin: "0 0 8px 0" }}>Published</h3>
          {loading ? (
            <p>Loading…</p>
          ) : sorted.length === 0 ? (
            <p style={{ color: "#6b7280" }}>No policies published yet.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
              {sorted.map((d) => (
                <div key={d.id} style={cardStyle}>
                  <div style={{ fontWeight: 800 }}>{d.title}</div>
                  <div style={{ color: "#6b7280", marginTop: 4, fontSize: 13 }}>
                    {d.description || "—"}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <a href={d.url} target="_blank" rel="noreferrer" style={{ color: "#2563eb" }}>
                      Open
                    </a>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
                    Roles: {(d.roles || []).join(", ")} · Center: {d.centerId || "all"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Panel>
    </AdminLayout>
  );
}

function Panel({ children }) {
  return (
    <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 10, padding: 16 }}>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>{label}</div>
      {children}
    </label>
  );
}

function Banner({ message, kind }) {
  const style =
    kind === "success"
      ? { background: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0" }
      : { background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca" };
  return <div style={{ padding: 12, borderRadius: 8, marginTop: 12, ...style }}>{message}</div>;
}

const inputStyle = {
  width: "100%",
  padding: 10,
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  boxSizing: "border-box",
};

function chip(active) {
  return {
    padding: "8px 10px",
    borderRadius: 999,
    border: active ? "1px solid #bfdbfe" : "1px solid #e5e7eb",
    background: active ? "#eff6ff" : "white",
    cursor: "pointer",
    fontWeight: 800,
    color: "#111827",
  };
}

const primaryButton = {
  padding: "10px 12px",
  background: "#2563eb",
  color: "white",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 800,
};

const cardStyle = {
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: 14,
};

