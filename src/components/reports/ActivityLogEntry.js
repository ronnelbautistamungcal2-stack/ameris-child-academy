import { characterHighlightLabel, courseCorrectionSummary, ippSummary } from "@/lib/dailyLogOptions";
import { useState } from "react";

// Student Activity Log: one expandable row per Daily Log entry. Parents saw
// this on My Children before the Student Performance Report was rebuilt and
// the client asked to keep it as it is.

export const ACTIVITY_TYPE_LABELS = {
  DIAPER_CHANGE: "Diaper Change",
  NAP: "Nap",
  BOTTLE: "Bottle",
  MEAL: "Meal",
  SNACK: "Snack",
  ACTIVITY: "Activity",
  TASK_CHECKLIST: "Task Checklist",
  BEHAVIOR: "Course Correction",
  CITIZENSHIP: "Citizenship",
  ACCOMPLISHMENT: "Accomplishment",
  INCIDENT: "Incident",
  TOILETING: "Toileting",
  CHARACTER_HIGHLIGHT: "Character Highlight",
  IPP: "IPP",
  OTHER: "Grade",
};

const TOILETING_TYPE_LABELS = { SUCCESS: "Success", TRIED: "Tried", ACCIDENT: "Accident" };

export default function ActivityLogEntry({ activity: a }) {
  const [open, setOpen] = useState(false);
  const typeLabel = ACTIVITY_TYPE_LABELS[a.type] || a.type;
  const time = a.createdAt ? new Date(a.createdAt).toLocaleString() : "";
  const details = a.details && typeof a.details === "object" ? a.details : {};

  function renderDetails() {
    if (a.type === "NAP") {
      const start = details.start ? new Date(details.start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : null;
      const end = details.end ? new Date(details.end).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : null;
      if (start && end) return `Slept from ${start} to ${end}`;
      if (start) return `Nap started at ${start}`;
    }
    if (a.type === "BOTTLE") {
      const parts = [];
      if (details.amount) parts.push(`Served ${details.amount}`);
      if (details.consumed) parts.push(`Consumed ${details.consumed}`);
      if (details.formula) parts.push(details.formula);
      if (parts.length) return parts.join(" • ");
    }
    if (a.type === "MEAL" || a.type === "SNACK") {
      const parts = [];
      if (details.food) parts.push(details.food);
      if (details.amount) parts.push(details.amount);
      if (a.notes) parts.push(a.notes);
      return parts.join(" | ") || null;
    }
    if (a.type === "TOILETING") {
      const parts = [];
      if (details.toiletingType) parts.push(TOILETING_TYPE_LABELS[details.toiletingType] || details.toiletingType);
      if (a.notes) parts.push(a.notes);
      return parts.join(" | ") || null;
    }
    if (a.type === "CHARACTER_HIGHLIGHT") {
      const parts = [];
      if (details.characterHighlightType) {
        parts.push(characterHighlightLabel(details.characterHighlightType));
      }
      if (a.notes) parts.push(a.notes);
      return parts.join(" | ") || null;
    }
    if (a.type === "BEHAVIOR" && details.kind !== "DAILY_GRADE") {
      const summary = courseCorrectionSummary(details);
      return [summary, a.notes].filter(Boolean).join(" | ") || null;
    }
    if (a.type === "IPP") {
      return [ippSummary(details), a.notes].filter(Boolean).join(" | ") || null;
    }
    return a.notes || null;
  }

  const detailText = renderDetails();

  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-slate-800/80">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={!detailText}
        aria-expanded={detailText ? open : undefined}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left disabled:cursor-default"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 dark:bg-slate-700">
          <ActivityIcon type={a.type} />
        </span>
        <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-extrabold ${ACTIVITY_PILL[a.type] || ACTIVITY_PILL.DEFAULT}`}>
          {typeLabel}
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] text-gray-600 dark:text-gray-300">
          {a.child ? <span className="mr-2 font-semibold text-gray-800 dark:text-gray-100">{a.child}</span> : null}
          {time}
        </span>
        {detailText ? (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            aria-hidden="true"
            className={`h-4 w-4 shrink-0 text-[#12386a] transition-transform dark:text-gray-300 ${open ? "rotate-90" : ""}`}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m9 6 6 6-6 6" />
          </svg>
        ) : null}
      </button>
      {open && detailText ? (
        <div className="border-t border-gray-100 px-3 py-2.5 pl-[3.25rem] text-[13px] text-gray-700 dark:border-gray-700 dark:text-gray-200">
          {detailText}
        </div>
      ) : null}
    </div>
  );
}

const ACTIVITY_PILL = {
  NAP: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200",
  BOTTLE: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-200",
  MEAL: "bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-200",
  SNACK: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200",
  ACCOMPLISHMENT: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200",
  CHARACTER_HIGHLIGHT: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200",
  CITIZENSHIP: "bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-200",
  INCIDENT: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200",
  BEHAVIOR: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200",
  IPP: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-200",
  DEFAULT: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
};

export const ACTIVITY_ICONS = {
  NAP: "💤", BOTTLE: "🍼", MEAL: "🍽️", SNACK: "🥨",
  DIAPER_CHANGE: "🧷", ACTIVITY: "🎨", CITIZENSHIP: "⭐",
  ACCOMPLISHMENT: "🏆", INCIDENT: "⚠️", BEHAVIOR: "📋",
  TASK_CHECKLIST: "✅", TOILETING: "🚽", CHARACTER_HIGHLIGHT: "🏅", IPP: "🧭", OTHER: "📝",
};

function ActivityIcon({ type }) {
  return <span className="text-base">{ACTIVITY_ICONS[type] || "📄"}</span>;
}
