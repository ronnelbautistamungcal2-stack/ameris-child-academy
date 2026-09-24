import Link from "next/link";
import { useMemo, useState } from "react";
import Skeleton from "@/components/ui/Skeleton";

const NAVY = "text-[#12386a] dark:text-slate-100";

function ChevronRight({ className = "h-4 w-4" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
    </svg>
  );
}

export function ParentCard({
  icon,
  title,
  titleClassName = "text-[#1c5fa8] dark:text-sky-300",
  iconClassName = "text-[#1c5fa8] dark:text-sky-300",
  actionLabel,
  actionHref,
  children,
  bodyClassName = "p-3",
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-700">
        <div className="flex min-w-0 items-center gap-2.5">
          {icon ? <span className={iconClassName}>{icon}</span> : null}
          <h2 className={"truncate text-base font-black tracking-tight " + titleClassName}>
            {title}
          </h2>
        </div>
        {actionHref ? (
          <Link
            href={actionHref}
            className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-sky-600 transition hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300"
          >
            {actionLabel}
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

const NOTICE_TILES = {
  sky: "bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300",
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
};

const NOTICE_DETAIL_TONES = {
  sky: "text-sky-600 dark:text-sky-400",
  emerald: "text-emerald-600 dark:text-emerald-400",
  amber: "text-amber-600 dark:text-amber-400",
  rose: "text-rose-600 dark:text-rose-400",
};

function NoticeIcon({ kind }) {
  if (kind === "form") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} className="h-4 w-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14 3H7a1.5 1.5 0 0 0-1.5 1.5v15A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V7.5z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M14 3v4.5h4.5M8.75 12.5h6.5M8.75 16h4.5" />
      </svg>
    );
  }
  if (kind === "info") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} className="h-4 w-4">
        <circle cx="12" cy="12" r="8.75" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 11v5m0-8.25v.5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} className="h-4 w-4">
      <rect x="3.75" y="5" width="16.5" height="15" rx="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 3.5v3M16 3.5v3M3.75 10h16.5" />
    </svg>
  );
}

export function ImportantNoticesCard({ notices = [], loading, actionHref = "/parent/notices" }) {
  return (
    <ParentCard
      title="Important Notices"
      titleClassName="text-[#c2298a] dark:text-pink-300"
      iconClassName="text-[#c2298a] dark:text-pink-300"
      actionLabel="View All"
      actionHref={actionHref}
      icon={
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} className="h-5 w-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 10.5v3a1.5 1.5 0 0 0 1.5 1.5h2l5.5 4V5l-5.5 4H5a1.5 1.5 0 0 0-1.5 1.5z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 9.5a4 4 0 0 1 0 5M19.5 7a7.5 7.5 0 0 1 0 10M7 15v4.5" />
        </svg>
      }
    >
      {loading ? (
        <div className="px-1 py-2">
          <Skeleton count={4} />
        </div>
      ) : notices.length === 0 ? (
        <p className="px-2 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
          No notices right now. Updates from the center will show up here.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-700">
          {notices.map((notice) => (
            <li key={notice.id}>
              <Link
                href={notice.href}
                className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-sky-50 dark:hover:bg-gray-700/50"
              >
                <span
                  className={
                    "grid h-9 w-9 shrink-0 place-items-center rounded-lg " +
                    (NOTICE_TILES[notice.tone] || NOTICE_TILES.sky)
                  }
                >
                  <NoticeIcon kind={notice.kind} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={"block truncate text-sm font-bold " + NAVY}>
                    {notice.title}
                  </span>
                  {notice.detail ? (
                    <span
                      className={
                        "block truncate text-xs font-semibold " +
                        (NOTICE_DETAIL_TONES[notice.tone] || NOTICE_DETAIL_TONES.sky)
                      }
                    >
                      {notice.detail}
                    </span>
                  ) : null}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </ParentCard>
  );
}

const AVATAR_TONES = [
  "bg-gradient-to-br from-sky-500 to-blue-600",
  "bg-gradient-to-br from-emerald-500 to-teal-600",
  "bg-gradient-to-br from-amber-500 to-orange-600",
  "bg-gradient-to-br from-fuchsia-500 to-purple-600",
];

export function MyChildrenCard({
  childRows = [],
  loading,
  error,
  actionHref = "/parent/children",
}) {
  return (
    <ParentCard
      title="My Children"
      actionLabel="View All"
      actionHref={actionHref}
      icon={
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} className="h-5 w-5">
          <circle cx="9" cy="8" r="3.25" />
          <circle cx="17" cy="9.5" r="2.4" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 19a6 6 0 0 1 12 0" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 14.5A4.5 4.5 0 0 1 21 19" />
        </svg>
      }
    >
      {error ? (
        <div className="m-1 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-950/25 dark:text-red-200">
          {error}
        </div>
      ) : loading ? (
        <div className="px-1 py-2">
          <Skeleton count={3} />
        </div>
      ) : childRows.length === 0 ? (
        <p className="px-2 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
          No children are linked to this account yet.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-700">
          {childRows.map((child, index) => (
            <li key={child.id}>
              <Link
                href={"/parent/children?childId=" + encodeURIComponent(child.id)}
                className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-sky-50 dark:hover:bg-gray-700/50"
              >
                <span
                  className={
                    "grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-black text-white shadow-sm " +
                    AVATAR_TONES[index % AVATAR_TONES.length]
                  }
                >
                  {child.initials}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={"block truncate text-sm font-bold " + NAVY}>
                    {child.name}
                  </span>
                  <span className="block truncate text-xs font-semibold text-sky-600 dark:text-sky-400">
                    {child.meta}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </ParentCard>
  );
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function CalendarCard({
  events = [],
  actionHref = "/parent/calendar",
  compact = true,
}) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const [cursor, setCursor] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );

  const eventsByDay = useMemo(() => {
    const map = new Map();
    (events || []).forEach((event) => {
      const start = startOfDay(event.startDate);
      const end = startOfDay(event.endDate || event.startDate);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;
      for (const day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
        const key = day.toDateString();
        const bucket = map.get(key) || [];
        bucket.push(event);
        map.set(key, bucket);
      }
    });
    return map;
  }, [events]);

  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const gridStart = new Date(first);
    gridStart.setDate(1 - first.getDay());

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      return {
        date,
        inMonth: date.getMonth() === cursor.getMonth(),
        isToday: sameDay(date, today),
        dayEvents: eventsByDay.get(date.toDateString()) || [],
      };
    });
  }, [cursor, today, eventsByDay]);

  const monthLabel = cursor.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  function shiftMonth(delta) {
    setCursor(
      (current) => new Date(current.getFullYear(), current.getMonth() + delta, 1),
    );
  }

  return (
    <ParentCard
      title="Calendar"
      actionLabel="View Full Calendar"
      actionHref={actionHref}
      icon={
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} className="h-5 w-5">
          <rect x="3.75" y="5" width="16.5" height="15" rx="2" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 3.5v3M16 3.5v3M3.75 10h16.5" />
        </svg>
      }
    >
      <div className="flex items-center justify-center gap-6 pb-2">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          aria-label="Previous month"
          className="grid h-7 w-7 place-items-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          <ChevronRight className="h-4 w-4 rotate-180" />
        </button>
        <div className={"text-sm font-black " + NAVY}>{monthLabel}</div>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          aria-label="Next month"
          className="grid h-7 w-7 place-items-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 border-t border-gray-100 text-center dark:border-gray-700">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="border-b border-gray-100 py-2 text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:text-gray-400"
          >
            {label}
          </div>
        ))}

        {cells.map((cell) => {
          const primaryEvent = cell.dayEvents[0];
          const isClosure = primaryEvent?.type === "HOLIDAY";
          return (
            <div
              key={cell.date.toISOString()}
              className={[
                "flex flex-col items-center gap-0.5 border-b border-gray-100 px-0.5 dark:border-gray-700",
                compact ? "min-h-[3rem] py-1.5" : "min-h-[5rem] py-2",
                cell.inMonth ? "" : "bg-gray-50/70 dark:bg-gray-900/30",
              ].join(" ")}
            >
              <span
                className={[
                  "grid h-6 w-6 place-items-center rounded-full text-xs font-bold",
                  cell.isToday
                    ? "bg-[#12386a] text-white"
                    : cell.inMonth
                      ? "text-gray-800 dark:text-gray-200"
                      : "text-gray-300 dark:text-gray-600",
                ].join(" ")}
              >
                {cell.date.getDate()}
              </span>
              {primaryEvent && cell.inMonth ? (
                <span
                  title={primaryEvent.title}
                  className={[
                    "w-full truncate px-0.5 text-[9px] font-bold leading-tight",
                    isClosure
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-sky-600 dark:text-sky-400",
                  ].join(" ")}
                >
                  {primaryEvent.title}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </ParentCard>
  );
}

export function TodaysMenuCard({
  rows,
  actionHref = "/parent/menus",
  title = "Today’s Menu",
}) {
  return (
    <ParentCard
      title={title}
      actionLabel="View Menu"
      actionHref={actionHref}
      bodyClassName="p-0"
      icon={
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} className="h-5 w-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 3v7a2 2 0 0 0 4 0V3M8 10v11M17.5 3c-1.4 1-2 2.8-2 5.5 0 1.7.6 2.7 2 3V21" />
        </svg>
      }
    >
      {!rows || rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
          No menu has been posted for today.
        </p>
      ) : (
        <table className="w-full text-left text-sm">
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {rows.map((row) => (
              <tr key={row.key}>
                <th
                  scope="row"
                  className={"w-1/3 px-4 py-2.5 align-top text-xs font-black " + NAVY}
                >
                  {row.label}
                </th>
                <td className="px-4 py-2.5 text-xs font-semibold text-sky-700 dark:text-sky-400">
                  {row.items}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </ParentCard>
  );
}
