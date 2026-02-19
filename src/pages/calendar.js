import Link from "next/link";
import PublicLayout from "@/components/public/PublicLayout";
import { CalendarIcon } from "@/components/public/icons";

/* ── Calendar Data ────────────────────────────────────── */

const YEAR = 2026;
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_HEADERS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

// Events by month index (0-based)
const EVENTS = {
  0: [{ day: 1, type: "holiday" }, { day: 19, type: "holiday" }],
  1: [{ day: 16, type: "holiday" }, { day: 17, type: "training" }, { day: 18, type: "training" }],
  2: [{ day: 9, type: "event" }, { day: 10, type: "event" }, { day: 11, type: "event" }, { day: 12, type: "training" }, { day: 13, type: "training" }],
  3: [{ day: 3, type: "holiday" }, { day: 6, type: "holiday" }, { day: 7, type: "event" }, { day: 8, type: "event" }],
  4: [{ day: 11, type: "training" }],
  5: [{ day: 15, type: "event" }],
  6: [{ day: 4, type: "holiday" }],
  7: [],
  8: [{ day: 7, type: "holiday" }],
  9: [],
  10: [{ day: 11, type: "holiday" }],
  11: [{ day: 25, type: "holiday" }, { day: 26, type: "holiday" }],
};

const EVENT_STYLES = {
  holiday: "bg-pink-200 text-pink-800",
  training: "bg-sky-200 text-sky-800",
  event: "bg-orange-200 text-orange-800",
};

const LEGEND = [
  { type: "holiday", label: "Holidays (Center Closure)", color: "bg-pink-300" },
  { type: "training", label: "Teacher Training", color: "bg-sky-300" },
  { type: "event", label: "Center Events", color: "bg-orange-300" },
];

/* ── Helpers ──────────────────────────────────────────── */

function getMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];

  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return cells;
}

/* ── Page ─────────────────────────────────────────────── */

export default function CalendarPage() {
  return (
    <PublicLayout title="Calendar" description="Yearly events calendar for Ameris Child Academy">
      <HeroSection />
      <CalendarGrid />
      <LegendSection />
      <SyncSection />
    </PublicLayout>
  );
}

/* ── Hero ─────────────────────────────────────────────── */

function HeroSection() {
  return (
    <section className="bg-gradient-to-b from-sky-50 to-white py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-6 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 lg:text-4xl">
          Yearly Events Calendar
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-gray-600">
          Stay updated with our school closings, teacher training days, and special community events
          through the academic year.
        </p>
      </div>
    </section>
  );
}

/* ── Calendar Grid ────────────────────────────────────── */

function CalendarGrid() {
  return (
    <section className="bg-white py-8">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {MONTH_NAMES.map((name, monthIdx) => (
            <MiniCalendar key={name} month={monthIdx} name={name} />
          ))}
        </div>
      </div>
    </section>
  );
}

function MiniCalendar({ month, name }) {
  const cells = getMonthGrid(YEAR, month);
  const events = EVENTS[month] || [];
  const eventMap = {};
  events.forEach((ev) => {
    eventMap[ev.day] = ev.type;
  });

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-extrabold text-gray-900">{name}</h3>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs">
        {DAY_HEADERS.map((d) => (
          <div key={d} className="py-1 font-semibold text-gray-400">{d}</div>
        ))}
        {cells.map((day, idx) => {
          if (day === null) {
            return <div key={`empty-${idx}`} />;
          }
          const eventType = eventMap[day];
          const style = eventType ? EVENT_STYLES[eventType] : "text-gray-700";
          return (
            <div
              key={day}
              className={`rounded-md py-1 text-xs font-medium ${style}`}
            >
              {day}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Legend ────────────────────────────────────────────── */

function LegendSection() {
  return (
    <section className="bg-white pb-8">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-wrap items-center gap-6">
          {LEGEND.map((item) => (
            <div key={item.type} className="flex items-center gap-2 text-sm text-gray-700">
              <span className={`inline-block h-3 w-3 rounded-full ${item.color}`} />
              {item.label}
            </div>
          ))}

          <div className="ml-auto">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-5 py-2.5 text-sm font-extrabold text-white hover:bg-sky-700"
            >
              <CalendarIcon className="h-4 w-4" />
              Export to Google Calendar
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Sync CTA ─────────────────────────────────────────── */

function SyncSection() {
  return (
    <section className="bg-gray-50 py-16">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-2xl font-extrabold text-gray-900">Want to sync with your phone?</h2>
        <p className="mx-auto mt-3 max-w-lg text-sm text-gray-600">
          Never miss a center event! Parents can subscribe to our iCal feed directly to their personal
          Google or Apple calendar through the parent portal.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex rounded-2xl bg-sky-600 px-6 py-3 text-sm font-extrabold text-white hover:bg-sky-700"
        >
          Go to Parent Portal
        </Link>
      </div>
    </section>
  );
}
