import AdminLayout from "@/components/admin/AdminLayout";
import { apiJson } from "@/lib/api";
import { useEffect, useState, useCallback } from "react";

const PARTNERSHIP_TYPES = ["General", "Educational", "Healthcare", "Community", "Corporate", "Government", "Other"];

export default function AffiliatesPage() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [affiliates, setAffiliates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    name: "", description: "", websiteUrl: "", contactEmail: "",
    contactPhone: "", logoUrl: "", partnershipType: "General", isActive: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const c = await apiJson("/api/v1/centers");
        const arr = Array.isArray(c) ? c : [];
        setCenters(arr);
        if (arr.length === 1) setCenterId(arr[0].id);
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  const loadAffiliates = useCallback(async () => {
    if (!centerId) return;
    try {
      const data = await apiJson(`/api/v1/affiliates?centerId=${centerId}`);
      setAffiliates(Array.isArray(data) ? data : []);
    } catch {}
  }, [centerId]);

  useEffect(() => { loadAffiliates(); }, [loadAffiliates]);

  function resetForm() {
    setForm({ name: "", description: "", websiteUrl: "", contactEmail: "", contactPhone: "", logoUrl: "", partnershipType: "General", isActive: true });
    setEditingId(null);
  }

  function startEdit(a) {
    setEditingId(a.id);
    setForm({
      name: a.name,
      description: a.description || "",
      websiteUrl: a.websiteUrl || "",
      contactEmail: a.contactEmail || "",
      contactPhone: a.contactPhone || "",
      logoUrl: a.logoUrl || "",
      partnershipType: a.partnershipType || "General",
      isActive: a.isActive,
    });
    setShowForm(true);
  }

  async function saveAffiliate(e) {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!form.name) { setError("Name is required"); return; }
    setSaving(true);
    try {
      if (editingId) {
        await apiJson(`/api/v1/affiliates/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(form),
        });
        setSuccess("Affiliate updated");
      } else {
        await apiJson("/api/v1/affiliates", {
          method: "POST",
          body: JSON.stringify({ ...form, centerId }),
        });
        setSuccess("Affiliate added");
      }
      resetForm();
      setShowForm(false);
      await loadAffiliates();
    } catch (err) {
      setError(err.message || "Failed to save affiliate");
    } finally { setSaving(false); }
  }

  async function deleteAffiliate(id) {
    if (!confirm("Delete this affiliate?")) return;
    try {
      await apiJson(`/api/v1/affiliates/${id}`, { method: "DELETE" });
      setSuccess("Affiliate deleted");
      await loadAffiliates();
    } catch (err) {
      setError(err.message || "Failed to delete affiliate");
    }
  }

  const inputStyle = { width: "100%", padding: 8, border: "1px solid var(--admin-border)", borderRadius: 8, boxSizing: "border-box", background: "var(--admin-bg)", color: "var(--admin-text)" };

  return (
    <AdminLayout title="Affiliates & Partners">
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--admin-text)" }}>Affiliates & Partners</h1>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <select value={centerId} onChange={e => setCenterId(e.target.value)}
              style={{ padding: "6px 10px", border: "1px solid var(--admin-border)", borderRadius: 8, fontSize: 13, background: "var(--admin-bg)", color: "var(--admin-text)" }}>
              <option value="">Select center…</option>
              {centers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button type="button" onClick={() => { resetForm(); setShowForm(!showForm); }}
              style={{ padding: "6px 14px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
              {showForm ? "Cancel" : "+ Add Affiliate"}
            </button>
          </div>
        </div>

        {error && <div style={{ padding: 10, background: "var(--admin-error-bg)", color: "var(--admin-error-text)", borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{error}</div>}
        {success && <div style={{ padding: 10, background: "var(--admin-success-bg)", color: "var(--admin-success-text)", borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{success}</div>}

        {/* Add/Edit form */}
        {showForm && (
          <div style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)", borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>{editingId ? "Edit Affiliate" : "Add Affiliate"}</div>
            <form onSubmit={saveAffiliate}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label style={{ display: "block" }}>
                  <div style={{ fontSize: 12, color: "var(--admin-text-muted)", marginBottom: 4 }}>Name *</div>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} />
                </label>
                <label style={{ display: "block" }}>
                  <div style={{ fontSize: 12, color: "var(--admin-text-muted)", marginBottom: 4 }}>Partnership Type</div>
                  <select value={form.partnershipType} onChange={e => setForm(f => ({ ...f, partnershipType: e.target.value }))} style={inputStyle}>
                    {PARTNERSHIP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
                <label style={{ display: "block" }}>
                  <div style={{ fontSize: 12, color: "var(--admin-text-muted)", marginBottom: 4 }}>Website URL</div>
                  <input value={form.websiteUrl} onChange={e => setForm(f => ({ ...f, websiteUrl: e.target.value }))} placeholder="https://..." style={inputStyle} />
                </label>
                <label style={{ display: "block" }}>
                  <div style={{ fontSize: 12, color: "var(--admin-text-muted)", marginBottom: 4 }}>Contact Email</div>
                  <input type="email" value={form.contactEmail} onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))} style={inputStyle} />
                </label>
                <label style={{ display: "block" }}>
                  <div style={{ fontSize: 12, color: "var(--admin-text-muted)", marginBottom: 4 }}>Contact Phone</div>
                  <input value={form.contactPhone} onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))} style={inputStyle} />
                </label>
                <label style={{ display: "block" }}>
                  <div style={{ fontSize: 12, color: "var(--admin-text-muted)", marginBottom: 4 }}>Logo URL</div>
                  <input value={form.logoUrl} onChange={e => setForm(f => ({ ...f, logoUrl: e.target.value }))} placeholder="https://..." style={inputStyle} />
                </label>
                <label style={{ display: "block", gridColumn: "1 / -1" }}>
                  <div style={{ fontSize: 12, color: "var(--admin-text-muted)", marginBottom: 4 }}>Description</div>
                  <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3}
                    style={{ ...inputStyle, resize: "vertical" }} />
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
                  <span style={{ fontSize: 13 }}>Active</span>
                </label>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button type="submit" disabled={saving}
                  style={{ padding: "8px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
                  {saving ? "Saving…" : editingId ? "Update" : "Add Affiliate"}
                </button>
                <button type="button" onClick={() => { resetForm(); setShowForm(false); }}
                  style={{ padding: "8px 16px", background: "var(--admin-bg-tertiary)", color: "var(--admin-text-secondary)", border: "1px solid var(--admin-border)", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Affiliates list */}
        {centerId ? (
          affiliates.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "var(--admin-text-faint)", fontSize: 14, background: "var(--admin-bg)", borderRadius: 10, border: "1px solid var(--admin-border)" }}>
              No affiliates yet. Click &ldquo;+ Add Affiliate&rdquo; to get started.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
              {affiliates.map(a => (
                <div key={a.id} style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)", borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {a.logoUrl && (
                        <img src={a.logoUrl} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover", border: "1px solid var(--admin-border)" }}
                          onError={e => { e.target.style.display = "none"; }} />
                      )}
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: "var(--admin-text)" }}>{a.name}</div>
                        <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                          <span style={{
                            fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 4,
                            background: "var(--admin-accent-bg)", color: "var(--admin-accent-text)",
                          }}>{a.partnershipType}</span>
                          <span style={{
                            fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 4,
                            background: a.isActive ? "var(--admin-success-bg)" : "var(--admin-bg-tertiary)",
                            color: a.isActive ? "var(--admin-success-text)" : "var(--admin-text-muted)",
                          }}>{a.isActive ? "Active" : "Inactive"}</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                      <button type="button" onClick={() => startEdit(a)}
                        style={{ fontSize: 11, padding: "3px 8px", background: "var(--admin-accent-bg)", color: "var(--admin-accent-text)", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
                        Edit
                      </button>
                      <button type="button" onClick={() => deleteAffiliate(a.id)}
                        style={{ fontSize: 11, padding: "3px 8px", background: "var(--admin-danger-accent-bg)", color: "var(--admin-danger-accent-text)", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
                        Delete
                      </button>
                    </div>
                  </div>
                  {a.description && <div style={{ fontSize: 13, color: "var(--admin-text-muted)", lineHeight: 1.4 }}>{a.description}</div>}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--admin-text-muted)" }}>
                    {a.websiteUrl && (
                      <a href={a.websiteUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--admin-accent-text)", textDecoration: "none" }}>
                        {a.websiteUrl}
                      </a>
                    )}
                    {a.contactEmail && <div>Email: {a.contactEmail}</div>}
                    {a.contactPhone && <div>Phone: {a.contactPhone}</div>}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <div style={{ textAlign: "center", padding: 40, color: "var(--admin-text-faint)", fontSize: 14 }}>
            Select a center to manage affiliates
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
