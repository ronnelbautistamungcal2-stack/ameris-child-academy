import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import {
  DEFAULT_PARENT_FAQ_TOPIC,
  PARENT_FAQ_TOPICS,
  normalizeParentFaqTopic,
  parentFaqTopicLabel,
} from "@/lib/parentFaqs";
import { useEffect, useMemo, useState } from "react";

const TOPIC_COLORS = {
  pickup: { bg: "#DBEAFE", color: "#1E40AF", border: "#93C5FD" },
  health: { bg: "#FEF3C7", color: "#92400E", border: "#FDE68A" },
  billing: { bg: "#D1FAE5", color: "#065F46", border: "#A7F3D0" },
  enrollment: { bg: "#EDE9FE", color: "#5B21B6", border: "#C4B5FD" },
  general: { bg: "#F3F4F6", color: "#6B7280", border: "#E5E7EB" },
};

function topicColor(topic) {
  return TOPIC_COLORS[normalizeParentFaqTopic(topic)] || TOPIC_COLORS.general;
}

export default function ParentFaqPanel({ centers = [] }) {
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [topicFilter, setTopicFilter] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [topic, setTopic] = useState(DEFAULT_PARENT_FAQ_TOPIC);
  const [centerId, setCenterId] = useState("");
  const [published, setPublished] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const result = await apiJson("/api/v1/parent-faqs");
      setFaqs(Array.isArray(result) ? result : []);
    } catch (e) {
      setError(e.message || "Failed to load parent questions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(""), 3000);
      return () => clearTimeout(t);
    }
  }, [success]);

  const ordered = useMemo(
    () =>
      [...faqs].sort(
        (a, b) =>
          (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
          String(a.createdAt || "").localeCompare(String(b.createdAt || "")),
      ),
    [faqs],
  );

  const visible = useMemo(() => {
    let list = ordered;
    if (topicFilter) {
      list = list.filter((f) => normalizeParentFaqTopic(f.topic) === topicFilter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (f) =>
          String(f.question || "").toLowerCase().includes(q) ||
          String(f.answer || "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [ordered, search, topicFilter]);

  const publishedCount = faqs.filter((f) => f.published).length;

  function resetForm() {
    setEditingId(null);
    setQuestion("");
    setAnswer("");
    setTopic(DEFAULT_PARENT_FAQ_TOPIC);
    setCenterId("");
    setPublished(true);
  }

  function startEdit(faq) {
    setEditingId(faq.id);
    setQuestion(faq.question || "");
    setAnswer(faq.answer || "");
    setTopic(normalizeParentFaqTopic(faq.topic));
    setCenterId(faq.centerId || "");
    setPublished(faq.published !== false);
    setShowForm(true);
  }

  async function save(e) {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) {
      setError("A question and an answer are both required.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload = {
        question: question.trim(),
        answer: answer.trim(),
        topic,
        published,
        centerId: centerId || null,
      };
      if (editingId) {
        await apiJson(`/api/v1/parent-faqs/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setSuccess("Question updated.");
      } else {
        const nextOrder = ordered.length
          ? Math.max(...ordered.map((f) => f.sortOrder ?? 0)) + 1
          : 0;
        await apiJson("/api/v1/parent-faqs", {
          method: "POST",
          body: JSON.stringify({ ...payload, sortOrder: nextOrder }),
        });
        setSuccess("Question published to the parent portal.");
      }
      resetForm();
      setShowForm(false);
      await refresh();
    } catch (e2) {
      setError(e2.message || "Failed to save question");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublished(faq) {
    setError("");
    setSuccess("");
    try {
      await apiJson(`/api/v1/parent-faqs/${faq.id}`, {
        method: "PUT",
        body: JSON.stringify({ published: !faq.published }),
      });
      setSuccess(faq.published ? "Question hidden from parents." : "Question published.");
      await refresh();
    } catch (e) {
      setError(e.message || "Failed to update question");
    }
  }

  // Reorder by swapping sortOrder with the neighbour in the full ordered list.
  async function move(faq, direction) {
    const index = ordered.findIndex((f) => f.id === faq.id);
    const target = ordered[index + direction];
    if (!target) return;
    setReordering(true);
    setError("");
    try {
      await Promise.all([
        apiJson(`/api/v1/parent-faqs/${faq.id}`, {
          method: "PUT",
          body: JSON.stringify({ sortOrder: index + direction }),
        }),
        apiJson(`/api/v1/parent-faqs/${target.id}`, {
          method: "PUT",
          body: JSON.stringify({ sortOrder: index }),
        }),
      ]);
      await refresh();
    } catch (e) {
      setError(e.message || "Failed to reorder questions");
    } finally {
      setReordering(false);
    }
  }

  async function remove(id) {
    setError("");
    setSuccess("");
    try {
      await apiJson(`/api/v1/parent-faqs/${id}`, { method: "DELETE" });
      setSuccess("Question deleted.");
      setDeleteTarget(null);
      await refresh();
    } catch (e) {
      setError(e.message || "Failed to delete question");
      setDeleteTarget(null);
    }
  }

  function getCenterName(cId) {
    if (!cId) return "All Centers";
    return centers.find((c) => c.id === cId)?.name || cId;
  }

  return (
    <div style={panelStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--admin-text)" }}>
            Common Parent Questions
          </h2>
          <p style={{ color: "var(--admin-text-muted)", marginTop: 4, fontSize: 13, margin: "4px 0 0 0" }}>
            Short answers that appear on the parent Policies &amp; Procedures page, above the document library.
          </p>
        </div>
        {!showForm && (
          <button type="button" style={primaryBtnStyle} onClick={() => { resetForm(); setShowForm(true); }}>
            <span style={{ fontSize: 16 }}>+</span> Add Question
          </button>
        )}
      </div>

      {!loading && faqs.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <span style={countPillStyle}>{faqs.length} total</span>
          <span style={countPillStyle}>{publishedCount} published</span>
          <span style={countPillStyle}>{faqs.length - publishedCount} draft</span>
        </div>
      )}

      {error && <ErrorBanner message={error} />}
      {success && <SuccessBanner message={success} />}

      {showForm && (
        <form onSubmit={save} style={{ marginTop: 16, padding: 16, borderRadius: 12, border: "1px solid #BFDBFE", background: "#EFF6FF" }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#1E40AF", marginBottom: 12 }}>
            {editingId ? "Edit Question" : "New Question"}
          </div>

          <label style={{ display: "block" }}>
            <div style={fieldLabelStyle}>Question *</div>
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              required
              style={inputStyle}
              placeholder="What time does late pickup start?"
            />
          </label>

          <label style={{ display: "block", marginTop: 12 }}>
            <div style={fieldLabelStyle}>Answer *</div>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              required
              rows={4}
              style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }}
              placeholder="Answer in a sentence or two, the way you would explain it at the front desk."
            />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
            <label style={{ display: "block" }}>
              <div style={fieldLabelStyle}>Topic</div>
              <select value={topic} onChange={(e) => setTopic(e.target.value)} style={inputStyle}>
                {PARENT_FAQ_TOPICS.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
              <div style={{ marginTop: 4, fontSize: 11, color: "var(--admin-text-muted)" }}>
                Groups the question under the matching topic card for parents.
              </div>
            </label>
            <label style={{ display: "block" }}>
              <div style={fieldLabelStyle}>Center</div>
              <select value={centerId} onChange={(e) => setCenterId(e.target.value)} style={inputStyle}>
                <option value="">All Centers</option>
                {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, cursor: "pointer" }}>
            <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--admin-text)" }}>
              Visible to parents
            </span>
            <span style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>
              Uncheck to keep it as a draft.
            </span>
          </label>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
            <button type="button" style={secondaryBtnStyle} onClick={() => { resetForm(); setShowForm(false); }}>
              Cancel
            </button>
            <button type="submit" disabled={saving} style={{ ...primaryBtnStyle, opacity: saving ? 0.6 : 1, cursor: saving ? "not-allowed" : "pointer" }}>
              {saving ? "Saving..." : editingId ? "Save Changes" : "Publish Question"}
            </button>
          </div>
        </form>
      )}

      {/* Filters */}
      {!loading && faqs.length > 0 && (
        <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: "1 1 260px", maxWidth: 340 }}>
            <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF" }}>
              <SearchIcon />
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search questions..."
              style={{ ...inputStyle, paddingLeft: 36 }}
            />
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <FilterPill active={!topicFilter} onClick={() => setTopicFilter("")} label="All topics" />
            {PARENT_FAQ_TOPICS.map((t) => (
              <FilterPill
                key={t.id}
                active={topicFilter === t.id}
                onClick={() => setTopicFilter(topicFilter === t.id ? "" : t.id)}
                label={t.label}
                colors={TOPIC_COLORS[t.id]}
              />
            ))}
          </div>
        </div>
      )}

      {/* List */}
      <div style={{ marginTop: 16 }}>
        {loading ? (
          <SkeletonTable rows={3} cols={2} />
        ) : visible.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>
              <QuestionIcon />
            </div>
            <p style={{ marginTop: 12, fontWeight: 700, fontSize: 14, color: "var(--admin-text)" }}>
              {faqs.length ? "No questions match your filters" : "No parent questions yet"}
            </p>
            <p style={{ marginTop: 4, fontSize: 12, color: "var(--admin-text-muted)" }}>
              {faqs.length
                ? "Try a different search term or topic."
                : "Add the questions your front desk answers most often."}
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {visible.map((faq) => {
              const tc = topicColor(faq.topic);
              const orderIndex = ordered.findIndex((f) => f.id === faq.id);
              const canReorder = !search && !topicFilter;
              return (
                <div key={faq.id} style={cardStyle}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: tc.bg, border: `1px solid ${tc.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: tc.color }}>
                    <QuestionIcon color="currentColor" />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: "var(--admin-text)" }}>{faq.question}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: tc.bg, color: tc.color, border: `1px solid ${tc.border}` }}>
                        {parentFaqTopicLabel(faq.topic)}
                      </span>
                      {!faq.published && (
                        <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FECACA", letterSpacing: "0.04em" }}>
                          DRAFT
                        </span>
                      )}
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                        background: faq.centerId ? "#FEF3C7" : "#F3F4F6",
                        color: faq.centerId ? "#92400E" : "#6B7280",
                        border: `1px solid ${faq.centerId ? "#FDE68A" : "#E5E7EB"}`,
                      }}>
                        {getCenterName(faq.centerId)}
                      </span>
                    </div>
                    <div style={{ marginTop: 6, fontSize: 12, color: "var(--admin-text-muted)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                      {faq.answer}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                    {canReorder && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <button
                          type="button"
                          title="Move up"
                          aria-label="Move up"
                          disabled={reordering || orderIndex === 0}
                          onClick={() => move(faq, -1)}
                          style={{ ...iconBtn, opacity: reordering || orderIndex === 0 ? 0.35 : 1 }}
                        >
                          <ChevronIcon direction="up" />
                        </button>
                        <button
                          type="button"
                          title="Move down"
                          aria-label="Move down"
                          disabled={reordering || orderIndex === ordered.length - 1}
                          onClick={() => move(faq, 1)}
                          style={{ ...iconBtn, opacity: reordering || orderIndex === ordered.length - 1 ? 0.35 : 1 }}
                        >
                          <ChevronIcon direction="down" />
                        </button>
                      </div>
                    )}
                    <button type="button" style={cardActionBtn} onClick={() => togglePublished(faq)}>
                      {faq.published ? "Hide" : "Publish"}
                    </button>
                    <button type="button" style={cardActionBtn} onClick={() => startEdit(faq)}>
                      <PencilIcon />
                      Edit
                    </button>
                    <button type="button" style={cardDangerBtn} aria-label="Delete question" onClick={() => setDeleteTarget(faq.id)}>
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Question"
        message="Are you sure you want to delete this parent question? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => remove(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

/* ── Sub-components ── */

function FilterPill({ active, onClick, label, colors }) {
  const c = colors || { bg: "#DBEAFE", color: "#1E40AF", border: "#93C5FD" };
  return (
    <button type="button" onClick={onClick} style={{
      padding: "5px 12px", borderRadius: 999, cursor: "pointer", fontWeight: 700, fontSize: 11,
      background: active ? c.bg : "var(--admin-bg)",
      color: active ? c.color : "var(--admin-text-muted)",
      border: `1.5px solid ${active ? c.border : "var(--admin-border)"}`,
    }}>
      {label}
    </button>
  );
}

function ErrorBanner({ message }) {
  return (
    <div style={{ padding: 12, background: "var(--admin-error-bg)", color: "var(--admin-error-text)", borderRadius: 10, marginTop: 12, border: "1px solid var(--admin-error-border)", fontSize: 13, fontWeight: 600 }}>
      {message}
    </div>
  );
}

function SuccessBanner({ message }) {
  return (
    <div style={{ padding: 12, background: "#D1FAE5", color: "#065F46", borderRadius: 10, marginTop: 12, border: "1px solid #A7F3D0", fontSize: 13, fontWeight: 600 }}>
      {message}
    </div>
  );
}

/* ── Icons ── */

function QuestionIcon({ color = "#9CA3AF" }) {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
}

function SearchIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
}

function PencilIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
}

function TrashIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>;
}

function ChevronIcon({ direction = "up" }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      {direction === "up" ? <polyline points="18 15 12 9 6 15" /> : <polyline points="6 9 12 15 18 9" />}
    </svg>
  );
}

/* ── Styles ── */

const panelStyle = {
  background: "var(--admin-bg)",
  border: "1px solid var(--admin-border)",
  borderRadius: 14,
  padding: 20,
};

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid var(--admin-border)",
  borderRadius: 10,
  boxSizing: "border-box",
  background: "var(--admin-bg)",
  color: "var(--admin-text)",
  fontSize: 13,
};

const fieldLabelStyle = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--admin-text-muted)",
  marginBottom: 6,
};

const countPillStyle = {
  fontSize: 11,
  fontWeight: 700,
  padding: "4px 10px",
  borderRadius: 999,
  background: "var(--admin-bg)",
  border: "1px solid var(--admin-border)",
  color: "var(--admin-text-muted)",
};

const cardStyle = {
  display: "flex",
  alignItems: "flex-start",
  gap: 14,
  padding: 16,
  borderRadius: 12,
  border: "1px solid var(--admin-border)",
  background: "var(--admin-bg)",
};

const cardActionBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "7px 12px",
  border: "1px solid var(--admin-border)",
  borderRadius: 8,
  background: "var(--admin-bg)",
  color: "var(--admin-text)",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 12,
};

const cardDangerBtn = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 7,
  border: "1px solid #FECACA",
  borderRadius: 8,
  background: "#FEF2F2",
  color: "#DC2626",
  cursor: "pointer",
};

const iconBtn = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "2px 5px",
  border: "1px solid var(--admin-border)",
  borderRadius: 6,
  background: "var(--admin-bg)",
  color: "var(--admin-text)",
  cursor: "pointer",
};

const primaryBtnStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "10px 18px",
  background: "linear-gradient(135deg, #1e3a8a, #0284c7)",
  color: "white",
  border: "none",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 13,
};

const secondaryBtnStyle = {
  padding: "10px 16px",
  background: "var(--admin-bg)",
  color: "var(--admin-text)",
  border: "1px solid var(--admin-border)",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13,
};
