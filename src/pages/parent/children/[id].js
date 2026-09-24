import ParentLayout from "@/components/parent/ParentLayout";
import { ParentEmpty, ParentSurface } from "@/components/parent/ParentUI";
import ChildProfileEditDialog from "@/components/parent/ChildProfileEditDialog";
import Skeleton from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import { formatAge } from "@/lib/ageUtils";
import { getEmergencyContacts, getParentContacts } from "@/lib/child-contacts";
import { CHILD_SNAPSHOT_FIELDS } from "@/lib/childSnapshot";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Each editable section names the family-owned fields it covers. Contacts and
// classroom details come from the center's record, so they stay read-only here.
const EDIT_SECTIONS = {
  family: {
    title: "Family Information",
    fields: [
      { name: "homeAddress", label: "Home Address", placeholder: "123 Maple Lane, Springfield, IL 62704" },
      {
        name: "authorizedPickup",
        label: "Authorized Pick-Up",
        placeholder: "Grandma (Linda Davis), Aunt (Emily Carter)",
      },
    ],
  },
  emergency: {
    title: "Emergency Contacts",
    fields: [
      { name: "pediatricianName", label: "Pediatrician", placeholder: "Springfield Pediatrics", rows: 1 },
      { name: "pediatricianPhone", label: "Pediatrician Phone", placeholder: "(555) 321-7654", rows: 1 },
      { name: "emergencyNotes", label: "Emergency Notes", placeholder: "No additional notes" },
    ],
  },
  about: {
    title: "About",
    fields: [
      {
        name: "profileSummary",
        label: "Summary",
        placeholder: "A bright and curious learner who brings joy to the classroom",
        rows: 3,
      },
      { name: "favoriteActivities", label: "Interests", placeholder: "Trucks, building blocks, music" },
      { name: "strengths", label: "Strengths", placeholder: "Kind, imaginative, helpful" },
      { name: "areasOfFocus", label: "Areas for Growth", placeholder: "Following multi-step directions" },
      { name: "allergies", label: "Allergies", placeholder: "None" },
      {
        name: "medicalInfo",
        label: "Medical Information",
        placeholder: "Requires extra supervision during outdoor play",
      },
      { name: "languages", label: "Languages", placeholder: "English", rows: 1 },
      { name: "snapshotNotes", label: "Additional Notes", placeholder: "Loves to share and include friends" },
    ],
  },
};

export default function ParentChildProfile() {
  const router = useRouter();
  const childId = typeof router.query.id === "string" ? router.query.id : "";
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadChildren() {
      setLoading(true);
      setError("");
      try {
        const kids = await apiJson("/api/v1/children");
        if (cancelled) return;
        const sorted = (Array.isArray(kids) ? kids : []).sort((a, b) =>
          (a.firstName || "").localeCompare(b.firstName || ""),
        );
        setChildren(sorted);
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load children");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadChildren();
    return () => {
      cancelled = true;
    };
  }, []);

  const child = useMemo(
    () => children.find((ch) => ch.id === childId) || null,
    [children, childId],
  );

  const applySnapshot = useCallback((id, snapshot) => {
    setChildren((current) =>
      current.map((ch) => {
        if (ch.id !== id) return ch;
        const next = { ...ch };
        for (const field of CHILD_SNAPSHOT_FIELDS) {
          next[field] = snapshot?.[field] ?? null;
        }
        return next;
      }),
    );
  }, []);

  const section = editing ? EDIT_SECTIONS[editing] : null;
  const backHref = childId
    ? `/parent/children?childId=${encodeURIComponent(childId)}`
    : "/parent/children";

  return (
    <ParentLayout title="Child Profile">
      <div className="space-y-3">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm font-bold text-sky-700 transition hover:text-sky-900 dark:text-sky-300 dark:hover:text-sky-100"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="h-4 w-4" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
          Back to Children
        </Link>

        {error ? (
          <ParentSurface className="border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </ParentSurface>
        ) : null}

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h1 className="text-2xl font-black tracking-tight text-[#12386a] dark:text-gray-100 sm:text-3xl">
            Child Profile
          </h1>
          {!loading && children.length > 1 ? (
            <ProfileSwitcher items={children} activeId={childId} />
          ) : null}
        </div>

        {loading ? (
          <div className="space-y-3">
            <Skeleton variant="card" className="h-[180px] w-full rounded-[28px]" />
            <Skeleton variant="card" className="h-[320px] w-full rounded-[28px]" />
          </div>
        ) : !child ? (
          <ParentSurface>
            <ParentEmpty
              title="Child not found"
              description="This child isn't linked to your account. Head back to My Children to pick one of yours."
            />
          </ParentSurface>
        ) : (
          <ProfileBody child={child} onEdit={setEditing} />
        )}
      </div>

      {section && child ? (
        <ChildProfileEditDialog
          child={child}
          title={editing === "about" ? `About ${child.firstName}` : section.title}
          fields={section.fields}
          onClose={() => setEditing(null)}
          onSaved={(snapshot) => {
            applySnapshot(child.id, snapshot);
            setEditing(null);
          }}
        />
      ) : null}
    </ParentLayout>
  );
}

function ProfileBody({ child, onEdit }) {
  const parents = getParentContacts(child);
  const emergencies = getEmergencyContacts(child);
  const teachers = teacherNames(child);
  const flags = redFlags(child, emergencies);
  const status = enrollmentStatus(child);

  return (
    <div className="space-y-3">
      <section className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex items-start gap-4 rounded-[28px] border border-sky-100 bg-white p-4 shadow-sm dark:border-sky-900/60 dark:bg-gray-800 sm:p-5">
          <ChildAvatar child={child} size="xl" />
          <div className="min-w-0">
            <h2 className="text-2xl font-black tracking-tight text-[#12386a] dark:text-gray-100">
              {child.firstName} {child.lastName || ""}
            </h2>
            <div className="mt-1.5 space-y-0.5 text-[13px] leading-5 text-gray-600 dark:text-gray-300">
              <div>
                Age: {formatAge(child.birthDate) || "—"}
                <span className="mx-1.5 text-gray-300 dark:text-gray-600">|</span>
                Date of Birth: {formatLongDate(child.birthDate)}
              </div>
              <div>Classroom: {child.classRoom?.name || "Unassigned"}</div>
              <div>Teacher: {teachers || "Not assigned"}</div>
              <div>Enrollment Date: {formatLongDate(child.enrollmentStartDate)}</div>
            </div>
            <StatusBadge status={status} className="mt-3" />
          </div>
        </div>

        <figure className="relative rounded-[28px] border border-sky-100 bg-sky-50/70 p-5 dark:border-sky-900/60 dark:bg-sky-950/30">
          <span aria-hidden="true" className="absolute left-4 top-2 text-5xl font-black leading-none text-sky-300 dark:text-sky-700">
            &ldquo;
          </span>
          <blockquote className="px-4 pt-5 text-[14px] italic leading-6 text-slate-700 dark:text-slate-200">
            {child.profileSummary || (
              <span className="not-italic text-gray-500 dark:text-gray-400">
                Add a short description of {child.firstName} from the About section.
              </span>
            )}
          </blockquote>
          <span aria-hidden="true" className="absolute bottom-0 right-4 text-5xl font-black leading-none text-sky-300 dark:text-sky-700">
            &rdquo;
          </span>
        </figure>

        <div className="rounded-[28px] border border-rose-100 bg-rose-50/70 p-5 dark:border-rose-900/60 dark:bg-rose-950/30">
          <h3 className="flex items-center gap-2 text-base font-black tracking-tight text-rose-700 dark:text-rose-300">
            <FlagIcon />
            Red Flags
          </h3>
          {flags.length ? (
            <ul className="mt-3 space-y-2">
              {flags.map((flag) => (
                <li key={flag} className="flex items-start gap-2 text-[13px] leading-5 text-gray-800 dark:text-gray-200">
                  <span aria-hidden="true" className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-rose-600 text-[10px] font-black text-white">
                    !
                  </span>
                  <span className="min-w-0">{flag}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[13px] text-gray-600 dark:text-gray-400">No red flags on file.</p>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <ProfileCard icon={<UsersIcon />} title="Family Information" onEdit={() => onEdit("family")}>
          <div className="space-y-4">
            {parents.length ? (
              parents.map((contact, index) => (
                <div key={`${contact.label}-${index}`}>
                  <GroupLabel>Parent/Guardian {index + 1}</GroupLabel>
                  <ContactLine icon={<PersonIcon />}>{contact.name || contact.label}</ContactLine>
                  {contact.phone ? <ContactLine icon={<PhoneIcon />}>{contact.phone}</ContactLine> : null}
                  {contact.email ? <ContactLine icon={<MailIcon />}>{contact.email}</ContactLine> : null}
                </div>
              ))
            ) : (
              <div>
                <GroupLabel>Parent/Guardian</GroupLabel>
                <p className="text-[13px] text-gray-500 dark:text-gray-400">No parent contacts on file.</p>
              </div>
            )}
            <div>
              <GroupLabel>Home Address</GroupLabel>
              <ContactLine icon={<HomeIcon />}>{child.homeAddress || "—"}</ContactLine>
            </div>
            <div>
              <GroupLabel>Authorized Pick-Up</GroupLabel>
              <ContactLine icon={<GroupIcon />}>{child.authorizedPickup || "—"}</ContactLine>
            </div>
          </div>
        </ProfileCard>

        <div className="space-y-3">
          <ProfileCard icon={<SchoolIcon />} title="Classroom Information">
            <dl className="space-y-2">
              <InfoRow label="Classroom" value={child.classRoom?.name || "Unassigned"} />
              <InfoRow label="Teacher" value={teachers || "Not assigned"} />
              {child.carpool ? <InfoRow label="Carpool" value={child.carpool} /> : null}
              <InfoRow label="Start Date" value={formatLongDate(child.enrollmentStartDate)} />
              <InfoRow label="Current Status" value={<StatusBadge status={status} />} />
            </dl>
          </ProfileCard>

          <ProfileCard icon={<MedicalIcon />} title="Emergency Contacts" tone="rose" onEdit={() => onEdit("emergency")}>
            <dl className="space-y-2">
              {emergencies.length ? (
                emergencies.map((contact, index) => (
                  <InfoRow
                    key={`${contact.label}-${index}`}
                    label={emergencyLabel(index)}
                    value={<Stacked lines={[contact.name, contact.phone]} />}
                  />
                ))
              ) : (
                <InfoRow label="Primary Contact" value="No emergency contact on file" />
              )}
              <InfoRow
                label="Pediatrician"
                value={<Stacked lines={[child.pediatricianName, child.pediatricianPhone]} />}
              />
              <InfoRow label="Emergency Notes" value={child.emergencyNotes || "No additional notes"} />
            </dl>
          </ProfileCard>
        </div>

        <ProfileCard icon={<PersonIcon />} title={`About ${child.firstName}`} onEdit={() => onEdit("about")}>
          <dl className="space-y-2">
            <InfoRow label="Interests" value={child.favoriteActivities} />
            <InfoRow label="Strengths" value={child.strengths} />
            <InfoRow label="Areas for Growth" value={child.areasOfFocus} />
            <InfoRow label="Allergies" value={child.allergies || "None"} />
            <InfoRow label="Medical Information" value={child.medicalInfo || "None"} />
            <InfoRow label="Languages" value={child.languages} />
            <InfoRow label="Additional Notes" value={child.snapshotNotes} />
          </dl>
        </ProfileCard>
      </section>
    </div>
  );
}

function ProfileSwitcher({ items, activeId }) {
  const router = useRouter();
  const railRef = useRef(null);
  const index = items.findIndex((item) => item.id === activeId);

  // Keep the child being viewed in sight when a big family overflows the rail.
  useEffect(() => {
    const rail = railRef.current;
    const active = rail?.querySelector('[aria-current="page"]');
    if (!rail || !active) return;
    rail.scrollTo({
      left: Math.max(0, active.offsetLeft - (rail.clientWidth - active.offsetWidth) / 2),
      behavior: "smooth",
    });
  }, [activeId]);

  const go = (step) => {
    if (!items.length) return;
    const next = items[(Math.max(index, 0) + step + items.length) % items.length];
    router.push(`/parent/children/${encodeURIComponent(next.id)}`);
  };

  return (
    <nav aria-label="Switch child" className="flex min-w-0 items-center gap-1.5">
      <RailArrow direction="prev" onClick={() => go(-1)} />
      <div ref={railRef} className="scrollbar-hide flex min-w-0 gap-1.5 overflow-x-auto py-1">
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <Link
              key={item.id}
              href={`/parent/children/${encodeURIComponent(item.id)}`}
              aria-current={active ? "page" : undefined}
              className={[
                "flex w-[60px] shrink-0 flex-col items-center gap-1 rounded-2xl border px-1 py-1.5 transition-colors",
                active
                  ? "border-sky-400 bg-sky-50 ring-2 ring-sky-100 dark:border-sky-600 dark:bg-sky-950/60 dark:ring-sky-900/60"
                  : "border-transparent hover:bg-sky-50/70 dark:hover:bg-slate-800",
              ].join(" ")}
            >
              <ChildAvatar child={item} size="sm" />
              <span className="w-full truncate text-center text-[10px] font-extrabold text-gray-700 dark:text-gray-300">
                {item.firstName}
              </span>
            </Link>
          );
        })}
      </div>
      <RailArrow direction="next" onClick={() => go(1)} />
    </nav>
  );
}

function RailArrow({ direction, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === "prev" ? "Previous child" : "Next child"}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-gray-200 bg-white text-gray-600 transition hover:border-sky-300 hover:text-sky-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="h-4 w-4" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d={direction === "prev" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
      </svg>
    </button>
  );
}

function ProfileCard({ icon, title, tone = "sky", onEdit, children }) {
  const tones = {
    sky: "text-sky-700 dark:text-sky-300",
    rose: "text-rose-600 dark:text-rose-300",
  };
  return (
    <ParentSurface>
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-3 dark:border-gray-700">
        <h3 className="flex items-center gap-2 text-base font-black tracking-tight text-[#12386a] dark:text-gray-100">
          <span aria-hidden="true" className={tones[tone] || tones.sky}>
            {icon}
          </span>
          {title}
        </h3>
        {onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${title}`}
            className="rounded-full px-2.5 py-1 text-[12px] font-extrabold text-sky-700 transition hover:bg-sky-50 dark:text-sky-300 dark:hover:bg-sky-900/40"
          >
            Edit
          </button>
        ) : null}
      </div>
      <div className="pt-3">{children}</div>
    </ParentSurface>
  );
}

function GroupLabel({ children }) {
  return (
    <div className="mb-1 text-[12px] font-black text-gray-800 dark:text-gray-200">{children}</div>
  );
}

function ContactLine({ icon, children }) {
  return (
    <div className="flex items-start gap-2 text-[13px] leading-5 text-gray-700 dark:text-gray-300">
      <span aria-hidden="true" className="mt-0.5 shrink-0 text-[#12386a] dark:text-sky-300">
        {icon}
      </span>
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)] gap-3 text-[13px] leading-5">
      <dt className="font-bold text-gray-800 dark:text-gray-200">{label}</dt>
      <dd className="min-w-0 break-words text-gray-600 dark:text-gray-300">{value || "—"}</dd>
    </div>
  );
}

function Stacked({ lines }) {
  const present = lines.filter(Boolean);
  if (!present.length) return "—";
  return (
    <>
      {present.map((line, index) => (
        <span key={index} className="block">
          {line}
        </span>
      ))}
    </>
  );
}

function StatusBadge({ status, className = "" }) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800",
    amber: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-800",
    gray: "bg-gray-100 text-gray-600 ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-extrabold ring-1 ${tones[status.tone]} ${className}`}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {status.label}
    </span>
  );
}

function ChildAvatar({ child, size = "sm" }) {
  const [broken, setBroken] = useState(false);
  const dims = {
    sm: "h-10 w-10 text-[12px]",
    xl: "h-[112px] w-[112px] text-3xl",
  };
  const photo = typeof child?.photoUrl === "string" ? child.photoUrl.trim() : "";

  if (photo && !broken) {
    return (
      <img
        src={photo}
        alt={size === "xl" ? `${child.firstName || "Child"} ${child.lastName || ""}`.trim() : ""}
        onError={() => setBroken(true)}
        className={`${dims[size]} shrink-0 rounded-full border-2 border-white object-cover shadow-sm dark:border-gray-700`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`${dims[size]} grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-sky-600 to-cyan-500 font-black text-white`}
    >
      {initials(child?.firstName, child?.lastName)}
    </span>
  );
}

/**
 * What staff should keep front of mind about the child: allergies and medical
 * notes the family has shared, plus a missing emergency contact.
 */
function redFlags(child, emergencies) {
  const flags = [];
  const allergies = (child?.allergies || "").trim();
  if (allergies && !/^(none|n\/a|no|no known allergies)$/i.test(allergies)) {
    flags.push(`Allergy – ${allergies}`);
  }
  const medical = (child?.medicalInfo || "").trim();
  if (medical && !/^(none|n\/a|no)$/i.test(medical)) flags.push(medical);
  if (!emergencies.length) flags.push("No emergency contact on file");
  return flags;
}

function enrollmentStatus(child) {
  const now = Date.now();
  const start = child?.enrollmentStartDate ? new Date(child.enrollmentStartDate).getTime() : null;
  const end = child?.enrollmentEndDate ? new Date(child.enrollmentEndDate).getTime() : null;
  if (end && end < now) return { label: "Enrollment Ended", tone: "gray" };
  if (start && start > now) {
    return { label: `Starts ${formatLongDate(child.enrollmentStartDate)}`, tone: "amber" };
  }
  return { label: "Enrolled", tone: "emerald" };
}

function emergencyLabel(index) {
  return ["Primary Contact", "Secondary Contact", "Additional Contact"][index] || "Contact";
}

function teacherNames(child) {
  const links = Array.isArray(child?.classRoom?.teachers) ? child.classRoom.teachers : [];
  return links
    .map((link) => link?.teacher?.name)
    .filter(Boolean)
    .join(", ");
}

function formatLongDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function initials(firstName, lastName) {
  const first = (firstName || "").trim().slice(0, 1).toUpperCase();
  const last = (lastName || "").trim().slice(0, 1).toUpperCase();
  return `${first}${last}` || "C";
}

const svgProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

function UsersIcon() {
  return (
    <svg {...svgProps} className="h-5 w-5">
      <path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19" />
      <circle cx="10" cy="8" r="3" />
      <path d="M20 19v-1.5a3.5 3.5 0 0 0-2.6-3.38M15.5 5.2a3 3 0 0 1 0 5.6" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg {...svgProps} className="h-4 w-4">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg {...svgProps} className="h-4 w-4">
      <path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg {...svgProps} className="h-4 w-4">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg {...svgProps} className="h-4 w-4">
      <path d="M3 10.5 12 3l9 7.5M5 9.5V20h14V9.5" />
    </svg>
  );
}

function GroupIcon() {
  return (
    <svg {...svgProps} className="h-4 w-4">
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="9.5" r="2.3" />
      <path d="M3 19a6 6 0 0 1 12 0M16.5 14.5A4.5 4.5 0 0 1 21 19" />
    </svg>
  );
}

function SchoolIcon() {
  return (
    <svg {...svgProps} className="h-5 w-5">
      <path d="M3 10 12 4l9 6v10H3z" />
      <path d="M10 20v-5h4v5" />
    </svg>
  );
}

function MedicalIcon() {
  return (
    <svg {...svgProps} className="h-5 w-5">
      <rect x="3" y="6" width="18" height="14" rx="2" />
      <path d="M9 6V4h6v2M12 10v6M9 13h6" />
    </svg>
  );
}

function FlagIcon() {
  return (
    <svg {...svgProps} className="h-5 w-5">
      <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
    </svg>
  );
}
