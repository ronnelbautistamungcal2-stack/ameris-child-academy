import AuthorizedPickupSection from "@/components/admin/AuthorizedPickupSection";
import { apiJson } from "@/lib/api";
import { MAX_EMERGENCY_CONTACTS, MAX_PARENT_CONTACTS } from "@/lib/child-contacts";
import {
  FOOD_GROUPS,
  FOOD_TEXTURES,
  FORMULA_OPTIONS,
  HEALTH_LIST_SIZE,
  PHYSICAL_MILESTONES,
  WEEKDAYS,
  emptySchedule,
  normalizeCarePlan,
  normalizeHealthInfo,
  normalizeSchedule,
} from "@/lib/childProfile";
import { userRoles } from "@/lib/roles";
import { useEffect, useRef, useState } from "react";

// Add / Edit Child (client mockups 07-04..11): Profile, Schedule, Contacts,
// Health & Safety, Documents, Authorized Pickup and Care Plan tabs. Admins
// edit everything; parents (mode="parent") change the photo and the contacts
// only and see the authorized pick-up list (client 07-01, B2-B4).

const NAVY = "text-[#0b2a5b] dark:text-blue-100";
const input = "w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm disabled:bg-gray-100 disabled:text-gray-500 dark:border-gray-600 dark:bg-gray-800";
const label = "block text-xs font-bold text-[#0b2a5b] dark:text-blue-100";
const band = "rounded-t-lg bg-blue-50 px-3 py-1.5 text-sm font-black text-[#0b2a5b] dark:bg-gray-800 dark:text-blue-100";
const box = "rounded-lg border border-blue-100 dark:border-gray-700";

const TABS = [
  { key: "profile", label: "Profile", icon: "👤" },
  { key: "schedule", label: "Schedule", icon: "📅" },
  { key: "contacts", label: "Contacts", icon: "👥" },
  { key: "health", label: "Health & Safety", icon: "❤️" },
  { key: "documents", label: "Documents", icon: "📄" },
  { key: "pickup", label: "Authorized Pickup", icon: "🧑‍🤝‍🧑" },
  { key: "care", label: "Care Plan", icon: "📋" },
];
const PARENT_TABS = ["profile", "contacts", "pickup"];

const DOCUMENT_TYPES = [
  { field: "healthAssessmentDocuments", label: "Health Assessment" },
  { field: "enrollmentDocuments", label: "Enrollment Documents" },
  { field: "iefDocuments", label: "IEF" },
  { field: "immunizationDocuments", label: "Immunizations" },
  { field: "infantDocuments", label: "Infant Documents" },
  { field: "otherDocuments", label: "Other" },
];

const dateInput = (value) => (value ? new Date(value).toISOString().slice(0, 10) : "");

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function upload(file) {
  const saved = await apiJson("/api/v1/uploads", {
    method: "POST",
    body: JSON.stringify({ filename: file.name, mimeType: file.type, dataBase64: await fileToBase64(file) }),
  });
  return { ...saved, originalName: saved.originalName || file.name, uploadedAt: new Date().toISOString() };
}

function contactsOf(list, size, blank) {
  const source = Array.isArray(list) ? list : [];
  return Array.from({ length: size }, (_, i) => ({ ...blank(i), ...(source[i] || {}) }));
}

function formFromChild(child, defaults) {
  const docs = {};
  const expirations = {};
  for (const t of DOCUMENT_TYPES) {
    const list = Array.isArray(child?.[t.field]) ? child[t.field] : [];
    docs[t.field] = list;
    expirations[t.field] = dateInput(list.find((d) => d?.expirationDate)?.expirationDate);
  }
  const linked = [child?.parentId, ...(child?.guardians || []).map((g) => g.guardianId)].filter(Boolean);
  return {
    photoUrl: child?.photoUrl || "",
    firstName: child?.firstName || "",
    lastName: child?.lastName || "",
    birthDate: dateInput(child?.birthDate),
    enrollmentStartDate: dateInput(child?.enrollmentStartDate),
    enrollmentEndDate: dateInput(child?.enrollmentEndDate),
    centerId: child?.centerId || defaults.centerId || "",
    classRoomId: child?.classRoomId || "",
    parentAccountIds: [linked[0] || "", [...new Set(linked)][1] || ""],
    schedule: normalizeSchedule(child?.schedule),
    parentContacts: contactsOf(child?.parentContacts, MAX_PARENT_CONTACTS, (i) => ({ label: `Parent ${i + 1}`, name: "", relationship: "", address: "", email: "", phone: "" })),
    emergencyContacts: contactsOf(child?.emergencyContacts, MAX_EMERGENCY_CONTACTS, (i) => ({ label: `Emergency ${i + 1}`, name: "", phone: "", address: "" })),
    outOfAreaContact: { name: "", phone: "", address: "", ...(child?.outOfAreaContact || {}) },
    healthInfo: (() => {
      const h = normalizeHealthInfo(child?.healthInfo);
      if (!h.allergies.length && child?.allergies) h.allergies = String(child.allergies).split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
      return h;
    })(),
    docs,
    expirations,
    carePlan: normalizeCarePlan(child?.carePlan),
  };
}

export default function EditChildDialog({ childId, mode = "admin", defaultCenterId = "", onClose, onSaved }) {
  const isParent = mode === "parent";
  const isNew = !childId;
  const [tab, setTab] = useState("profile");
  const [loaded, setLoaded] = useState(isNew);
  const [form, setForm] = useState(() => formFromChild(null, { centerId: defaultCenterId }));
  const [centers, setCenters] = useState([]);
  const [classes, setClasses] = useState([]);
  const [parents, setParents] = useState([]);
  const [siblings, setSiblings] = useState([]);
  const [newFiles, setNewFiles] = useState({});
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState("");
  const photoRef = useRef(null);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    if (!childId) return;
    apiJson(`/api/v1/children/${childId}`)
      .then((child) => {
        setForm(formFromChild(child, {}));
        setLoaded(true);
      })
      .catch((e) => setError(e.message || "Failed to load the child"));
  }, [childId]);

  useEffect(() => {
    if (isParent) return;
    Promise.all([apiJson("/api/v1/centers"), apiJson("/api/v1/users")])
      .then(([c, u]) => {
        setCenters(Array.isArray(c) ? c : []);
        setParents((Array.isArray(u) ? u : []).filter((user) => userRoles(user).includes("PARENT")).sort((a, b) => String(a.name || a.email).localeCompare(String(b.name || b.email))));
      })
      .catch(() => {});
  }, [isParent]);

  useEffect(() => {
    if (isParent || !form.centerId) return;
    Promise.all([
      apiJson(`/api/v1/classes?centerId=${encodeURIComponent(form.centerId)}`),
      apiJson(`/api/v1/children?centerId=${encodeURIComponent(form.centerId)}`),
    ])
      .then(([c, kids]) => {
        setClasses(Array.isArray(c) ? c : []);
        setSiblings((Array.isArray(kids) ? kids : []).filter((k) => k.id !== childId));
      })
      .catch(() => {});
  }, [isParent, form.centerId, childId]);

  const tabs = TABS.filter((t) => !isParent || PARENT_TABS.includes(t.key));

  async function changePhoto(file) {
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const saved = await upload(file);
      set({ photoUrl: saved.url });
    } catch (e) {
      setError(e.message || "Photo upload failed");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      if (isParent) {
        await apiJson(`/api/v1/children/${childId}/family`, {
          method: "PUT",
          body: JSON.stringify({ parentContacts: form.parentContacts, emergencyContacts: form.emergencyContacts, outOfAreaContact: form.outOfAreaContact }),
        });
        await apiJson(`/api/v1/children/${childId}/snapshot`, { method: "PUT", body: JSON.stringify({ photoUrl: form.photoUrl || null }) });
      } else {
        if (!form.firstName.trim() || !form.lastName.trim() || !form.birthDate || !form.enrollmentStartDate || !form.centerId || !form.classRoomId || !form.parentAccountIds[0]) {
          setTab("profile");
          throw new Error("Fill in the required fields on the Profile tab.");
        }
        if (!form.parentContacts[0].name.trim()) {
          setTab("contacts");
          throw new Error("Parent 1's name is required.");
        }
        if (!form.emergencyContacts[0].name.trim() || !form.emergencyContacts[0].phone.trim()) {
          setTab("contacts");
          throw new Error("Emergency Contact 1 needs a name and phone.");
        }
        const documents = {};
        for (const t of DOCUMENT_TYPES) {
          const added = [];
          for (const file of newFiles[t.field] || []) added.push(await upload(file));
          const expirationDate = form.expirations[t.field] || null;
          const kept = form.docs[t.field].filter((d) => d?.url);
          const all = [...kept, ...added].map((d) => ({ ...d, documentType: d.documentType || t.label, expirationDate, isManualEntry: false }));
          documents[t.field] = all.length
            ? all
            : expirationDate
              ? [{ url: null, originalName: `${t.label} expiration`, documentType: t.label, expirationDate, isManualEntry: true }]
              : [];
        }
        const body = {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          birthDate: form.birthDate,
          enrollmentStartDate: form.enrollmentStartDate,
          enrollmentEndDate: form.enrollmentEndDate || null,
          centerId: form.centerId,
          classRoomId: form.classRoomId,
          parentAccountIds: form.parentAccountIds.filter(Boolean),
          photoUrl: form.photoUrl || null,
          schedule: form.schedule,
          parentContacts: form.parentContacts,
          emergencyContacts: form.emergencyContacts,
          outOfAreaContact: form.outOfAreaContact,
          healthInfo: form.healthInfo,
          carePlan: form.carePlan,
          ...documents,
        };
        const saved = isNew
          ? await apiJson("/api/v1/children", { method: "POST", body: JSON.stringify(body) })
          : await apiJson(`/api/v1/children/${childId}`, { method: "PUT", body: JSON.stringify(body) });
        if (isNew && saved?.id) {
          await onSaved(saved);
          return;
        }
      }
      await onSaved();
    } catch (e) {
      setError(e.message || "Failed to save");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 px-3 py-6" role="dialog" aria-modal="true" aria-label={isNew ? "Add Child" : "Edit Child"}>
      <div className="w-full max-w-6xl rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
        <div className="flex items-center justify-between px-6 pt-5">
          <h2 className={`text-2xl font-black ${NAVY}`}>✎ {isNew ? "Add Child" : "Edit Child"}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-3xl leading-none text-gray-500 hover:text-gray-800">×</button>
        </div>
        <div role="tablist" className="mx-6 mt-3 grid grid-cols-2 gap-1 rounded-lg border border-gray-200 p-1 sm:grid-cols-4 lg:grid-cols-7 dark:border-gray-700">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-sm font-semibold ${tab === t.key ? "border-b-2 border-blue-600 bg-blue-50 text-[#0b2a5b] dark:bg-gray-800 dark:text-blue-100" : "text-[#0b2a5b] hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"}`}
            >
              <span aria-hidden="true">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        <div className="max-h-[68vh] overflow-y-auto px-6 py-4">
          {error ? <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
          {!loaded ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : tab === "profile" ? (
            <ProfileTab form={form} set={set} isParent={isParent} centers={centers} classes={classes} parents={parents} photoRef={photoRef} uploadingPhoto={uploadingPhoto} onPhoto={changePhoto} />
          ) : tab === "schedule" ? (
            <ScheduleTab form={form} set={set} siblings={siblings} centerId={form.centerId} />
          ) : tab === "contacts" ? (
            <ContactsTab form={form} set={set} siblings={isParent ? [] : siblings} />
          ) : tab === "health" ? (
            <HealthTab form={form} set={set} />
          ) : tab === "documents" ? (
            <DocumentsTab form={form} set={set} newFiles={newFiles} setNewFiles={setNewFiles} />
          ) : tab === "pickup" ? (
            isNew ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Save the child first, then add the people authorized to pick them up.</p>
            ) : isParent ? (
              <PickupList childId={childId} />
            ) : (
              <AuthorizedPickupSection childId={childId} centerId={form.centerId} otherChildren={siblings} />
            )
          ) : (
            <CarePlanTab form={form} set={set} />
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
          <button type="button" onClick={onClose} className="rounded-lg border border-blue-300 px-6 py-2 text-sm font-bold text-[#0b2a5b] dark:text-blue-100">Cancel</button>
          <button type="button" onClick={save} disabled={saving || !loaded} className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
            💾 {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon, children, className = "" }) {
  return (
    <section className={`${box} ${className}`}>
      <div className={band}>
        {icon ? <span aria-hidden="true" className="mr-1.5">{icon}</span> : null}
        {title}
      </div>
      <div className="p-3">{children}</div>
    </section>
  );
}

function ProfileTab({ form, set, isParent, centers, classes, parents, photoRef, uploadingPhoto, onPhoto }) {
  const req = isParent ? null : <span className="text-red-500"> *</span>;
  return (
    <Section title="Basic Information">
      <div className="grid gap-5 md:grid-cols-[180px_1fr]">
        <div className="flex flex-col items-center gap-2">
          {form.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.photoUrl} alt="" className="h-36 w-36 rounded-full object-cover" />
          ) : (
            <div className="flex h-36 w-36 items-center justify-center rounded-full bg-blue-100 text-4xl font-black text-blue-800">
              {(form.firstName[0] || "?").toUpperCase()}
            </div>
          )}
          <button type="button" onClick={() => photoRef.current?.click()} disabled={uploadingPhoto} className="w-full rounded-lg border border-blue-300 px-3 py-1.5 text-sm font-semibold text-blue-700">
            📷 {uploadingPhoto ? "Uploading..." : "Change Photo"}
          </button>
          {form.photoUrl ? (
            <button type="button" onClick={() => set({ photoUrl: "" })} className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold">🗑 Remove Photo</button>
          ) : null}
          <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className={label}>First Name{req}<input value={form.firstName} disabled={isParent} onChange={(e) => set({ firstName: e.target.value })} className={input} /></label>
          <label className={label}>Last Name{req}<input value={form.lastName} disabled={isParent} onChange={(e) => set({ lastName: e.target.value })} className={input} /></label>
          <label className={label}>Birth Date{req}<input type="date" value={form.birthDate} disabled={isParent} onChange={(e) => set({ birthDate: e.target.value })} className={input} /></label>
          <label className={label}>Enrollment Start Date{req}<input type="date" value={form.enrollmentStartDate} disabled={isParent} onChange={(e) => set({ enrollmentStartDate: e.target.value })} className={input} /></label>
          {isParent ? null : (
            <>
              <label className={label}>
                Center{req}
                <select value={form.centerId} onChange={(e) => set({ centerId: e.target.value, classRoomId: "" })} className={input}>
                  <option value="">Select a center...</option>
                  {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label className={label}>
                Enrollment End Date
                <input type="date" value={form.enrollmentEndDate} onChange={(e) => set({ enrollmentEndDate: e.target.value })} className={input} />
              </label>
              <label className={label}>
                Classroom{req}
                <select value={form.classRoomId} onChange={(e) => set({ classRoomId: e.target.value })} className={input}>
                  <option value="">Select a classroom...</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              {[0, 1].map((i) => (
                <label key={i} className={label}>
                  Linked Parent Account {i + 1}
                  {i === 0 ? req : <span className="font-normal text-gray-500"> (Optional)</span>}
                  <select
                    value={form.parentAccountIds[i]}
                    onChange={(e) => {
                      const next = [...form.parentAccountIds];
                      next[i] = e.target.value;
                      set({ parentAccountIds: next });
                    }}
                    className={input}
                  >
                    <option value="">Select a parent account...</option>
                    {parents.map((p) => <option key={p.id} value={p.id}>{p.name || p.email}</option>)}
                  </select>
                </label>
              ))}
            </>
          )}
        </div>
      </div>
      {isParent ? <p className="mt-3 text-xs text-gray-500">The center keeps the profile details up to date; you can change the photo.</p> : null}
    </Section>
  );
}

function ScheduleTab({ form, set, siblings, centerId }) {
  const [copyFrom, setCopyFrom] = useState("");
  const [error, setError] = useState("");
  const setDay = (key, patch) => set({ schedule: { ...form.schedule, [key]: { ...form.schedule[key], ...patch } } });

  async function copySchedule() {
    if (!copyFrom) return;
    try {
      const child = await apiJson(`/api/v1/children/${copyFrom}`);
      set({ schedule: normalizeSchedule(child.schedule) });
      setCopyFrom("");
    } catch (e) {
      setError(e.message || "Could not copy that schedule");
    }
  }

  async function openingClosing() {
    setError("");
    try {
      const center = await apiJson(`/api/v1/centers/${centerId}`);
      const hours = center?.careSchedule && typeof center.careSchedule === "object" ? center.careSchedule : {};
      const next = {};
      for (const d of WEEKDAYS) {
        const h = hours[d.key.toLowerCase()] || {};
        next[d.key] = h.open ? { attends: true, dropOff: h.start || "", pickUp: h.end || "" } : { attends: false, dropOff: "", pickUp: "" };
      }
      set({ schedule: normalizeSchedule(next) });
    } catch (e) {
      setError(e.message || "Could not load the center's hours");
    }
  }

  return (
    <Section title="Schedule" icon="📅">
      <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">⚠ Children will only be able to attend during scheduled times.</p>
      {error ? <p className="mb-2 text-sm text-red-600">{error}</p> : null}
      <table className="min-w-full text-sm">
        <thead className="bg-blue-50 text-left text-[#0b2a5b] dark:bg-gray-800 dark:text-blue-100">
          <tr>{["Day", "Attends", "Drop-off Time", "Pick-up Time"].map((h) => <th key={h} className="px-3 py-2 font-bold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {WEEKDAYS.map((d) => {
            const row = form.schedule[d.key];
            return (
              <tr key={d.key}>
                <td className="px-3 py-1.5 font-semibold text-[#0b2a5b] dark:text-blue-100">{d.label}</td>
                <td className="px-3 py-1.5">
                  <input type="checkbox" checked={row.attends} onChange={(e) => setDay(d.key, e.target.checked ? { attends: true } : { attends: false, dropOff: "", pickUp: "" })} aria-label={`${d.label} attends`} className="h-4 w-4" />
                </td>
                <td className="px-3 py-1.5"><input type="time" value={row.dropOff} disabled={!row.attends} onChange={(e) => setDay(d.key, { dropOff: e.target.value })} aria-label={`${d.label} drop-off`} className={`${input} max-w-[10rem]`} /></td>
                <td className="px-3 py-1.5"><input type="time" value={row.pickUp} disabled={!row.attends} onChange={(e) => setDay(d.key, { pickUp: e.target.value })} aria-label={`${d.label} pick-up`} className={`${input} max-w-[10rem]`} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)} aria-label="Copy schedule from" className={`${input} max-w-xs`}>
          <option value="">Copy from another child...</option>
          {siblings.map((c) => <option key={c.id} value={c.id}>{[c.firstName, c.lastName].filter(Boolean).join(" ")}</option>)}
        </select>
        <button type="button" onClick={copySchedule} disabled={!copyFrom} className="rounded-lg border border-blue-300 px-3 py-1.5 text-sm font-semibold text-blue-700 disabled:opacity-50">⧉ Copy from Another Child</button>
        <button type="button" onClick={() => set({ schedule: emptySchedule() })} className="rounded-lg border border-blue-300 px-3 py-1.5 text-sm font-semibold text-blue-700">↻ Reset Schedule</button>
        <button type="button" onClick={openingClosing} disabled={!centerId} className="rounded-lg border border-blue-300 px-3 py-1.5 text-sm font-semibold text-blue-700 disabled:opacity-50">🕒 Set to Opening &amp; Closing</button>
      </div>
    </Section>
  );
}

function ContactsTab({ form, set, siblings }) {
  const [copyFrom, setCopyFrom] = useState("");
  const setRow = (key, i, patch) => set({ [key]: form[key].map((r, j) => (j === i ? { ...r, ...patch } : r)) });

  async function copyContacts() {
    if (!copyFrom) return;
    const child = await apiJson(`/api/v1/children/${copyFrom}`);
    set({
      parentContacts: contactsOf(child.parentContacts, MAX_PARENT_CONTACTS, (i) => ({ label: `Parent ${i + 1}`, name: "", relationship: "", address: "", email: "", phone: "" })),
      emergencyContacts: contactsOf(child.emergencyContacts, MAX_EMERGENCY_CONTACTS, (i) => ({ label: `Emergency ${i + 1}`, name: "", phone: "", address: "" })),
      outOfAreaContact: { name: "", phone: "", address: "", ...(child.outOfAreaContact || {}) },
    });
    setCopyFrom("");
  }

  const row = "grid grid-cols-[6rem_1fr] items-start gap-2";
  return (
    <div className="space-y-4">
      <Section title="Contacts" icon="👥">
        <div className="grid gap-3 md:grid-cols-2">
          {form.parentContacts.map((p, i) => (
            <div key={i} className={box}>
              <div className={band}>Parent {i + 1}</div>
              <div className="space-y-2 p-3">
                <label className={row}><span className={label}>Name{i === 0 ? <span className="text-red-500"> *</span> : null}</span><input value={p.name} onChange={(e) => setRow("parentContacts", i, { name: e.target.value })} className={input} /></label>
                <label className={row}><span className={label}>Relationship</span><input value={p.relationship || ""} onChange={(e) => setRow("parentContacts", i, { relationship: e.target.value })} placeholder="e.g. Mother" className={input} /></label>
                <label className={row}><span className={label}>Address</span><textarea rows={2} value={p.address || ""} onChange={(e) => setRow("parentContacts", i, { address: e.target.value })} className={input} /></label>
                <label className={row}><span className={label}>Email</span><input value={p.email} onChange={(e) => setRow("parentContacts", i, { email: e.target.value })} className={input} /></label>
                <label className={row}><span className={label}>Phone</span><input value={p.phone} onChange={(e) => setRow("parentContacts", i, { phone: e.target.value })} className={input} /></label>
              </div>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Emergency Contacts" icon="📞">
        <div className="grid gap-3 md:grid-cols-3">
          {form.emergencyContacts.map((c, i) => (
            <div key={i} className={box}>
              <div className={band}>Emergency Contact {i + 1}</div>
              <div className="space-y-2 p-3">
                <label className={row}><span className={label}>Name{i === 0 ? <span className="text-red-500"> *</span> : null}</span><input value={c.name} onChange={(e) => setRow("emergencyContacts", i, { name: e.target.value })} className={input} /></label>
                <label className={row}><span className={label}>Phone{i === 0 ? <span className="text-red-500"> *</span> : null}</span><input value={c.phone} onChange={(e) => setRow("emergencyContacts", i, { phone: e.target.value })} className={input} /></label>
                <label className={row}><span className={label}>Address</span><textarea rows={2} value={c.address || ""} onChange={(e) => setRow("emergencyContacts", i, { address: e.target.value })} className={input} /></label>
              </div>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Out of Area Emergency Contact" icon="📞">
        <div className="grid gap-3 md:grid-cols-3">
          {[["name", "Name"], ["phone", "Phone"], ["address", "Address"]].map(([key, text]) => (
            <label key={key} className={label}>
              {text}
              <input value={form.outOfAreaContact[key] || ""} onChange={(e) => set({ outOfAreaContact: { ...form.outOfAreaContact, [key]: e.target.value } })} className={input} />
            </label>
          ))}
        </div>
      </Section>
      {siblings.length ? (
        <div className="flex flex-wrap items-center gap-2">
          <select value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)} aria-label="Copy contacts from" className={`${input} max-w-xs`}>
            <option value="">Copy from another child...</option>
            {siblings.map((c) => <option key={c.id} value={c.id}>{[c.firstName, c.lastName].filter(Boolean).join(" ")}</option>)}
          </select>
          <button type="button" onClick={copyContacts} disabled={!copyFrom} className="rounded-lg border border-blue-300 px-3 py-1.5 text-sm font-semibold text-blue-700 disabled:opacity-50">⧉ Copy from Another Child</button>
        </div>
      ) : null}
    </div>
  );
}

function HealthTab({ form, set }) {
  const h = form.healthInfo;
  const setH = (patch) => set({ healthInfo: { ...h, ...patch } });
  const lines = (list) => Array.from({ length: Math.max(HEALTH_LIST_SIZE, list.length) }, (_, i) => list[i] || "");
  const setLine = (key, i, value) => {
    const next = lines(h[key]);
    next[i] = value;
    setH({ [key]: next });
  };
  return (
    <Section title="Health & Safety" icon="❤️">
      <div className="space-y-4">
        <div className={box}>
          <div className={band}>Permissions</div>
          <div className="grid gap-3 p-3 md:grid-cols-2">
            {[
              ["emergencyTreatmentPermission", "Emergency transportation & medical treatment permission:", "I give my permission for the provider to transport my child and/or seek medical treatment in the case of an emergency."],
              ["transportationPermission", "Transportation permission:", "I give my permission for the provider to transport my child for non-emergency purposes."],
            ].map(([key, title, body]) => (
              <label key={key} className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm dark:bg-gray-800">
                <input type="checkbox" checked={h[key]} onChange={(e) => setH({ [key]: e.target.checked })} className="mt-1 h-4 w-4" />
                <span><b className={NAVY}>{title}</b><br />{body}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {[["allergies", "Allergies and/or Food Sensitivities"], ["conditions", "Chronic Medical Conditions"]].map(([key, title]) => (
            <div key={key} className={box}>
              <div className={band}>{title}</div>
              <div className="space-y-1.5 p-3">
                {lines(h[key]).map((value, i) => (
                  <label key={i} className="flex items-center gap-2 text-sm">
                    <span className="w-5 text-right font-semibold">{i + 1}.</span>
                    <input value={value} onChange={(e) => setLine(key, i, e.target.value)} aria-label={`${title} ${i + 1}`} className={input} />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className={box}>
          <div className={band}>Pediatrician</div>
          <div className="grid gap-3 p-3 md:grid-cols-2">
            <label className={label}>Name<input value={h.pediatrician.name} onChange={(e) => setH({ pediatrician: { ...h.pediatrician, name: e.target.value } })} className={input} /></label>
            <label className={label}>Phone<input value={h.pediatrician.phone} onChange={(e) => setH({ pediatrician: { ...h.pediatrician, phone: e.target.value } })} className={input} /></label>
          </div>
        </div>
        <div className={box}>
          <div className={band}>Additional Health Information <span className="font-normal text-gray-500">(Optional)</span></div>
          <div className="p-3">
            <textarea rows={3} value={h.notes} onChange={(e) => setH({ notes: e.target.value })} aria-label="Additional health information" className={input} />
          </div>
        </div>
      </div>
    </Section>
  );
}

function DocumentsTab({ form, set, newFiles, setNewFiles }) {
  return (
    <Section title="Documents" icon="📄">
      <table className="min-w-full text-sm">
        <thead className="bg-blue-50 text-left text-[#0b2a5b] dark:bg-gray-800 dark:text-blue-100">
          <tr>{["Document Type", "Attachment", "Expiration Date"].map((h) => <th key={h} className="px-3 py-2 font-bold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {DOCUMENT_TYPES.map((t) => {
            const existing = form.docs[t.field].filter((d) => d?.url);
            const pending = newFiles[t.field] || [];
            return (
              <tr key={t.field} className="align-top">
                <td className="px-3 py-2 font-semibold text-[#0b2a5b] dark:text-blue-100">{t.label}</td>
                <td className="px-3 py-2">
                  <input
                    type="file"
                    multiple
                    aria-label={`${t.label} file`}
                    onChange={(e) => setNewFiles((f) => ({ ...f, [t.field]: [...(f[t.field] || []), ...Array.from(e.target.files || [])] }))}
                    className="text-xs"
                  />
                  <ul className="mt-1 space-y-0.5 text-xs">
                    {existing.map((d, i) => (
                      <li key={`${d.url}-${i}`} className="flex items-center gap-2">
                        <a href={d.url} target="_blank" rel="noreferrer" className="text-blue-700 underline">{d.originalName || "Document"}</a>
                        <button type="button" onClick={() => set({ docs: { ...form.docs, [t.field]: form.docs[t.field].filter((x) => x !== d) } })} className="text-red-600">Remove</button>
                      </li>
                    ))}
                    {pending.map((file, i) => (
                      <li key={`${file.name}-${i}`} className="flex items-center gap-2 text-gray-600">
                        {file.name} (to upload)
                        <button type="button" onClick={() => setNewFiles((f) => ({ ...f, [t.field]: f[t.field].filter((_, j) => j !== i) }))} className="text-red-600">Remove</button>
                      </li>
                    ))}
                  </ul>
                </td>
                <td className="px-3 py-2">
                  <input type="date" value={form.expirations[t.field]} onChange={(e) => set({ expirations: { ...form.expirations, [t.field]: e.target.value } })} aria-label={`${t.label} expiration`} className={`${input} max-w-[11rem]`} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Section>
  );
}

function PickupList({ childId }) {
  const [people, setPeople] = useState(null);
  useEffect(() => {
    apiJson(`/api/v1/children/${childId}/profile`)
      .then((p) => setPeople(p.family.authorizedPickup))
      .catch(() => setPeople([]));
  }, [childId]);
  return (
    <Section title="Authorized Pickup" icon="🧑‍🤝‍🧑">
      <p className="mb-2 text-sm text-gray-600">Contact the center to change who may pick up your child.</p>
      {people === null ? <p className="text-sm text-gray-500">Loading…</p> : people.length ? (
        <ul className="list-disc pl-5 text-sm">{people.map((p) => <li key={p}>{p}</li>)}</ul>
      ) : (
        <p className="text-sm text-gray-500">No one has been added yet.</p>
      )}
    </Section>
  );
}

function CarePlanTab({ form, set }) {
  const c = form.carePlan;
  const setC = (patch) => set({ carePlan: { ...c, ...patch } });
  const toggle = (list, value) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  const area = (key, rows = 2, aria) => <textarea rows={rows} value={c[key]} onChange={(e) => setC({ [key]: e.target.value })} aria-label={aria} className={input} />;
  return (
    <Section title="Care Plan" icon="📋">
      <div className="grid gap-3 lg:grid-cols-2">
        <Section title="Feeding Plan (Infants)" icon="🍼">
          <div className="grid gap-3 sm:grid-cols-2">
            <fieldset className="space-y-1.5 text-sm">
              <legend className={label}>Infant Formula Information</legend>
              {FORMULA_OPTIONS.map((o) => (
                <label key={o.value} className="flex items-start gap-2">
                  <input type="radio" name="formula-choice" checked={c.formulaChoice === o.value} onChange={() => setC({ formulaChoice: o.value })} className="mt-1" />
                  {o.label}
                </label>
              ))}
              <label className={label}>Infant formula brand/type<input value={c.formulaBrand} onChange={(e) => setC({ formulaBrand: e.target.value })} className={input} /></label>
            </fieldset>
            <div className="space-y-2">
              <label className={label}>How does your baby let you know they are hungry?{area("hungerCues", 3)}</label>
              <div className="grid grid-cols-2 gap-2">
                <label className={label}>Number of bottles per day<input value={c.bottlesPerDay} onChange={(e) => setC({ bottlesPerDay: e.target.value })} className={input} /></label>
                <label className={label}>Number of ounces per bottle<input value={c.ouncesPerBottle} onChange={(e) => setC({ ouncesPerBottle: e.target.value })} className={input} /></label>
              </div>
            </div>
          </div>
        </Section>
        <Section title="Solid Foods (Infants)" icon="🍴">
          <div className="flex flex-wrap gap-6 text-sm">
            <fieldset>
              <legend className={label}>Is your child eating solid foods?</legend>
              {[[true, "Yes"], [false, "No"]].map(([v, t]) => (
                <label key={t} className="mr-4"><input type="radio" name="solids" checked={c.eatingSolids === v} onChange={() => setC({ eatingSolids: v })} /> {t}</label>
              ))}
            </fieldset>
            <fieldset>
              <legend className={label}>Food Textures (check all that apply)</legend>
              {FOOD_TEXTURES.map((t) => (
                <label key={t} className="mr-3"><input type="checkbox" checked={c.textures.includes(t)} onChange={() => setC({ textures: toggle(c.textures, t) })} /> {t}</label>
              ))}
            </fieldset>
          </div>
          <div className={`mt-2 ${label}`}>Foods Currently Eaten (check all that apply)</div>
          <div className="mt-1 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {FOOD_GROUPS.map((g) => (
              <div key={g.key} className="rounded-md border border-gray-200 p-2 text-xs dark:border-gray-700">
                <div className="mb-1 font-bold">{g.label}</div>
                {g.items.map((item) => (
                  <label key={item} className="block">
                    <input type="checkbox" checked={c.foods[g.key].includes(item)} onChange={() => setC({ foods: { ...c.foods, [g.key]: toggle(c.foods[g.key], item) } })} /> {item}
                  </label>
                ))}
                <input value={c.foods[`${g.key}Other`]} onChange={(e) => setC({ foods: { ...c.foods, [`${g.key}Other`]: e.target.value } })} placeholder="Other" aria-label={`${g.label} other`} className={`${input} mt-1`} />
              </div>
            ))}
          </div>
          <label className={`mt-2 ${label}`}>Other foods your child eats<input value={c.otherFoods} onChange={(e) => setC({ otherFoods: e.target.value })} className={input} /></label>
        </Section>
        <Section title="Sleeping Habits (Infants)" icon="🛏">
          <div className="grid grid-cols-[10rem_1fr] gap-3">
            <label className={label}>Number of naps per day<input value={c.napsPerDay} onChange={(e) => setC({ napsPerDay: e.target.value })} className={input} /></label>
            <label className={label}>Napping schedule (approximate times)<input value={c.napSchedule} onChange={(e) => setC({ napSchedule: e.target.value })} className={input} /></label>
          </div>
        </Section>
        <Section title="Physical Development (Infants and Toddlers)" icon="🧸">
          <div className="text-sm">
            {PHYSICAL_MILESTONES.map((m) => (
              <label key={m} className="block"><input type="checkbox" checked={c.physicalMilestones.includes(m)} onChange={() => setC({ physicalMilestones: toggle(c.physicalMilestones, m) })} /> {m}</label>
            ))}
            <label className="mt-1 flex items-center gap-2">Other:<input value={c.physicalOther} onChange={(e) => setC({ physicalOther: e.target.value })} className={input} /></label>
          </div>
        </Section>
        <Section title="Toilet / Diapering (2–3 Years)" icon="🧷">
          <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
            <fieldset className="text-sm">
              <legend className={label}>Is your child in diapers?</legend>
              {[[true, "Yes"], [false, "No"]].map(([v, t]) => (
                <label key={t} className="mr-4"><input type="radio" name="diapers" checked={c.inDiapers === v} onChange={() => setC({ inDiapers: v })} /> {t}</label>
              ))}
            </fieldset>
            <label className={label}>Special diapering needs{area("diaperingNeeds")}</label>
          </div>
        </Section>
        <Section title="Comfort Items & Techniques" icon="❤️">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={label}>Special comfort items (blankets, pacifiers, etc.){area("comfortItems")}</label>
            <label className={label}>Special comforting techniques{area("comfortTechniques")}</label>
          </div>
        </Section>
        <Section title="Social Interaction" icon="👥">
          <div className="text-sm">
            <div className={label}>How does your child interact with others?</div>
            {[["NEEDS_PROMPTING", "Needs to be prompted"], ["ON_OWN", "Does so on their own"]].map(([v, t]) => (
              <label key={v} className="mr-4"><input type="checkbox" checked={c.socialStyle.includes(v)} onChange={() => setC({ socialStyle: toggle(c.socialStyle, v) })} /> {t}</label>
            ))}
            <label className={`mt-1 ${label}`}>Additional notes{area("socialNotes")}</label>
          </div>
        </Section>
        <Section title="Academic Development" icon="📖">
          <label className={label}>Current academic level(s){area("academicLevel")}</label>
        </Section>
        <Section title="Other Information" icon="✎" className="lg:col-span-2">
          <label className={label}>Other information you would like your provider to know about your child and their personality{area("otherInformation", 3)}</label>
        </Section>
      </div>
    </Section>
  );
}

export { DOCUMENT_TYPES };
