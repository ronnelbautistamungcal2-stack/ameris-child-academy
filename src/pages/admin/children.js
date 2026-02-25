import AdminLayout from "@/components/admin/AdminLayout";
import { childAgeGroup, ageInMonths } from "@/lib/ageUtils";
import { apiJson } from "@/lib/api";
import { useCallback, useEffect, useMemo, useState } from "react";

export default function AdminChildren() {
  const [children, setChildren] = useState([]);
  const [centers, setCenters] = useState([]);
  const [classes, setClasses] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [q, setQ] = useState("");
  const [ageFilter, setAgeFilter] = useState("");

  const [editing, setEditing] = useState(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [centerId, setCenterId] = useState("");
  const [classRoomId, setClassRoomId] = useState("");
  const [parentId, setParentId] = useState("");

  const [emergencyContact, setEmergencyContact] = useState("");
  const [allergies, setAllergies] = useState("");

  const [feedingFoods, setFeedingFoods] = useState("");
  const [feedingFormula, setFeedingFormula] = useState("");
  const [feedingBottlesPerDay, setFeedingBottlesPerDay] = useState("");
  const [feedingBottleNotes, setFeedingBottleNotes] = useState("");

  const [healthAssessmentDocuments, setHealthAssessmentDocuments] = useState(
    [],
  );
  const [enrollmentDocuments, setEnrollmentDocuments] = useState([]);
  const [healthAssessmentFiles, setHealthAssessmentFiles] = useState([]);
  const [enrollmentFiles, setEnrollmentFiles] = useState([]);

  const [stepsLoading, setStepsLoading] = useState(false);
  const [stepsError, setStepsError] = useState("");
  const [stepsPlans, setStepsPlans] = useState([]);
  const [stepsCompletions, setStepsCompletions] = useState([]);
  const [stepsDomain, setStepsDomain] = useState("");

  async function refresh() {
    setError("");
    setLoading(true);
    try {
      const [kids, c, cls, u] = await Promise.all([
        apiJson("/api/v1/children"),
        apiJson("/api/v1/centers"),
        apiJson("/api/v1/classes"),
        apiJson("/api/v1/users"),
      ]);
      setChildren(Array.isArray(kids) ? kids : []);
      setCenters(Array.isArray(c) ? c : []);
      setClasses(Array.isArray(cls) ? cls : []);
      setUsers(Array.isArray(u) ? u : []);
    } catch (e) {
      setError(e.message || "Failed to load children");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const parents = useMemo(() => {
    return users.filter((u) => u.role === "PARENT").sort((a, b) => (a.email || "").localeCompare(b.email || ""));
  }, [users]);

  const userById = useMemo(() => {
    return Object.fromEntries(users.map((u) => [u.id, u]));
  }, [users]);

  const centerById = useMemo(() => Object.fromEntries(centers.map((c) => [c.id, c])), [centers]);
  const classById = useMemo(() => Object.fromEntries(classes.map((c) => [c.id, c])), [classes]);


  const filteredSorted = useMemo(() => {
    const query = (q || "").trim().toLowerCase();
    return [...children]
      .filter((ch) => {
        if (!query) return true;
        const name = `${ch.firstName || ""} ${ch.lastName || ""}`.trim().toLowerCase();
        return name.includes(query) || String(ch.id || "").toLowerCase().includes(query);
      })
      .filter((ch) => (ageFilter ? childAgeGroup(ch) === ageFilter : true))
      .sort((a, b) => (a.firstName || "").localeCompare(b.firstName || ""));
  }, [children, q, ageFilter]);

  const completedAtByItemId = useMemo(() => {
    return Object.fromEntries(
      (stepsCompletions || []).map((c) => [c.itemId, c.completedAt]),
    );
  }, [stepsCompletions]);

  const allStepRows = useMemo(() => {
    const now = new Date();
    const rows = [];
    for (const plan of Array.isArray(stepsPlans) ? stepsPlans : []) {
      const start = plan?.periodStart ? new Date(plan.periodStart) : null;
      if (!start || Number.isNaN(start.getTime())) continue;
      const end = planEndDate(plan);
      for (const item of Array.isArray(plan.items) ? plan.items : []) {
        const completedAt = completedAtByItemId[item.id] || null;
        const domain = item?.lesson?.category?.name || "Other";
        rows.push({
          plan,
          item,
          domain,
          completedAt,
          isCompleted: !!completedAt,
          start,
          end,
          isUpcoming: start > now,
          isCurrent: end ? start <= now && now < end : start <= now,
          isOverdue: end ? now >= end && !completedAt : false,
        });
      }
    }

    return rows.sort((a, b) => {
      const ad = new Date(a.plan.periodStart).getTime();
      const bd = new Date(b.plan.periodStart).getTime();
      if (ad !== bd) return ad - bd;
      return Number(a.item.sortOrder || 0) - Number(b.item.sortOrder || 0);
    });
  }, [stepsPlans, completedAtByItemId]);

  const stepDomains = useMemo(() => {
    return [...new Set(allStepRows.map((r) => r.domain))].sort((a, b) =>
      a.localeCompare(b),
    );
  }, [allStepRows]);

  const stepRows = useMemo(() => {
    return stepsDomain ? allStepRows.filter((r) => r.domain === stepsDomain) : allStepRows;
  }, [allStepRows, stepsDomain]);

  const catchupRows = useMemo(() => {
    return stepRows.filter((r) => r.isOverdue);
  }, [stepRows]);

  const currentRows = useMemo(() => {
    return stepRows.filter((r) => r.isCurrent && !r.isCompleted);
  }, [stepRows]);

  const upcomingRows = useMemo(() => {
    return stepRows.filter((r) => r.isUpcoming && !r.isCompleted);
  }, [stepRows]);

  const resetForm = useCallback(() => {
    setEditing(null);
    setFirstName("");
    setLastName("");
    setBirthDate("");
    setCenterId("");
    setClassRoomId("");
    setParentId("");

    setEmergencyContact("");
    setAllergies("");

    setFeedingFoods("");
    setFeedingFormula("");
    setFeedingBottlesPerDay("");
    setFeedingBottleNotes("");

    setHealthAssessmentDocuments([]);
    setEnrollmentDocuments([]);
    setHealthAssessmentFiles([]);
    setEnrollmentFiles([]);
  }, []);

  const startEdit = useCallback((child) => {
    setEditing(child);
    setFirstName(child.firstName || "");
    setLastName(child.lastName || "");
    setBirthDate(child.birthDate ? child.birthDate.slice(0, 10) : "");
    setCenterId(child.centerId || "");
    setClassRoomId(child.classRoomId || "");
    setParentId(child.parentId || "");

    setEmergencyContact(child.emergencyContact || "");
    setAllergies(child.allergies || "");

    const feeding = child.feedingPlan && typeof child.feedingPlan === "object" ? child.feedingPlan : null;
    setFeedingFoods(feeding?.foods || "");
    setFeedingFormula(feeding?.formula || "");
    setFeedingBottlesPerDay(
      feeding?.bottlesPerDay === null || feeding?.bottlesPerDay === undefined
        ? ""
        : String(feeding.bottlesPerDay),
    );
    setFeedingBottleNotes(feeding?.bottleNotes || "");

    setHealthAssessmentDocuments(
      Array.isArray(child.healthAssessmentDocuments)
        ? child.healthAssessmentDocuments
        : [],
    );
    setEnrollmentDocuments(
      Array.isArray(child.enrollmentDocuments) ? child.enrollmentDocuments : [],
    );
    setHealthAssessmentFiles([]);
    setEnrollmentFiles([]);
  }, []);

  const openCreate = useCallback(() => {
    setError("");
    resetForm();
    setModalOpen(true);
  }, [resetForm]);

  const openEdit = useCallback(
    (child) => {
      setError("");
      startEdit(child);
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

  const isInfant = useMemo(() => {
    const months = ageInMonths(birthDate);
    return months !== null ? months < 12 : false;
  }, [birthDate]);

  function parseOptionalWholeNumber(value) {
    const trimmed = String(value || "").trim();
    if (!trimmed) return null;
    const num = Number(trimmed);
    if (!Number.isFinite(num) || !Number.isInteger(num)) {
      throw new Error("Must be a whole number.");
    }
    if (num < 0) throw new Error("Must be >= 0.");
    return num;
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.onload = () => {
        const result = String(reader.result || "");
        const idx = result.indexOf(",");
        if (idx === -1) return reject(new Error("Invalid file encoding"));
        resolve(result.slice(idx + 1));
      };
      reader.readAsDataURL(file);
    });
  }

  async function uploadFiles(files) {
    const arr = Array.isArray(files) ? files : [];
    const out = [];
    for (const f of arr) {
      const dataBase64 = await fileToBase64(f);
      const uploaded = await apiJson("/api/v1/uploads", {
        method: "POST",
        body: JSON.stringify({
          filename: f.name,
          mimeType: f.type,
          dataBase64,
        }),
      });
      out.push({ ...uploaded, uploadedAt: new Date().toISOString() });
    }
    return out;
  }

  function planEndDate(plan) {
    const start = plan?.periodStart ? new Date(plan.periodStart) : null;
    if (!start || Number.isNaN(start.getTime())) return null;
    const end = new Date(start);
    if (plan.period === "DAY") end.setDate(end.getDate() + 1);
    else if (plan.period === "WEEK") end.setDate(end.getDate() + 7);
    else end.setMonth(end.getMonth() + 1);
    return end;
  }

  useEffect(() => {
    if (!modalOpen || !editing?.id || !editing?.centerId) {
      setStepsPlans([]);
      setStepsCompletions([]);
      setStepsDomain("");
      setStepsError("");
      return;
    }

    (async () => {
      setStepsLoading(true);
      setStepsError("");
      try {
        const from = new Date();
        from.setHours(0, 0, 0, 0);
        from.setDate(from.getDate() - 60);

        const to = new Date();
        to.setHours(0, 0, 0, 0);
        to.setDate(to.getDate() + 60);

        const plansQs = new URLSearchParams({
          centerId: editing.centerId,
          from: from.toISOString(),
          to: to.toISOString(),
        });
        const completionsQs = new URLSearchParams({
          childId: editing.id,
          from: from.toISOString(),
          to: to.toISOString(),
        });

        const [plans, completions] = await Promise.all([
          apiJson(`/api/v1/milestone-checklists?${plansQs.toString()}`),
          apiJson(
            `/api/v1/milestone-checklists/completions?${completionsQs.toString()}`,
          ),
        ]);

        setStepsPlans(Array.isArray(plans) ? plans : []);
        setStepsCompletions(Array.isArray(completions) ? completions : []);
      } catch (e) {
        setStepsError(e.message || "Failed to load steps of progression");
        setStepsPlans([]);
        setStepsCompletions([]);
      } finally {
        setStepsLoading(false);
      }
    })();
  }, [modalOpen, editing?.id, editing?.centerId]);

  async function createChild(e) {
    e.preventDefault();
    setError("");
    try {
      const bottlesPerDay = parseOptionalWholeNumber(feedingBottlesPerDay);
      const newHealthDocs = await uploadFiles(healthAssessmentFiles);
      const newEnrollDocs = await uploadFiles(enrollmentFiles);
      await apiJson("/api/v1/children", {
        method: "POST",
        body: JSON.stringify({
          firstName,
          lastName: lastName || null,
          birthDate: birthDate || null,
          centerId,
          classRoomId: classRoomId || null,
          parentId: parentId || null,
          emergencyContact: emergencyContact || null,
          allergies: allergies || null,
          healthAssessmentDocuments: [
            ...(Array.isArray(healthAssessmentDocuments)
              ? healthAssessmentDocuments
              : []),
            ...newHealthDocs,
          ],
          enrollmentDocuments: [
            ...(Array.isArray(enrollmentDocuments) ? enrollmentDocuments : []),
            ...newEnrollDocs,
          ],
          feedingPlan: isInfant
            ? {
                foods: feedingFoods || null,
                formula: feedingFormula || null,
                bottlesPerDay,
                bottleNotes: feedingBottleNotes || null,
              }
            : null,
        }),
      });
      resetForm();
      setModalOpen(false);
      await refresh();
    } catch (e2) {
      setError(e2.message || "Failed to create child");
    }
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editing) return;
    setError("");
    try {
      const bottlesPerDay = parseOptionalWholeNumber(feedingBottlesPerDay);
      const newHealthDocs = await uploadFiles(healthAssessmentFiles);
      const newEnrollDocs = await uploadFiles(enrollmentFiles);
      await apiJson(`/api/v1/children/${editing.id}`, {
        method: "PUT",
        body: JSON.stringify({
          firstName,
          lastName: lastName || null,
          birthDate: birthDate || null,
          classRoomId: classRoomId || null,
          emergencyContact: emergencyContact || null,
          allergies: allergies || null,
          healthAssessmentDocuments: [
            ...(Array.isArray(healthAssessmentDocuments)
              ? healthAssessmentDocuments
              : []),
            ...newHealthDocs,
          ],
          enrollmentDocuments: [
            ...(Array.isArray(enrollmentDocuments) ? enrollmentDocuments : []),
            ...newEnrollDocs,
          ],
          feedingPlan: isInfant
            ? {
                foods: feedingFoods || null,
                formula: feedingFormula || null,
                bottlesPerDay,
                bottleNotes: feedingBottleNotes || null,
              }
            : null,
        }),
      });
      resetForm();
      setModalOpen(false);
      await refresh();
    } catch (e2) {
      setError(e2.message || "Failed to update child");
    }
  }

  async function deleteChild(id) {
    if (!confirm("Delete this child? This cannot be undone.")) return;
    setError("");
    try {
      await apiJson(`/api/v1/children/${id}`, { method: "DELETE" });
      await refresh();
    } catch (e2) {
      setError(e2.message || "Failed to delete child");
    }
  }

  async function setChecklistItemCompleted(itemId, completed) {
    if (!editing?.id) return;
    setStepsError("");
    try {
      const record = await apiJson("/api/v1/milestone-checklists/completions", {
        method: "POST",
        body: JSON.stringify({
          childId: editing.id,
          itemId,
          completed,
        }),
      });

      setStepsCompletions((cur) => {
        const arr = Array.isArray(cur) ? cur : [];
        const idx = arr.findIndex((c) => c.itemId === record.itemId);
        const next = { ...(idx >= 0 ? arr[idx] : {}), ...record };
        if (idx >= 0) return arr.map((c, i) => (i === idx ? next : c));
        return [...arr, next];
      });
    } catch (e) {
      setStepsError(e.message || "Failed to update completion");
    }
  }

  return (
    <AdminLayout title="Children">
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
            <h2 style={{ marginTop: 0 }}>Children</h2>
            <p style={{ color: "#6b7280", marginTop: 6 }}>
              Student setup: create/modify/delete child records and assign to
              center/class/parent.
            </p>
          </div>
          <button type="button" style={primaryButton} onClick={openCreate}>
            + Add Child
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 220px",
            gap: 10,
            marginTop: 12,
            maxWidth: 760,
          }}
        >
          <Field label="Search">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={inputStyle}
              placeholder="Search by name or ID"
            />
          </Field>
          <Field label="Age">
            <select
              value={ageFilter}
              onChange={(e) => setAgeFilter(e.target.value)}
              style={inputStyle}
            >
              <option value="">All ages</option>
              <option value="0-1">0-1 year</option>
              <option value="2">2 years</option>
              <option value="3">3 years</option>
              <option value="4-5">4-5 years</option>
              <option value="6-7">6-7 years</option>
              <option value="8-12">8-12 years</option>
              <option value="12+">12+ years</option>
              <option value="Unknown">Unknown</option>
            </select>
          </Field>
        </div>

        {error && !modalOpen ? <ErrorBanner message={error} /> : null}

        {modalOpen ? (
          <Modal
            title={editing ? "Edit Child" : "Add Child"}
            onClose={closeModal}
          >
            {error ? <ErrorBanner message={error} /> : null}

            <form onSubmit={editing ? saveEdit : createChild}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 10,
                }}
              >
                <Field label="First Name">
                  <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    style={inputStyle}
                    required
                  />
                </Field>
                <Field label="Last Name">
                  <input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    style={inputStyle}
                  />
                </Field>
                <Field label="Birth Date">
                  <input
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    style={inputStyle}
                    type="date"
                  />
                </Field>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 10,
                  marginTop: 10,
                }}
              >
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
                <Field label="Class">
                  <select
                    value={classRoomId}
                    onChange={(e) => setClassRoomId(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">(none)</option>
                    {classes
                      .filter((cl) => !centerId || cl.centerId === centerId)
                      .map((cl) => (
                        <option key={cl.id} value={cl.id}>
                          {cl.name}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label={editing ? "Parent (create only)" : "Parent"}>
                  <select
                    value={parentId}
                    onChange={(e) => setParentId(e.target.value)}
                    style={inputStyle}
                    disabled={!!editing}
                  >
                    <option value="">
                      {editing ? "(unchanged)" : "(none)"}
                    </option>
                    {parents.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.email}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 10,
                  marginTop: 10,
                }}
              >
                <Field label="Emergency Contact">
                  <input
                    value={emergencyContact}
                    onChange={(e) => setEmergencyContact(e.target.value)}
                    style={inputStyle}
                    placeholder="Name + phone"
                  />
                </Field>
                <Field label="Allergies">
                  <input
                    value={allergies}
                    onChange={(e) => setAllergies(e.target.value)}
                    style={inputStyle}
                    placeholder="e.g. peanuts, dairy"
                  />
                </Field>
              </div>

              {isInfant ? (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontWeight: 800, marginBottom: 8 }}>
                    Feeding (0-1 years)
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(220px, 1fr))",
                      gap: 10,
                    }}
                  >
                    <Field label="What they eat">
                      <input
                        value={feedingFoods}
                        onChange={(e) => setFeedingFoods(e.target.value)}
                        style={inputStyle}
                        placeholder="e.g. purees, solids"
                      />
                    </Field>
                    <Field label="Formula">
                      <input
                        value={feedingFormula}
                        onChange={(e) => setFeedingFormula(e.target.value)}
                        style={inputStyle}
                      />
                    </Field>
                    <Field label="# Bottles / day">
                      <input
                        value={feedingBottlesPerDay}
                        onChange={(e) =>
                          setFeedingBottlesPerDay(e.target.value)
                        }
                        style={inputStyle}
                        inputMode="numeric"
                        placeholder="e.g. 4"
                      />
                    </Field>
                    <Field label="Bottle notes (optional)">
                      <input
                        value={feedingBottleNotes}
                        onChange={(e) =>
                          setFeedingBottleNotes(e.target.value)
                        }
                        style={inputStyle}
                      />
                    </Field>
                  </div>
                </div>
              ) : null}

              <div style={{ marginTop: 14 }}>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>
                  Documents
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                    gap: 10,
                  }}
                >
                  <Field label="Health assessment (upload)">
                    <input
                      type="file"
                      onChange={(e) =>
                        setHealthAssessmentFiles(
                          Array.from(e.target.files || []),
                        )
                      }
                      style={inputStyle}
                    />
                    {healthAssessmentDocuments.length ? (
                      <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                        {healthAssessmentDocuments.map((d, idx) => (
                          <div
                            key={`${d?.url || "doc"}-${idx}`}
                            style={docRowStyle}
                          >
                            <a
                              href={d.url}
                              target="_blank"
                              rel="noreferrer"
                              style={docLinkStyle}
                            >
                              {d.originalName || d.url}
                            </a>
                            <button
                              type="button"
                              style={miniDangerButton}
                              onClick={() =>
                                setHealthAssessmentDocuments((cur) =>
                                  cur.filter((_, i) => i !== idx),
                                )
                              }
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </Field>

                  <Field label="Enrollment documents (upload)">
                    <input
                      type="file"
                      multiple
                      onChange={(e) =>
                        setEnrollmentFiles(Array.from(e.target.files || []))
                      }
                      style={inputStyle}
                    />
                    {enrollmentDocuments.length ? (
                      <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                        {enrollmentDocuments.map((d, idx) => (
                          <div
                            key={`${d?.url || "doc"}-${idx}`}
                            style={docRowStyle}
                          >
                            <a
                              href={d.url}
                              target="_blank"
                              rel="noreferrer"
                              style={docLinkStyle}
                            >
                              {d.originalName || d.url}
                            </a>
                            <button
                              type="button"
                              style={miniDangerButton}
                              onClick={() =>
                                setEnrollmentDocuments((cur) =>
                                  cur.filter((_, i) => i !== idx),
                                )
                              }
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </Field>
                </div>
              </div>

              {editing ? (
                <div style={{ marginTop: 14 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      justifyContent: "space-between",
                      gap: 10,
                      flexWrap: "wrap",
                      marginBottom: 8,
                    }}
                  >
                    <div style={{ fontWeight: 800 }}>Steps of Progression</div>
                    <label style={{ display: "block" }}>
                      <div
                        style={{
                          fontSize: 12,
                          color: "#6b7280",
                          marginBottom: 6,
                        }}
                      >
                        Filter by Domain
                      </div>
                      <select
                        value={stepsDomain}
                        onChange={(e) => setStepsDomain(e.target.value)}
                        style={inputStyle}
                      >
                        <option value="">All domains</option>
                        {stepDomains.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {stepsError ? (
                    <div style={stepsErrorStyle}>{stepsError}</div>
                  ) : null}

                  {stepsLoading ? (
                    <div style={{ color: "#6b7280", fontSize: 13 }}>
                      Loading stepsâ€¦
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
                      <StepsGroup
                        title="Catch-up plan (overdue)"
                        rows={catchupRows}
                        onToggle={setChecklistItemCompleted}
                      />
                      <StepsGroup
                        title="Current steps working on"
                        rows={currentRows}
                        onToggle={setChecklistItemCompleted}
                      />
                      <StepsGroup
                        title="Upcoming steps"
                        rows={upcomingRows}
                        onToggle={setChecklistItemCompleted}
                      />
                    </div>
                  )}
                </div>
              ) : null}

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 8,
                  marginTop: 16,
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
                  <th style={thStyle}>Age</th>
                  <th style={thStyle}>Center</th>
                  <th style={thStyle}>Class</th>
                  <th style={thStyle}>Parent</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSorted.map((ch) => (
                  <tr key={ch.id}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 700 }}>
                        {ch.firstName} {ch.lastName || ""}
                      </div>
                      <div style={{ color: "#6b7280", fontSize: 12 }}>
                        {ch.birthDate ? `Born ${new Date(ch.birthDate).toLocaleDateString()}` : "—"}
                      </div>
                      <div style={{ color: "#6b7280", fontSize: 12 }}>
                        <code style={codePill}>{ch.id}</code>
                      </div>
                    </td>
                    <td style={tdStyle}>{childAgeGroup(ch)}</td>
                    <td style={tdStyle}>{centerById[ch.centerId]?.name || ch.centerId || "—"}</td>
                    <td style={tdStyle}>
                      {ch.classRoomId
                        ? classById[ch.classRoomId]?.name || ch.classRoomId
                        : "—"}
                    </td>
                    <td style={tdStyle}>
                      {ch.parentId
                        ? userById[ch.parentId]?.email || ch.parentId
                        : "—"}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button type="button" style={secondaryButton} onClick={() => openEdit(ch)}>
                          Edit
                        </button>
                        <button type="button" style={dangerButton} onClick={() => deleteChild(ch.id)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredSorted.length === 0 ? (
                  <tr>
                    <td style={tdStyle} colSpan={6}>
                      No children found.
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
    <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 10, padding: 16 }}>
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

function StepsGroup({ title, rows, onToggle }) {
  const list = Array.isArray(rows) ? rows : [];
  return (
    <div style={stepsPanelStyle}>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>{title}</div>
      {list.length === 0 ? (
        <div style={{ color: "#6b7280", fontSize: 13 }}>No items.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
          {list.slice(0, 30).map((r) => {
            const due = r.end instanceof Date && !Number.isNaN(r.end.getTime())
              ? r.end
              : new Date(r.plan.periodStart);
            const dueLabel = `Due ${due.toLocaleDateString()}`;
            const status =
              r.isOverdue ? "Overdue" : r.isCurrent ? "Current" : "Upcoming";
            const statusStyle = r.isOverdue
              ? stepTag("danger")
              : r.isCurrent
                ? stepTag("info")
                : stepTag("muted");

            return (
              <label key={r.item.id} style={stepRowStyle}>
                <input
                  type="checkbox"
                  checked={!!r.isCompleted}
                  onChange={(e) => onToggle(r.item.id, e.target.checked)}
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800 }}>
                    {r.item.title || "Step"}
                  </div>
                  <div style={{ marginTop: 4, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span style={statusStyle}>{status}</span>
                    <span style={stepTag("muted")}>{r.domain}</span>
                    <span style={stepTag("muted")}>{dueLabel}</span>
                    <span style={stepTag("muted")}>
                      {r.plan.title || "Plan"}
                    </span>
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      )}
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
  verticalAlign: "top",
};

const codePill = {
  background: "#f3f4f6",
  padding: "2px 8px",
  borderRadius: 999,
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
  width: "min(1100px, 100%)",
  maxHeight: "min(86vh, 900px)",
  overflow: "auto",
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 16,
  boxShadow:
    "0 20px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.12)",
};

const docRowStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  padding: "8px 10px",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  background: "#f9fafb",
};

const docLinkStyle = {
  color: "#2563eb",
  textDecoration: "none",
  fontWeight: 700,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  maxWidth: "100%",
};

const stepsErrorStyle = {
  padding: 10,
  borderRadius: 10,
  background: "#fee2e2",
  color: "#991b1b",
  border: "1px solid #fecaca",
  marginBottom: 10,
  fontSize: 13,
};

const stepsPanelStyle = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 12,
  background: "white",
};

const stepRowStyle = {
  display: "grid",
  gridTemplateColumns: "18px 1fr",
  alignItems: "start",
  gap: 10,
  padding: "10px 12px",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  background: "#f9fafb",
  cursor: "pointer",
};

function stepTag(kind) {
  const base = {
    fontSize: 12,
    padding: "2px 8px",
    borderRadius: 999,
    border: "1px solid #e5e7eb",
    background: "#f3f4f6",
    color: "#374151",
    fontWeight: 800,
    whiteSpace: "nowrap",
  };
  if (kind === "danger") {
    return { ...base, border: "1px solid #fecaca", background: "#fee2e2", color: "#991b1b" };
  }
  if (kind === "info") {
    return { ...base, border: "1px solid #bfdbfe", background: "#dbeafe", color: "#1d4ed8" };
  }
  return base;
}

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

const miniDangerButton = {
  padding: "6px 8px",
  background: "#ef4444",
  color: "white",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 12,
};
