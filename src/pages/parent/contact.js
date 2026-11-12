import { useEffect, useState } from "react";
import ParentLayout from "@/components/parent/ParentLayout";
import { ParentButton, ParentPageHeader, ParentSection } from "@/components/parent/ParentUI";
import { apiJson } from "@/lib/api";
import { DAYS, defaultCareSchedule } from "@/lib/centerSettings";

// Contact Us shows the parent's own center(s), from Center Setup (client sheet
// 10-29, row 50: a new subscriber's parents saw Ameris Academy's details).

function ContactRow({ label, children }) {
  return (
    <div className="flex flex-col gap-1 border-b border-gray-100 py-3 last:border-0 sm:flex-row sm:items-baseline sm:gap-6 dark:border-gray-700">
      <div className="w-40 shrink-0 text-xs font-black uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">{label}</div>
      <div className="text-sm font-semibold text-[#12386a] dark:text-slate-100">{children}</div>
    </div>
  );
}

function time12(hhmm) {
  const [h, m] = String(hhmm || "").split(":").map(Number);
  if (!Number.isFinite(h)) return "";
  return `${((h + 11) % 12) + 1}:${String(m || 0).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** "Mon – Fri, 7:30 AM – 4:45 PM" from the Care & Schedule tab, grouping days with the same hours. */
function officeHours(careSchedule) {
  const schedule = careSchedule && typeof careSchedule === "object" ? careSchedule : defaultCareSchedule();
  const groups = [];
  for (const { key, label } of DAYS) {
    const d = schedule[key];
    if (!d || d.open === false || !d.start || !d.end) continue;
    const hours = `${time12(d.start)} – ${time12(d.end)}`;
    const last = groups[groups.length - 1];
    if (last && last.hours === hours && last.endIndex === DAYS.findIndex((x) => x.key === key) - 1) {
      last.to = label;
      last.endIndex += 1;
    } else {
      groups.push({ from: label, to: label, hours, endIndex: DAYS.findIndex((x) => x.key === key) });
    }
  }
  return groups.map((g) => `${g.from.slice(0, 3)}${g.to !== g.from ? ` – ${g.to.slice(0, 3)}` : ""}, ${g.hours}`);
}

function CenterContact({ center }) {
  const phoneDigits = String(center.phone || "").replace(/[^\d+]/g, "");
  const cityLine = [center.city, [center.state, center.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const hours = officeHours(center.careSchedule);
  return (
    <ParentSection title={center.name || "Center details"}>
      <ContactRow label="Phone">
        {center.phone ? (
          <a href={`tel:${phoneDigits}`} className="text-sky-700 hover:text-sky-800 dark:text-sky-400">
            {center.phone}
          </a>
        ) : (
          "—"
        )}
      </ContactRow>
      <ContactRow label="Email">
        {center.contactEmail ? (
          <a href={`mailto:${center.contactEmail}`} className="text-sky-700 hover:text-sky-800 dark:text-sky-400">
            {center.contactEmail}
          </a>
        ) : (
          "—"
        )}
      </ContactRow>
      <ContactRow label="Address">
        {center.address || cityLine ? (
          <>
            {center.address ? <div>{center.address}</div> : null}
            {cityLine ? <div>{cityLine}</div> : null}
          </>
        ) : (
          "—"
        )}
      </ContactRow>
      <ContactRow label="Office hours">{hours.length ? hours.map((h) => <div key={h}>{h}</div>) : "—"}</ContactRow>
    </ParentSection>
  );
}

export default function ParentContact() {
  const [centers, setCenters] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiJson("/api/v1/centers")
      .then((list) => setCenters(Array.isArray(list) ? list : []))
      .catch((e) => setError(e.message || "Couldn't load your center's details"));
  }, []);

  return (
    <ParentLayout title="Contact Us">
      <div className="space-y-4">
        <ParentPageHeader eyebrow="" title="Contact Us" accent="sky" />

        {error ? <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}
        {!centers && !error ? <div className="text-sm text-gray-500">Loading...</div> : null}
        {centers && !centers.length ? (
          <ParentSection title="Center details">
            <p className="text-sm text-gray-600 dark:text-gray-300">Your center&apos;s details aren&apos;t set up yet. Please send a message instead.</p>
          </ParentSection>
        ) : null}
        {(centers || []).map((center) => (
          <CenterContact key={center.id} center={center} />
        ))}

        <ParentSection title="Send a message instead">
          <ParentButton href="/parent/messages" variant="soft">
            Open Messages
          </ParentButton>
        </ParentSection>
      </div>
    </ParentLayout>
  );
}
