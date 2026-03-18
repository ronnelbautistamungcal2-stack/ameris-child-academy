import Link from "next/link";

const TONE_STYLES = {
  amber: {
    metric:
      "border-amber-200 bg-white/90 shadow-sm shadow-amber-100/60 dark:border-amber-900/60 dark:bg-slate-900/80",
    icon: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    value: "text-amber-900 dark:text-amber-200",
    badge:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300",
    chipActive: "bg-amber-500 text-white shadow-sm shadow-amber-200",
    chipIdle:
      "border border-amber-200 bg-white text-amber-700 hover:bg-amber-50 dark:border-amber-900/60 dark:bg-slate-900 dark:text-amber-300 dark:hover:bg-amber-950/30",
    action:
      "border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 hover:border-amber-300 hover:from-amber-100 hover:to-orange-100 dark:border-amber-900/60 dark:from-amber-950/20 dark:via-slate-900 dark:to-orange-950/20",
  },
  sky: {
    metric:
      "border-sky-200 bg-white/90 shadow-sm shadow-sky-100/60 dark:border-sky-900/60 dark:bg-slate-900/80",
    icon: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
    value: "text-sky-900 dark:text-sky-200",
    badge:
      "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-300",
    chipActive: "bg-sky-600 text-white shadow-sm shadow-sky-200",
    chipIdle:
      "border border-sky-200 bg-white text-sky-700 hover:bg-sky-50 dark:border-sky-900/60 dark:bg-slate-900 dark:text-sky-300 dark:hover:bg-sky-950/30",
    action:
      "border-sky-200 bg-gradient-to-br from-sky-50 via-white to-cyan-50 hover:border-sky-300 hover:from-sky-100 hover:to-cyan-100 dark:border-sky-900/60 dark:from-sky-950/20 dark:via-slate-900 dark:to-cyan-950/20",
  },
  emerald: {
    metric:
      "border-emerald-200 bg-white/90 shadow-sm shadow-emerald-100/60 dark:border-emerald-900/60 dark:bg-slate-900/80",
    icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    value: "text-emerald-900 dark:text-emerald-200",
    badge:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300",
    chipActive: "bg-emerald-600 text-white shadow-sm shadow-emerald-200",
    chipIdle:
      "border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/60 dark:bg-slate-900 dark:text-emerald-300 dark:hover:bg-emerald-950/30",
    action:
      "border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50 hover:border-emerald-300 hover:from-emerald-100 hover:to-teal-100 dark:border-emerald-900/60 dark:from-emerald-950/20 dark:via-slate-900 dark:to-teal-950/20",
  },
  rose: {
    metric:
      "border-rose-200 bg-white/90 shadow-sm shadow-rose-100/60 dark:border-rose-900/60 dark:bg-slate-900/80",
    icon: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
    value: "text-rose-900 dark:text-rose-200",
    badge:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300",
    chipActive: "bg-rose-600 text-white shadow-sm shadow-rose-200",
    chipIdle:
      "border border-rose-200 bg-white text-rose-700 hover:bg-rose-50 dark:border-rose-900/60 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-950/30",
    action:
      "border-rose-200 bg-gradient-to-br from-rose-50 via-white to-orange-50 hover:border-rose-300 hover:from-rose-100 hover:to-orange-100 dark:border-rose-900/60 dark:from-rose-950/20 dark:via-slate-900 dark:to-orange-950/20",
  },
  slate: {
    metric:
      "border-slate-200 bg-white/90 shadow-sm shadow-slate-100/70 dark:border-slate-700 dark:bg-slate-900/80",
    icon: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    value: "text-slate-900 dark:text-slate-100",
    badge:
      "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
    chipActive: "bg-slate-900 text-white shadow-sm shadow-slate-300 dark:bg-slate-700",
    chipIdle:
      "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800",
    action:
      "border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-100 hover:border-slate-300 hover:from-slate-100 hover:to-slate-200 dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800",
  },
};

export const coachInputClass =
  "w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-2.5 text-sm text-gray-900 shadow-sm transition focus:border-amber-300 focus:outline-none focus:ring-4 focus:ring-amber-100 dark:border-slate-700 dark:bg-slate-900/80 dark:text-gray-100 dark:focus:border-amber-700 dark:focus:ring-amber-950/40";

export const coachTextareaClass = `${coachInputClass} resize-y`;

export const coachPrimaryButtonClass =
  "inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:from-amber-600 hover:to-orange-600 disabled:cursor-not-allowed disabled:opacity-60";

export const coachSecondaryButtonClass =
  "inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800";

export const coachDangerButtonClass =
  "inline-flex items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-700 shadow-sm transition hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300";

export function CoachPageHero({
  eyebrow = "Coach Workspace",
  title,
  description,
  meta,
  controls,
  actions,
  stats,
  children,
}) {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-amber-200/70 bg-gradient-to-br from-amber-50 via-white to-sky-50 p-6 shadow-sm shadow-amber-100/70 dark:border-amber-900/40 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-900 dark:to-sky-950/40">
      <div className="pointer-events-none absolute -right-14 -top-16 h-44 w-44 rounded-full bg-amber-200/45 blur-3xl dark:bg-amber-500/10" />
      <div className="pointer-events-none absolute -bottom-20 left-0 h-44 w-44 rounded-full bg-sky-200/45 blur-3xl dark:bg-sky-500/10" />

      <div className="relative flex flex-col gap-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-amber-700 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 dark:text-amber-300">
              {eyebrow}
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-gray-900 dark:text-gray-100 sm:text-[2.15rem]">
              {title}
            </h1>
            {description ? (
              <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-400">
                {description}
              </p>
            ) : null}
            {meta ? <div className="mt-4 flex flex-wrap gap-2">{meta}</div> : null}
          </div>

          {(controls || actions) && (
            <div className="flex w-full flex-col gap-3 xl:w-auto xl:min-w-[260px] xl:max-w-sm">
              {controls}
              {actions}
            </div>
          )}
        </div>

        {children}
        {stats ? <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{stats}</div> : null}
      </div>
    </section>
  );
}

export function CoachMetricCard({ label, value, hint, tone = "amber", icon, href }) {
  const style = TONE_STYLES[tone] || TONE_STYLES.slate;
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
            {label}
          </div>
          <div className={`mt-2 text-3xl font-black tracking-tight ${style.value}`}>{value}</div>
        </div>
        {icon ? (
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${style.icon}`}>
            {icon}
          </div>
        ) : null}
      </div>
      {hint ? (
        <div className="mt-3 flex items-center justify-between gap-2 text-sm text-gray-600 dark:text-gray-400">
          <span>{hint}</span>
          {href ? (
            <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">
              Open
            </span>
          ) : null}
        </div>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={`group rounded-[1.6rem] border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${style.metric}`}
      >
        {content}
      </Link>
    );
  }

  return <div className={`rounded-[1.6rem] border p-4 ${style.metric}`}>{content}</div>;
}

export function CoachPanel({
  title,
  description,
  action,
  children,
  className = "",
  tone = "slate",
  padded = true,
}) {
  const style = TONE_STYLES[tone] || TONE_STYLES.slate;

  return (
    <section
      className={[
        "rounded-[1.8rem] border bg-white/90 shadow-sm dark:bg-slate-900/85",
        style.metric,
        padded ? "p-5" : "",
        className,
      ].join(" ")}
    >
      {(title || description || action) && (
        <div className={padded ? "" : "px-5 pt-5"}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              {title ? (
                <h2 className="text-base font-black text-gray-900 dark:text-gray-100">{title}</h2>
              ) : null}
              {description ? (
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{description}</p>
              ) : null}
            </div>
            {action}
          </div>
        </div>
      )}
      <div className={title || description || action ? (padded ? "mt-4" : "mt-4 px-5 pb-5") : ""}>
        {children}
      </div>
    </section>
  );
}

export function CoachActionCard({ href, title, description, tone = "amber", icon }) {
  const style = TONE_STYLES[tone] || TONE_STYLES.slate;

  return (
    <Link
      href={href}
      className={`group flex items-start gap-3 rounded-[1.4rem] border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${style.action}`}
    >
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${style.icon}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-black text-gray-900 dark:text-gray-100">{title}</div>
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 group-hover:translate-x-0.5"
          >
            <path
              fillRule="evenodd"
              d="M5 10a.75.75 0 01.75-.75h6.638L10.23 7.29a.75.75 0 111.04-1.08l3.5 3.25a.75.75 0 010 1.08l-3.5 3.25a.75.75 0 11-1.04-1.08l2.158-1.96H5.75A.75.75 0 015 10z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{description}</p>
      </div>
    </Link>
  );
}

export function CoachChipButton({
  active,
  children,
  onClick,
  tone = "slate",
  className = "",
  type = "button",
}) {
  const style = TONE_STYLES[tone] || TONE_STYLES.slate;

  return (
    <button
      type={type}
      onClick={onClick}
      className={[
        "rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.12em] transition",
        active ? style.chipActive : style.chipIdle,
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export function CoachBadge({ children, tone = "slate", className = "" }) {
  const style = TONE_STYLES[tone] || TONE_STYLES.slate;
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold",
        style.badge,
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

export function CoachEmptyPanel({
  title,
  description,
  action,
  className = "",
  icon,
}) {
  return (
    <div
      className={[
        "rounded-[1.6rem] border border-dashed border-slate-300 bg-slate-50/80 px-6 py-10 text-center dark:border-slate-700 dark:bg-slate-900/70",
        className,
      ].join(" ")}
    >
      <div className="mx-auto flex max-w-md flex-col items-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm dark:bg-slate-800 dark:text-slate-500">
          {icon || (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-6 w-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5v14" />
            </svg>
          )}
        </div>
        <h3 className="mt-4 text-base font-black text-gray-900 dark:text-gray-100">{title}</h3>
        {description ? (
          <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-400">{description}</p>
        ) : null}
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </div>
  );
}
