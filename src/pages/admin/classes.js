import AdminLayout from "@/components/admin/AdminLayout";
import { apiJson } from "@/lib/api";
import { useCallback, useEffect, useMemo, useState } from "react";

export default function AdminClasses() {
  const [classes, setClasses] = useState([]);
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const [centerId, setCenterId] = useState("");
  const [capacity, setCapacity] = useState("");
  const [ageRange, setAgeRange] = useState("");

  async function refresh() {
    setError("");
    setLoading(true);
    try {
      const [cls, c] = await Promise.all([
        apiJson("/api/v1/classes"),
        apiJson("/api/v1/centers"),
      ]);
      setClasses(Array.isArray(cls) ? cls : []);
      setCenters(Array.isArray(c) ? c : []);
    } catch (e) {
      setError(e.message || "Failed to load classes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const centerById = useMemo(
    () => Object.fromEntries(centers.map((c) => [c.id, c])),
    [centers],
  );

  const sorted = useMemo(() => {
    return [...classes].sort((a, b) =>
      (a.name || "").localeCompare(b.name || ""),
    );
  }, [classes]);

  const resetForm = useCallback(() => {
    setEditing(null);
    setName("");
    setCenterId("");
    setCapacity("");
    setAgeRange("");
  }, []);

  const startEdit = useCallback((cl) => {
    setEditing(cl);
    setName(cl.name || "");
    setCenterId(cl.centerId || "");
    setCapacity(
      cl.capacity === null || cl.capacity === undefined
        ? ""
        : String(cl.capacity),
    );
    setAgeRange(cl.ageRange || "");
  }, []);

  const openCreate = useCallback(() => {
    setError("");
    resetForm();
    setModalOpen(true);
  }, [resetForm]);

  const openEdit = useCallback(
    (cl) => {
      setError("");
      startEdit(cl);
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

  function parseCapacityInput(value) {
    const trimmed = String(value || "").trim();
    if (!trimmed) return null;
    const num = Number(trimmed);
    if (!Number.isFinite(num) || !Number.isInteger(num)) {
      throw new Error("Capacity must be a whole number.");
    }
    if (num < 0) throw new Error("Capacity must be >= 0.");
    return num;
  }

  async function createClass(e) {
    e.preventDefault();
    setError("");
    try {
      const parsedCapacity = parseCapacityInput(capacity);
      await apiJson("/api/v1/classes", {
        method: "POST",
        body: JSON.stringify({
          name,
          centerId,
          capacity: parsedCapacity,
          ageRange: ageRange ? ageRange : null,
        }),
      });
      resetForm();
      setModalOpen(false);
      await refresh();
    } catch (e2) {
      setError(e2.message || "Failed to create class");
    }
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editing) return;
    setError("");
    try {
      const parsedCapacity = parseCapacityInput(capacity);
      await apiJson(`/api/v1/classes/${editing.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name,
          capacity: parsedCapacity,
          ageRange: ageRange ? ageRange : null,
        }),
      });
      resetForm();
      setModalOpen(false);
      await refresh();
    } catch (e2) {
      setError(e2.message || "Failed to update class");
    }
  }

  async function deleteClass(id) {
    if (!confirm("Delete this class? This cannot be undone.")) return;
    setError("");
    try {
      await apiJson(`/api/v1/classes/${id}`, { method: "DELETE" });
      await refresh();
    } catch (e2) {
      setError(e2.message || "Failed to delete class");
    }
  }

  return (
    <AdminLayout title="Classes">
      <Panel>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2 style={{ marginTop: 0 }}>Classes</h2>
            <p style={{ color: "#6b7280", marginTop: 6 }}>
              Classroom setup: create/modify/delete class rooms.
            </p>
          </div>
          <button type="button" style={primaryButton} onClick={openCreate}>
            + Add Room
          </button>
        </div>

        {error && !modalOpen ? <ErrorBanner message={error} /> : null}

        {modalOpen ? (
          <Modal
            title={editing ? "Edit Room" : "Add Room"}
            onClose={closeModal}
          >
            {error ? <ErrorBanner message={error} /> : null}
            <form onSubmit={editing ? saveEdit : createClass}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 10,
                }}
              >
                <Field label="Class Name">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={inputStyle}
                    required
                  />
                </Field>
                <Field label={editing ? "Center (create only)" : "Center"}>
                  <select
                    value={centerId}
                    onChange={(e) => setCenterId(e.target.value)}
                    style={inputStyle}
                    required={!editing}
                    disabled={!!editing}
                  >
                    <option value="">
                      {editing ? "(unchanged)" : "Select a center"}
                    </option>
                    {centers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Capacity">
                  <input
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    style={inputStyle}
                    inputMode="numeric"
                    placeholder="e.g. 20"
                  />
                </Field>
                <Field label="Age Range">
                  <select
                    value={ageRange}
                    onChange={(e) => setAgeRange(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">Select age range</option>
                    <option value="0-1 years">0-1 years</option>
                    <option value="2-3 years">2-3 years</option>
                    <option value="4-5 years">4-5 years</option>
                    <option value="6-7 years">6-7 years</option>
                  </select>
                </Field>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 8,
                  marginTop: 14,
                }}
              >
                <button
                  type="button"
                  style={secondaryButton}
                  onClick={resetForm}
                >
                  Clear
                </button>
                <button
                  type="button"
                  style={secondaryButton}
                  onClick={closeModal}
                >
                  Cancel
                </button>
                <button type="submit" style={primaryButton}>
                  {editing ? "Save" : "Create"}
                </button>
              </div>
            </form>
          </Modal>
        ) : null}

        <div style={{ marginTop: 16 }}>
          {loading ? (
            <p>Loading…</p>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Center</th>
                  <th style={thStyle}>Capacity</th>
                  <th style={thStyle}>Age Range</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((cl) => (
                  <tr key={cl.id}>
                    <td style={tdStyle}>{cl.name}</td>
                    <td style={tdStyle}>
                      {centerById[cl.centerId]?.name || cl.centerId}
                    </td>
                    <td style={tdStyle}>
                      {cl.capacity === null || cl.capacity === undefined
                        ? "â€”"
                        : cl.capacity}
                    </td>
                    <td style={tdStyle}>{cl.ageRange || "â€”"}</td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          style={secondaryButton}
                          onClick={() => openEdit(cl)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          style={dangerButton}
                          onClick={() => deleteClass(cl.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {sorted.length === 0 ? (
                  <tr>
                    <td style={tdStyle} colSpan={5}>
                      No classes found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          )}
        </div>
      </Panel>
    </AdminLayout>
  );
}

function Panel({ children }) {
  return (
    <div
      style={{
        background: "white",
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        padding: 16,
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 10,
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 16 }}>{title}</div>
          <button type="button" style={secondaryButton} onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>
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
        background: "#fee2e2",
        color: "#991b1b",
        borderRadius: 8,
        marginTop: 12,
        border: "1px solid #fecaca",
      }}
    >
      {message}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: 10,
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  boxSizing: "border-box",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  overflow: "hidden",
};

const thStyle = {
  textAlign: "left",
  fontSize: 12,
  color: "#6b7280",
  padding: 10,
  borderBottom: "1px solid #e5e7eb",
  background: "#f9fafb",
};

const tdStyle = {
  padding: 10,
  borderBottom: "1px solid #f3f4f6",
};

const modalOverlayStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 80,
  background: "rgba(17, 24, 39, 0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const modalCardStyle = {
  width: "min(980px, 100%)",
  maxHeight: "min(86vh, 900px)",
  overflow: "auto",
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 16,
  boxShadow:
    "0 20px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.12)",
};

const primaryButton = {
  padding: "10px 12px",
  background: "#2563eb",
  color: "white",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 600,
};

const secondaryButton = {
  padding: "10px 12px",
  background: "white",
  color: "#111827",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 600,
};

const dangerButton = {
  padding: "10px 12px",
  background: "#ef4444",
  color: "white",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 600,
};
