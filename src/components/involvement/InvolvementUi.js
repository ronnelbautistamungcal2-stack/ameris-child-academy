import { useEffect, useRef, useState } from "react";

// Shared pieces of the parent and staff Parent Involvement pages (client
// mockups 16-01..06).

export const NAVY = "text-[#0b2a5b] dark:text-blue-100";
export const BLUE = "text-[#1d4ed8] dark:text-blue-200";
export const control =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800";
export const label = "block text-sm font-bold text-[#0b2a5b] dark:text-blue-100";
export const card = "rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900";

const pad = (n) => String(n).padStart(2, "0");
export const dateKey = (d) => (d ? `${new Date(d).getFullYear()}-${pad(new Date(d).getMonth() + 1)}-${pad(new Date(d).getDate())}` : "");
export const timeKey = (d) => (d ? `${pad(new Date(d).getHours())}:${pad(new Date(d).getMinutes())}` : "");
export const clock = (d) => new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
export const shortDate = (d) => new Date(d).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
export const childNames = (entry) =>
  (entry.children?.length ? entry.children : entry.child ? [entry.child] : []).map((c) => c.firstName).join(", ");

/** Hours between two HH:MM times, or 0. */
export function hoursBetween(start, end) {
  if (!/^\d{2}:\d{2}$/.test(start || "") || !/^\d{2}:\d{2}$/.test(end || "")) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const diff = eh * 60 + em - (sh * 60 + sm);
  return diff > 0 ? Math.round((diff / 60) * 100) / 100 : 0;
}

/** One upcoming event: date block, times, location, description, volunteers. */
export function EventCard({ event, action, onOpen, selected }) {
  const start = event.startsAt ? new Date(event.startsAt) : null;
  const body = (
    <>
      <div className="w-14 shrink-0 text-center">
        {start ? (
          <>
            <div className="text-sm font-black uppercase text-red-600">{start.toLocaleDateString("en-US", { month: "short" })}</div>
            <div className={`text-3xl font-black leading-none ${NAVY}`}>{start.getDate()}</div>
            <div className="text-xs text-gray-600 dark:text-gray-300">{start.toLocaleDateString("en-US", { weekday: "short" })}</div>
          </>
        ) : (
          <div className="text-xs font-bold text-gray-500">{event.schedule || "Ongoing"}</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className={`font-bold ${BLUE}`}>{event.title}</div>
        <div className="mt-0.5 flex flex-wrap gap-x-4 text-xs text-gray-700 dark:text-gray-300">
          {start ? <span>🕒 {clock(event.startsAt)}{event.endsAt ? ` - ${clock(event.endsAt)}` : ""}</span> : null}
          {event.location ? <span>📍 {event.location}</span> : null}
        </div>
        {event.description ? <div className="mt-0.5 line-clamp-2 text-xs text-gray-700 dark:text-gray-300">{event.description}</div> : null}
      </div>
    </>
  );
  return (
    <div className={`flex items-center gap-3 rounded-xl border bg-white px-3 py-2 dark:bg-gray-900 ${selected ? "border-[#1d4ed8] ring-2 ring-blue-100" : "border-gray-200 dark:border-gray-700"}`}>
      {onOpen ? (
        <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`Open ${event.title}`}>
          {body}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3">{body}</div>
      )}
      {action}
      <div className="w-24 shrink-0 text-center">
        <div className={`text-lg font-black ${NAVY}`}>
          {event.signedUpCount ?? 0} / {event.volunteersNeeded ?? "—"}
        </div>
        <div className="text-[11px] text-gray-600 dark:text-gray-300">Volunteers Needed</div>
      </div>
      {onOpen ? <span className={`text-xl ${BLUE}`} aria-hidden="true">›</span> : null}
    </div>
  );
}

/** A dropdown of checkboxes for picking children. */
export function ChildPicker({ options, value, onChange, id, placeholder = "Select child(ren)" }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => box.current && !box.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const chosen = options.filter((c) => value.includes(c.id));
  return (
    <div ref={box} className="relative">
      <button type="button" id={id} onClick={() => setOpen((o) => !o)} aria-expanded={open} className={`${control} flex items-center justify-between text-left`}>
        <span className={chosen.length ? "" : "text-gray-500"}>{chosen.length ? chosen.map((c) => c.firstName).join(", ") : placeholder}</span>
        <span aria-hidden="true">▾</span>
      </button>
      {open ? (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-800">
          {options.map((c) => (
            <label key={c.id} className="flex items-center gap-2 px-1 py-1 text-sm">
              <input type="checkbox" checked={value.includes(c.id)} onChange={() => onChange(value.includes(c.id) ? value.filter((x) => x !== c.id) : [...value, c.id])} />
              {`${c.firstName} ${c.lastName || ""}`.trim()}
            </label>
          ))}
          {!options.length ? <div className="px-1 py-1 text-sm text-gray-500">No children</div> : null}
        </div>
      ) : null}
    </div>
  );
}

/** A collapsible panel with the mockup's chevron button. */
export function CollapsibleCard({ title, open, onToggle, children, className = "" }) {
  return (
    <section className={`${card} ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className={`text-2xl font-black ${NAVY}`}>{title}</h2>
        <button type="button" onClick={onToggle} aria-expanded={open} aria-label={`${open ? "Collapse" : "Expand"} ${title}`} className={`rounded-lg bg-blue-50 px-3 py-1 text-lg font-black dark:bg-gray-800 ${BLUE}`}>
          {open ? "⌃" : "⌄"}
        </button>
      </div>
      {open ? <div className="mt-3">{children}</div> : null}
    </section>
  );
}
