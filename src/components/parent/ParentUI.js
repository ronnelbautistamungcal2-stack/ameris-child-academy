import Link from "next/link";

export function ParentPageHeader({
  eyebrow = "Parent portal",
  title,
  description,
  actions,
  stats = [],
  accent = "sky",
  layout = "default",
}) {
  const accentMap = {
    sky: "from-sky-600 via-cyan-500 to-blue-500",
    emerald: "from-emerald-600 via-teal-500 to-cyan-500",
    amber: "from-amber-500 via-orange-500 to-rose-500",
  };
  const layoutClass =
    layout === "split"
      ? "grid grid-cols-1 gap-5 lg:grid-cols-[1.2fr_0.8fr] lg:items-end"
      : "flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between";

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-white/60 bg-white p-6 shadow-[0_24px_80px_-48px_rgba(14,116,144,0.55)] dark:border-gray-700 dark:bg-gray-800">
      <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${accentMap[accent] || accentMap.sky}`} />
      <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-sky-100/70 blur-3xl dark:bg-sky-900/20" />
      <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-amber-100/60 blur-3xl dark:bg-amber-900/10" />

      <div className={`relative ${layoutClass}`}>
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.24em] text-sky-700 dark:border-sky-800 dark:bg-sky-900/30 dark:text-sky-300">
            {eyebrow}
          </div>
          <h1 className="mt-3 text-2xl font-black tracking-tight text-gray-900 dark:text-gray-100 sm:text-3xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-400 sm:text-[15px]">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>

      {stats.length ? (
        <div className="relative mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <InfoStatCard key={stat.label} {...stat} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function ParentSurface({ children, className = "" }) {
  return (
    <section className={`rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800 ${className}`.trim()}>
      {children}
    </section>
  );
}

export function ParentSection({
  title,
  description,
  action,
  children,
  className = "",
  headerClassName = "",
  bodyClassName = "",
}) {
  return (
    <ParentSurface className={className}>
      {(title || description || action) ? (
        <div className={`flex flex-col gap-3 border-b border-gray-100 pb-4 dark:border-gray-700 sm:flex-row sm:items-start sm:justify-between ${headerClassName}`.trim()}>
          <div>
            {title ? (
              <h2 className="text-lg font-black tracking-tight text-gray-900 dark:text-gray-100">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {description}
              </p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <div className={`${title || description || action ? "pt-4" : ""} ${bodyClassName}`.trim()}>{children}</div>
    </ParentSurface>
  );
}

export function InfoStatCard({
  label,
  value,
  hint,
  tone = "sky",
  icon,
}) {
  const tones = {
    sky: "border-sky-200 bg-sky-50/80 text-sky-900",
    emerald: "border-emerald-200 bg-emerald-50/80 text-emerald-900",
    amber: "border-amber-200 bg-amber-50/80 text-amber-900",
    rose: "border-rose-200 bg-rose-50/80 text-rose-900",
    gray: "border-gray-200 bg-gray-50/90 text-gray-900",
  };

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone] || tones.sky}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
          {label}
        </div>
        {icon ? <div className="text-current/80">{icon}</div> : null}
      </div>
      <div className="mt-2 text-2xl font-black tracking-tight">{value}</div>
      {hint ? (
        <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">{hint}</div>
      ) : null}
    </div>
  );
}

export function ParentQuickAction({
  href,
  title,
  description,
  tone = "sky",
  icon,
}) {
  const tones = {
    sky: "hover:border-sky-200 hover:bg-sky-50/80",
    emerald: "hover:border-emerald-200 hover:bg-emerald-50/80",
    amber: "hover:border-amber-200 hover:bg-amber-50/80",
    rose: "hover:border-rose-200 hover:bg-rose-50/80",
  };

  return (
    <Link
      href={href}
      className={`group rounded-2xl border border-gray-200 bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 ${tones[tone] || tones.sky}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-extrabold text-gray-900 dark:text-gray-100">{title}</div>
          <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">{description}</div>
        </div>
        {icon ? <div className="text-sky-500 transition group-hover:translate-x-0.5">{icon}</div> : null}
      </div>
    </Link>
  );
}

export function ParentButton({
  href,
  children,
  variant = "primary",
  className = "",
  ...props
}) {
  const base = "inline-flex items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-extrabold transition";
  const variants = {
    primary: "bg-gradient-to-r from-sky-600 to-cyan-500 text-white shadow-sm hover:from-sky-700 hover:to-cyan-600",
    secondary: "border border-gray-200 bg-white text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700",
    soft: "border border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
  };
  const cls = `${base} ${variants[variant] || variants.primary} ${className}`.trim();

  if (href) {
    return (
      <Link href={href} className={cls} {...props}>
        {children}
      </Link>
    );
  }

  return (
    <button className={cls} {...props}>
      {children}
    </button>
  );
}

export function ParentPill({ active, children, onClick, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-2xl border px-3.5 py-2 text-sm font-bold transition-all duration-150",
        active
          ? "border-sky-300 bg-sky-50 text-sky-900 shadow-sm ring-2 ring-sky-100 dark:border-sky-700 dark:bg-sky-900/30 dark:text-sky-200 dark:ring-sky-900/40"
          : "border-gray-200 bg-white text-gray-700 hover:border-sky-200 hover:bg-sky-50/60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300",
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export function ParentEmpty({
  title,
  description,
  action,
}) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50/80 p-6 text-center dark:border-gray-600 dark:bg-gray-900/40">
      <div className="text-base font-extrabold text-gray-900 dark:text-gray-100">{title}</div>
      {description ? (
        <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">{description}</div>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ParentField({ label, hint, children }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-xs font-extrabold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
        {label}
      </div>
      {children}
      {hint ? <div className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{hint}</div> : null}
    </label>
  );
}
