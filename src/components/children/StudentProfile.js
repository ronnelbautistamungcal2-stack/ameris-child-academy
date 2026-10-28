import EditChildDialog from "@/components/children/EditChildDialog";
import Skeleton from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import { SOP_STATUSES } from "@/lib/sop";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

// Student Profile (client mockups 07-01..03), shared by parents, teachers and
// admins. Parents edit Family Information and Emergency Contacts (in the Edit
// Child box, plus the photo) and About right on the page; teachers only view;
// admins get Edit Profile with every tab.

const NAVY = "text-[#0b2a5b] dark:text-blue-100";
const card = "rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900";

function age(birthDate) {
  if (!birthDate) return "";
  const b = new Date(birthDate);
  const now = new Date();
  let months = (now.getFullYear() - b.getUTCFullYear()) * 12 + (now.getMonth() - b.getUTCMonth());
  if (now.getDate() < b.getUTCDate()) months -= 1;
  return `${Math.floor(months / 12)}y ${months % 12}m`;
}

const longDate = (v) => (v ? new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "—");
const name = (c) => [c.firstName, c.lastName].filter(Boolean).join(" ");

function StatusBadge({ status }) {
  if (!status) return null;
  const meta = SOP_STATUSES.find((s) => s.value === status);
  return <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-bold ${meta?.pill || "bg-gray-100 text-gray-700"}`}>✓ {meta?.label || status}</span>;
}

function Photo({ child, size = "h-36 w-36 text-4xl" }) {
  if (child.photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={child.photoUrl} alt="" className={`${size} shrink-0 rounded-full object-cover`} />;
  }
  return <span className={`${size} flex shrink-0 items-center justify-center rounded-full bg-blue-100 font-black text-blue-800`}>{(child.firstName || "?")[0]}</span>;
}

function Row({ label, children }) {
  return (
    <div className="grid grid-cols-[8.5rem_1fr] gap-2 border-b border-gray-100 py-1.5 text-sm last:border-0 dark:border-gray-800">
      <span className="font-semibold text-[#0b2a5b] dark:text-blue-100">{label}</span>
      <span className="text-gray-700 dark:text-gray-300">{children || "—"}</span>
    </div>
  );
}

function CardHeader({ icon, title, onEdit }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h2 className={`flex items-center gap-2 text-lg font-black ${NAVY}`}>
        <span aria-hidden="true">{icon}</span>
        {title}
      </h2>
      {onEdit ? <button type="button" onClick={onEdit} className="text-sm font-semibold text-blue-700 hover:underline">Edit</button> : null}
    </div>
  );
}

export default function StudentProfile({ childId, backHref, backLabel, title = "Student Profile", hrefFor }) {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null); // "admin" | "parent"
  const [aboutDraft, setAboutDraft] = useState(null);
  const [savingAbout, setSavingAbout] = useState(false);

  const load = useCallback(async () => {
    if (!childId) return;
    try {
      setProfile(await apiJson(`/api/v1/children/${childId}/profile`));
      setError("");
    } catch (e) {
      setError(e.message || "Failed to load the profile");
    }
  }, [childId]);

  useEffect(() => {
    setProfile(null);
    setAboutDraft(null);
    load();
  }, [load]);

  async function saveAbout() {
    setSavingAbout(true);
    try {
      await apiJson(`/api/v1/children/${childId}/snapshot`, { method: "PUT", body: JSON.stringify(aboutDraft) });
      setAboutDraft(null);
      await load();
    } catch (e) {
      setError(e.message || "Failed to save");
    } finally {
      setSavingAbout(false);
    }
  }

  if (error && !profile) return <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>;
  if (!profile) return <Skeleton count={8} />;
  const { child, classroom, family, emergency, about, access } = profile;
  const first = child.firstName;
  const canFamily = access.editFamily && !access.editAll;
  const ABOUT_FIELDS = [
    ["favoriteActivities", "Interests"],
    ["strengths", "Strengths"],
    ["areasOfFocus", "Areas for Growth"],
    ["allergies", "Allergies"],
    ["medicalInfo", "Medical Information", true],
    ["languages", "Languages"],
    ["additionalNotes", "Additional Notes", true],
    ["snapshotNotes", "Profile Description", false, true],
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {backHref ? <Link href={backHref} className="text-sm font-semibold text-blue-700 hover:underline">← {backLabel}</Link> : null}
          <h1 className={`text-3xl font-black ${NAVY}`}>{title}</h1>
        </div>
        <div className="flex items-center gap-2">
          {access.editAll ? (
            <button type="button" onClick={() => setEditing("admin")} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">✎ Edit Profile</button>
          ) : null}
        </div>
      </div>

      {profile.switcher.length > 1 ? (
        <nav aria-label="Children" className="flex gap-3 overflow-x-auto pb-1">
          {profile.switcher.map((c) => (
            <Link
              key={c.id}
              href={hrefFor(c.id)}
              aria-current={c.id === child.id ? "page" : undefined}
              className={`flex w-16 shrink-0 flex-col items-center gap-1 rounded-lg p-1 text-xs font-semibold ${c.id === child.id ? "ring-2 ring-blue-500" : ""} ${NAVY}`}
            >
              <Photo child={c} size="h-12 w-12 text-base" />
              <span className="w-full truncate text-center">{c.firstName}</span>
            </Link>
          ))}
        </nav>
      ) : null}

      <div className={`${card} grid gap-4 lg:grid-cols-[auto_1fr_1fr_1fr] lg:items-center`}>
        <Photo child={child} />
        <div className="space-y-0.5 text-sm text-[#0b2a5b] dark:text-blue-100">
          <div className="text-2xl font-black text-blue-700 dark:text-blue-300">{name(child)}</div>
          <div>Age: {age(child.birthDate)} &nbsp;|&nbsp; Date of Birth: {longDate(child.birthDate)}</div>
          <div>Classroom: {classroom.name || "—"}</div>
          <div>Teacher: {classroom.teachers.join(", ") || "—"}</div>
          <div>Enrollment Date: {longDate(child.enrollmentStartDate)}</div>
          <div className="pt-1"><StatusBadge status={classroom.status} /></div>
        </div>
        <blockquote className="rounded-xl bg-blue-50 p-4 text-sm italic text-[#0b2a5b] dark:bg-gray-800 dark:text-blue-100">
          {profile.snapshot || `Nothing has been shared about ${first} yet.`}
        </blockquote>
        <div className="rounded-xl bg-red-50 p-4 dark:bg-red-950/30">
          <div className="mb-1 flex items-center gap-2 text-lg font-black text-[#0b2a5b] dark:text-red-100">🚩 Red Flags</div>
          {profile.redFlags.length ? (
            <ul className="space-y-1 text-sm text-[#0b2a5b] dark:text-red-100">
              {profile.redFlags.map((f, i) => (
                <li key={i} className="flex items-start gap-2"><span aria-hidden="true" className="text-red-600">⚠</span>{f.text}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-600 dark:text-gray-300">None</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className={card}>
          <CardHeader icon="👥" title="Family Information" onEdit={canFamily ? () => setEditing("parent") : null} />
          {family.parents.length ? family.parents.map((p, i) => (
            <div key={i} className="mb-3 text-sm">
              <div className="font-bold text-[#0b2a5b] dark:text-blue-100">Parent/Guardian {i + 1}</div>
              <div>{p.name}{p.relationship ? ` (${p.relationship})` : ""}</div>
              {p.phone ? <div>📞 {p.phone}</div> : null}
              {p.email ? <div>✉ {p.email}</div> : null}
            </div>
          )) : <p className="text-sm text-gray-500">No family contacts yet.</p>}
          <div className="mb-3 text-sm">
            <div className="font-bold text-[#0b2a5b] dark:text-blue-100">Home Address</div>
            <div className="whitespace-pre-line">{family.parents.find((p) => p.address)?.address || "—"}</div>
          </div>
          <div className="text-sm">
            <div className="font-bold text-[#0b2a5b] dark:text-blue-100">Authorized Pick-Up</div>
            <div>{family.authorizedPickup.join(", ") || "—"}</div>
          </div>
        </section>

        <div className="space-y-4">
          <section className={card}>
            <CardHeader icon="🏫" title="Classroom Information" />
            <Row label="Classroom">{classroom.name}</Row>
            <Row label="Teacher">{classroom.teachers.join(", ")}</Row>
            <Row label="Schedule">{classroom.schedule}</Row>
            <Row label="Start Date">{longDate(classroom.startDate)}</Row>
            <Row label="Current Status">{classroom.status ? <StatusBadge status={classroom.status} /> : "—"}</Row>
          </section>
          <section className={card}>
            <CardHeader icon="➕" title="Emergency Contacts" onEdit={canFamily ? () => setEditing("parent") : null} />
            {["Primary Contact", "Secondary Contact", "Third Contact"].map((label, i) =>
              emergency.contacts[i] || i < 2 ? (
                <Row key={label} label={label}>
                  {emergency.contacts[i] ? <>{emergency.contacts[i].name}<br />{emergency.contacts[i].phone}</> : null}
                </Row>
              ) : null,
            )}
            {emergency.outOfArea ? <Row label="Out of Area">{emergency.outOfArea.name}<br />{emergency.outOfArea.phone}</Row> : null}
            <Row label="Pediatrician">{emergency.pediatrician?.name ? <>{emergency.pediatrician.name}<br />{emergency.pediatrician.phone}</> : null}</Row>
            <Row label="Emergency Notes">{profile.healthInfo?.notes || "No additional notes."}</Row>
          </section>
        </div>

        <section className={card}>
          <CardHeader icon="👤" title={`About ${first}`} onEdit={access.editFamily && !aboutDraft ? () => setAboutDraft({ favoriteActivities: about.favoriteActivities, strengths: about.strengths, areasOfFocus: about.areasOfFocus, allergies: about.allergies, languages: about.languages, snapshotNotes: about.snapshotNotes }) : null} />
          {ABOUT_FIELDS.map(([key, label, readOnly, editOnly]) =>
            editOnly && !aboutDraft ? null : aboutDraft && !readOnly ? (
              <label key={key} className="mb-2 block text-sm">
                <span className="font-semibold text-[#0b2a5b] dark:text-blue-100">{label}</span>
                <textarea
                  rows={key === "snapshotNotes" ? 3 : 2}
                  value={aboutDraft[key] || ""}
                  onChange={(e) => setAboutDraft((d) => ({ ...d, [key]: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800"
                />
              </label>
            ) : (
              <Row key={key} label={label}>{about[key]}</Row>
            ),
          )}
          {aboutDraft ? (
            <div className="mt-2 flex justify-end gap-2">
              <button type="button" onClick={() => setAboutDraft(null)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold">Cancel</button>
              <button type="button" onClick={saveAbout} disabled={savingAbout} className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-bold text-white disabled:opacity-60">{savingAbout ? "Saving..." : "Save"}</button>
            </div>
          ) : null}
          {aboutDraft ? <p className="mt-1 text-xs text-gray-500">The profile description is the short quote shown at the top of the profile.</p> : null}
        </section>
      </div>

      {editing ? (
        <EditChildDialog
          childId={child.id}
          mode={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
        />
      ) : null}
    </div>
  );
}
