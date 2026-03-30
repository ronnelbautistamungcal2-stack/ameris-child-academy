import Link from "next/link";

const TONE_STYLES = {
  sky: {
    card:
      "border-sky-200 bg-white/90 shadow-sm shadow-sky-100/70 dark:border-sky-900/50 dark:bg-gray-900/85",
    pill:
      "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-300",
    icon: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
    value: "text-sky-900 dark:text-sky-200",
  },
  amber: {
    card:
      "border-amber-200 bg-white/90 shadow-sm shadow-amber-100/70 dark:border-amber-900/50 dark:bg-gray-900/85",
    pill:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300",
    icon: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    value: "text-amber-900 dark:text-amber-200",
  },
  emerald: {
    card:
      "border-emerald-200 bg-white/90 shadow-sm shadow-emerald-100/70 dark:border-emerald-900/50 dark:bg-gray-900/85",
    pill:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300",
    icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    value: "text-emerald-900 dark:text-emerald-200",
  },
  rose: {
    card:
      "border-rose-200 bg-white/90 shadow-sm shadow-rose-100/70 dark:border-rose-900/50 dark:bg-gray-900/85",
    pill:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300",
    icon: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
    value: "text-rose-900 dark:text-rose-200",
  },
  slate: {
    card:
      "border-gray-200 bg-white/90 shadow-sm shadow-slate-100/80 dark:border-gray-700 dark:bg-gray-900/85",
    pill:
      "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300",
    icon: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200",
    value: "text-gray-900 dark:text-gray-100",
  },
};

export const workspaceInputClass =
  "w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm transition focus:border-sky-300 focus:outline-none focus:ring-4 focus:ring-sky-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-sky-700 dark:focus:ring-sky-900/40";

export const workspacePrimaryButtonClass =
  "inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-sky-600 to-blue-600 px-4 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:from-sky-700 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-60";

export const workspaceSecondaryButtonClass =
  "inline-flex items-center justify-center rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 shadow-sm transition hover:border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700";

export const workspaceDangerButtonClass =
  "inline-flex items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-700 shadow-sm transition hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300";

export function WorkspacePill({ children, tone = "slate", className = "" }) {
  const style = TONE_STYLES[tone] || TONE_STYLES.slate;

  return (
    <span
      className={[
        "inline-flex max-w-full items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold",
        style.pill,
        className,
      ].join(" ")}
    >
      <span className="min-w-0 break-words">{children}</span>
    </span>
  );
}

export function WorkspaceHero({
  eyebrow = "Workspace",
  title,
  description,
  meta,
  controls,
  actions,
  stats,
  className = "",
}) {
  return (
    <section
      className={[
        "relative overflow-hidden rounded-[2rem] border border-sky-200/70 bg-gradient-to-br from-white via-sky-50/70 to-amber-50/45 p-6 shadow-sm dark:border-sky-900/40 dark:from-gray-900 dark:via-gray-900 dark:to-sky-950/25",
        className,
      ].join(" ")}
    >
      <div className="pointer-events-none absolute -left-10 top-0 h-36 w-36 rounded-full bg-sky-200/35 blur-3xl dark:bg-sky-500/10" />
      <div className="pointer-events-none absolute -bottom-16 right-0 h-40 w-40 rounded-full bg-amber-200/35 blur-3xl dark:bg-amber-500/10" />

      <div className="relative flex flex-col gap-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/80 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-sky-700 shadow-sm dark:border-gray-700 dark:bg-gray-900/90 dark:text-sky-300">
              {eyebrow}
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-gray-900 dark:text-gray-100 sm:text-[2.1rem]">
              {title}
            </h1>
            {description ? (
              <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-400">
                {description}
              </p>
            ) : null}
            {meta ? <div className="mt-4 flex flex-wrap gap-2">{meta}</div> : null}
          </div>

          {(controls || actions) ? (
            <div className="flex w-full flex-col gap-3 xl:w-auto xl:min-w-[280px] xl:max-w-sm">
              {controls}
              {actions}
            </div>
          ) : null}
        </div>

        {stats ? <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{stats}</div> : null}
      </div>
    </section>
  );
}

export function WorkspaceStat({
  label,
  value,
  description,
  tone = "slate",
  icon,
  href,
}) {
  const style = TONE_STYLES[tone] || TONE_STYLES.slate;
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
            {label}
          </div>
          <div className={["mt-2 break-words text-2xl font-black tracking-tight", style.value].join(" ")}>
            {value}
          </div>
        </div>
        {icon ? (
          <div className={["flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", style.icon].join(" ")}>
            {icon}
          </div>
        ) : null}
      </div>
      {description ? (
        <div className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-400">
          {description}
        </div>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={["rounded-[1.6rem] border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md", style.card].join(" ")}
      >
        {content}
      </Link>
    );
  }

  return <div className={["rounded-[1.6rem] border p-4", style.card].join(" ")}>{content}</div>;
}

export function WorkspaceSection({
  title,
  description,
  action,
  children,
  className = "",
}) {
  return (
    <section
      className={[
        "rounded-[1.8rem] border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900/85",
        className,
      ].join(" ")}
    >
      {(title || description || action) ? (
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
      ) : null}
      <div className={title || description || action ? "mt-4" : ""}>{children}</div>
    </section>
  );
}

export function WorkspaceState({
  title,
  description,
  action,
  className = "",
  icon,
}) {
  return (
    <div
      className={[
        "rounded-[1.6rem] border border-dashed border-gray-300 bg-gray-50/80 px-6 py-10 text-center dark:border-gray-700 dark:bg-gray-900/70",
        className,
      ].join(" ")}
    >
      <div className="mx-auto flex max-w-md flex-col items-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-gray-400 shadow-sm dark:bg-gray-800 dark:text-gray-500">
          {icon || (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-6 w-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12h15m-7.5-7.5v15" />
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
