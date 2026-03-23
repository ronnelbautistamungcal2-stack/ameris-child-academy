import AdminLayout from "@/components/admin/AdminLayout";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

const PERIODS = ["DAY", "WEEK", "MONTH"];
const KINDS = ["POLICY", "PROCEDURE", "VIDEO", "LESSON", "OTHER"];

function toDateInputValue(date) {
  const d = date instanceof Date ? date : new Date();
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function startOfPeriod(date, period) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  if (period === "DAY") return d;
  if (period === "WEEK") {
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d;
  }
  d.setDate(1);
  return d;
}

function toIsoDate(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export default function AdminMilestoneChecklists() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");

  const [period, setPeriod] = useState("DAY");
  const [dateValue, setDateValue] = useState(toDateInputValue(new Date()));

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState([]);
  const [quickLessonId, setQuickLessonId] = useState("");

  const [policies, setPolicies] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [existingPlans, setExistingPlans] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const periodStart = useMemo(() => {
    const parsed = dateValue ? new Date(dateValue) : new Date();
    return startOfPeriod(parsed, period);
  }, [dateValue, period]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const c = await apiJson("/api/v1/centers");
        const arr = Array.isArray(c) ? c : [];
        setCenters(arr);
        if (arr.length === 1) setCenterId(arr[0].id);
      } catch (e) {
        setError(e.message || "Failed to load centers");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function loadReferenceData() {
    if (!centerId) {
      setPolicies([]);
      setLessons([]);
      return;
    }
    try {
      const [p, l] = await Promise.all([
        apiJson(
          `/api/v1/policies?centerId=${encodeURIComponent(centerId)}`,
        ).catch(() => []),
        apiJson(
          `/api/v1/lessons?centerId=${encodeURIComponent(centerId)}`,
        ).catch(() => []),
      ]);
      setPolicies(Array.isArray(p) ? p : []);
      setLessons(Array.isArray(l) ? l : []);
    } catch {
      setPolicies([]);
      setLessons([]);
    }
  }

  async function loadExistingPlans() {
    if (!centerId) {
      setExistingPlans([]);
      return;
    }
    try {
      const qs = new URLSearchParams({
        centerId,
        period,
        start: toIsoDate(periodStart),
      });
      const data = await apiJson(
        `/api/v1/milestone-checklists?${qs.toString()}`,
      );
      setExistingPlans(Array.isArray(data) ? data : []);
    } catch {
      setExistingPlans([]);
    }
  }

  useEffect(() => {
    loadReferenceData();
    loadExistingPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerId, period, periodStart.toISOString()]);

  function addItem() {
    setItems((cur) => [
      ...cur,
      {
        title: "",
        kind: "OTHER",
        url: "",
        policyDocumentId: "",
        lessonId: "",
        lessonGoalId: "",
        notes: "",
      },
    ]);
  }

  function addLessonItem() {
    const lesson = quickLessonId ? lessonById[quickLessonId] : null;
    if (!lesson) return;
    setItems((cur) => [
      ...cur,
      {
        title: lesson.title || "Lesson",
        kind: "LESSON",
        url: "",
        policyDocumentId: "",
        lessonId: lesson.id,
        lessonGoalId: "",
        notes: "",
      },
    ]);
    setQuickLessonId("");
  }

  function updateItem(idx, patch) {
    setItems((cur) =>
      cur.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    );
  }

  function removeItem(idx) {
    setItems((cur) => cur.filter((_, i) => i !== idx));
  }

  const lessonById = useMemo(() => {
    return Object.fromEntries((lessons || []).map((l) => [l.id, l]));
  }, [lessons]);

  async function createPlan(e) {
    e.preventDefault();
    if (!centerId) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await apiJson("/api/v1/milestone-checklists", {
        method: "POST",
        body: JSON.stringify({
          centerId,
          title,
          description: description || null,
          period,
          periodStart: toIsoDate(periodStart),
          items: items.map((it, idx) => ({
            ...it,
            sortOrder: idx,
            policyDocumentId: it.policyDocumentId || null,
            lessonId: it.lessonId || null,
            lessonGoalId: it.lessonGoalId || null,
            url: it.url || null,
            notes: it.notes || null,
          })),
        }),
      });
      setTitle("");
      setDescription("");
      setItems([]);
      setSuccess("Milestone checklist planned.");
      await loadExistingPlans();
    } catch (e2) {
      setError(e2.message || "Failed to create plan");
    } finally {
      setSaving(false);
    }
  }

  async function deletePlan(id) {
    if (!confirm("Delete this plan?")) return;
    setError("");
    setSuccess("");
    try {
      await apiJson(`/api/v1/milestone-checklists/${id}`, { method: "DELETE" });
      await loadExistingPlans();
    } catch (e) {
      setError(e.message || "Failed to delete plan");
    }
  }

  return (
    <AdminLayout title="Milestone Checklists">
      <Panel>
        <h2 style={{ marginTop: 0 }}>Milestone Checklist Planner</h2>
        <p style={{ color: "#6b7280", marginTop: 6 }}>
          Plan what teachers will teach by day/week/month. Items can link to
          policies, procedures, videos, and lessons (optionally to a specific
          step).
        </p>

        {error ? <Banner kind="error" message={error} /> : null}
        {success ? <Banner kind="success" message={success} /> : null}

        <div
          style={{
            marginTop: 12,
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 10,
            maxWidth: 900,
          }}
        >
          <Field label="Center">
            <select
              value={centerId}
              onChange={(e) => setCenterId(e.target.value)}
              style={inputStyle}
              disabled={loading}
            >
              <option value="">Select a center</option>
              {centers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Period">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              style={inputStyle}
              disabled={!centerId}
            >
              {PERIODS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label={
              period === "WEEK"
                ? "Week of"
                : period === "MONTH"
                  ? "Month"
                  : "Day"
            }
          >
            <input
              type="date"
              value={dateValue}
              onChange={(e) => setDateValue(e.target.value)}
              style={inputStyle}
              disabled={!centerId}
            />
          </Field>
        </div>

        <form onSubmit={createPlan} style={{ marginTop: 12 }}>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
          >
            <Field label="Title">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                style={inputStyle}
                disabled={!centerId}
              />
            </Field>
            <Field label="Description (optional)">
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={inputStyle}
                disabled={!centerId}
              />
            </Field>
          </div>

          <div
            style={{
              marginTop: 12,
              display: "flex",
              gap: 10,
              alignItems: "center",
            }}
          >
            <button
              type="button"
              onClick={addItem}
              style={secondaryButton}
              disabled={!centerId}
            >
              Add item
            </button>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select
                value={quickLessonId}
                onChange={(e) => setQuickLessonId(e.target.value)}
                style={{ ...inputStyle, width: 260 }}
                disabled={!centerId}
              >
                <option value="">Add a lesson</option>
                {lessons
                  .slice()
                  .sort((a, b) => (a.title || "").localeCompare(b.title || ""))
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.title}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                onClick={addLessonItem}
                style={secondaryButton}
                disabled={!quickLessonId}
              >
                Add lesson
              </button>
            </div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              Tip: For LESSON items, pick a lesson and optionally a specific
              step.
            </div>
          </div>

          <div
            style={{
              marginTop: 10,
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: 10,
            }}
          >
            {items.map((it, idx) => {
              const selectedLesson = it.lessonId
                ? lessonById[it.lessonId]
                : null;
              const goals = Array.isArray(selectedLesson?.goals)
                ? selectedLesson.goals
                : [];
              return (
                <div key={idx} style={cardStyle}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      alignItems: "center",
                    }}
                  >
                    <div style={{ fontWeight: 800 }}>Item {idx + 1}</div>
                    <button
                      type="button"
                      style={dangerButton}
                      onClick={() => removeItem(idx)}
                    >
                      Remove
                    </button>
                  </div>

                  <div
                    style={{
                      marginTop: 10,
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      gap: 10,
                    }}
                  >
                    <Field label="Title">
                      <input
                        value={it.title}
                        onChange={(e) =>
                          updateItem(idx, { title: e.target.value })
                        }
                        style={inputStyle}
                        placeholder="Auto-fills when you select a lesson/step"
                      />
                    </Field>
                    <Field label="Kind">
                      <select
                        value={it.kind}
                        onChange={(e) =>
                          updateItem(idx, { kind: e.target.value })
                        }
                        style={inputStyle}
                      >
                        {KINDS.map((k) => (
                          <option key={k} value={k}>
                            {k}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="URL (optional)">
                      <input
                        value={it.url}
                        onChange={(e) =>
                          updateItem(idx, { url: e.target.value })
                        }
                        style={inputStyle}
                        placeholder="https://..."
                      />
                    </Field>
                  </div>

                  <div
                    style={{
                      marginTop: 10,
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      gap: 10,
                    }}
                  >
                    <Field label="Policy document (optional)">
                      <select
                        value={it.policyDocumentId}
                        onChange={(e) =>
                          updateItem(idx, { policyDocumentId: e.target.value })
                        }
                        style={inputStyle}
                      >
                        <option value="">(none)</option>
                        {policies.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.title}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Lesson (optional)">
                      <select
                        value={it.lessonId}
                        onChange={(e) => {
                          const nextLessonId = e.target.value;
                          const nextLesson = nextLessonId
                            ? lessonById[nextLessonId]
                            : null;

                          const patch = {
                            lessonId: nextLessonId,
                            lessonGoalId: "",
                          };

                          if (nextLesson) {
                            if (!it.title)
                              patch.title = nextLesson.title || "Lesson";
                            if (!it.kind || it.kind === "OTHER")
                              patch.kind = "LESSON";
                          }

                          updateItem(idx, patch);
                        }}
                        style={inputStyle}
                      >
                        <option value="">(none)</option>
                        {lessons
                          .slice()
                          .sort((a, b) =>
                            (a.title || "").localeCompare(b.title || ""),
                          )
                          .map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.title}
                            </option>
                          ))}
                      </select>
                    </Field>

                    <Field label="Lesson step (optional)">
                      <select
                        value={it.lessonGoalId}
                        onChange={(e) => {
                          const nextGoalId = e.target.value;
                          const goal = nextGoalId
                            ? goals.find(
                                (g) => String(g.id) === String(nextGoalId),
                              )
                            : null;

                          const patch = { lessonGoalId: nextGoalId };
                          if (goal && selectedLesson) {
                            const baseTitle = selectedLesson.title || "Lesson";
                            if (!it.title || it.title === baseTitle) {
                              patch.title = `${baseTitle} — Step ${goal.goalIndex}`;
                            }
                            if (!it.kind || it.kind === "OTHER")
                              patch.kind = "LESSON";
                          }

                          updateItem(idx, patch);
                        }}
                        style={inputStyle}
                        disabled={!it.lessonId}
                      >
                        <option value="">(none)</option>
                        {goals
                          .slice()
                          .sort(
                            (a, b) =>
                              Number(a.goalIndex || 0) -
                              Number(b.goalIndex || 0),
                          )
                          .map((g) => (
                            <option key={g.id} value={g.id}>
                              Step {g.goalIndex}: {g.title?.slice(0, 60) || ""}
                            </option>
                          ))}
                      </select>
                    </Field>
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <Field label="Notes (optional)">
                      <input
                        value={it.notes}
                        onChange={(e) =>
                          updateItem(idx, { notes: e.target.value })
                        }
                        style={inputStyle}
                      />
                    </Field>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 12 }}>
            <button
              type="submit"
              disabled={saving || !centerId}
              style={primaryButton}
            >
              {saving ? "Saving..." : "Create Plan"}
            </button>
          </div>
        </form>

        <div style={{ marginTop: 16 }}>
          <h3 style={{ margin: "0 0 8px 0" }}>
            Existing plans for this period
          </h3>
          {loading ? (
            <p>Loading...</p>
          ) : !centerId ? (
            <p style={{ color: "#6b7280" }}>Select a center.</p>
          ) : existingPlans.length === 0 ? (
            <p style={{ color: "#6b7280" }}>No plans found.</p>
          ) : (
            <div
              style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}
            >
              {existingPlans.map((p) => (
                <div key={p.id} style={cardStyle}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800 }}>{p.title}</div>
                      <div
                        style={{ color: "#6b7280", marginTop: 4, fontSize: 13 }}
                      >
                        {p.description || "No description"}
                      </div>
                      <div
                        style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}
                      >
                        {(p.items || []).length} items | {p.period} |{" "}
                        {new Date(p.periodStart).toLocaleDateString()}
                      </div>
                    </div>
                    <div>
                      <button
                        type="button"
                        style={dangerButton}
                        onClick={() => deletePlan(p.id)}
                      >
                        Delete
                      </button>
                    </div>
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

function Banner({ message, kind }) {
  const style =
    kind === "success"
      ? { background: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0" }
      : {
          background: "#fee2e2",
          color: "#991b1b",
          border: "1px solid #fecaca",
        };
  return (
    <div style={{ padding: 12, borderRadius: 8, marginTop: 12, ...style }}>
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

const primaryButton = {
  padding: "10px 12px",
  background: "#2563eb",
  color: "white",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 800,
};

const secondaryButton = {
  padding: "10px 12px",
  background: "white",
  color: "#111827",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 800,
};

const dangerButton = {
  padding: "10px 12px",
  background: "#ef4444",
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
