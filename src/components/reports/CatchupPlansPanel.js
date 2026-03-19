function arr(v) {
  return Array.isArray(v) ? v : [];
}

function formatDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? "-"
    : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(d);
}

const AGE_GROUPS = [
  { key: "0-1", label: "0-1 year", min: 0, max: 11 },
  { key: "2", label: "2 years", min: 12, max: 23 },
  { key: "3", label: "3 years", min: 24, max: 35 },
  { key: "4-5", label: "4-5 years", min: 36, max: 59 },
  { key: "6-7", label: "6-7 years", min: 60, max: 83 },
  { key: "8-12", label: "8-12 years", min: 84, max: 143 },
];

function ageInMonths(birthDate) {
  if (!birthDate) return null;
  const dob = new Date(birthDate);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let months = (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());
  if (now.getDate() < dob.getDate()) months -= 1;
  return months < 0 ? 0 : months;
}

function getAgeGroup(birthDate) {
  const months = ageInMonths(birthDate);
  if (months === null) return null;
  return AGE_GROUPS.find((group) => months >= group.min && months <= group.max) || null;
}

function formatAge(birthDate) {
  const months = ageInMonths(birthDate);
  if (months === null) return "";
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (years === 0) return `${remainingMonths} months`;
  if (remainingMonths === 0) return `${years} year${years > 1 ? "s" : ""}`;
  return `${years}y ${remainingMonths}mo`;
}

function inferDomain(row) {
  const category = String(row?.lesson?.category?.name || "").toLowerCase();
  const title = String(row?.lesson?.title || "").toLowerCase();
  const text = `${category} ${title}`;
  if (text.includes("social") || text.includes("emotion") || text.includes("behavior")) return "Social-Emotional";
  if (text.includes("physical") || text.includes("motor") || text.includes("movement")) return "Physical";
  if (text.includes("language") || text.includes("literacy") || text.includes("reading") || text.includes("phonics")) {
    return "Language & Literacy";
  }
  if (text.includes("creative") || text.includes("art") || text.includes("music")) return "Creative";
  return "Cognitive";
}

function isAgeRelevant(row, ageGroupKey) {
  if (!ageGroupKey) return true;
  const categoryAge = String(row?.lesson?.category?.ageRange || "").toLowerCase().trim();
  if (!categoryAge) return true;
  const group = AGE_GROUPS.find((entry) => entry.key === ageGroupKey);
  if (!group) return true;
  return categoryAge.includes(ageGroupKey) || categoryAge.includes(group.label.toLowerCase());
}

function recommendationForAge(status, months, domain) {
  const isInfant = months !== null && months <= 11;
  const isToddler = months !== null && months >= 12 && months <= 35;
  const isPreK = months !== null && months >= 36 && months <= 59;

  if (status === "FAILED") {
    if (isInfant) return `Break this ${domain} activity into sensory-based micro-steps and repeat it during routines for the next 1-2 weeks.`;
    if (isToddler) return `Re-introduce this ${domain} goal through short play-based sessions with hands-on materials and check again next week.`;
    if (isPreK) return `Re-teach this ${domain} lesson in smaller chunks with visual cues, then revisit it after 2-3 classroom sessions.`;
    return `Review this ${domain} lesson with guided practice and extra one-on-one support before moving forward.`;
  }

  if (status === "IN_PROGRESS") {
    if (isInfant) return `Continue daily ${domain} exposure through caregiver interaction and note small wins during routine care.`;
    if (isToddler) return `Add guided ${domain} practice into home routines and keep the activity short, playful, and repeatable this week.`;
    if (isPreK) return `Reinforce this ${domain} skill with structured practice and simple follow-up activities at home this week.`;
    return `Keep reinforcing this ${domain} skill with guided practice until the center logs a stronger level of independence.`;
  }

  if (isInfant) return `Introduce this ${domain} activity through gentle sensory play and caregiver modeling during regular routines.`;
  if (isToddler) return `Start this ${domain} lesson with short, engaging play sessions using songs, stories, or hands-on materials.`;
  if (isPreK) return `Schedule focused ${domain} practice and start with teacher-guided or parent-guided activities before expecting independence.`;
  return `Plan a focused ${domain} practice block and watch for the first progress checkpoint from the center.`;
}

function priorityScore(row, ageGroupKey) {
  let score = 0;
  if (row.status === "FAILED") score += 300;
  else if (row.status === "IN_PROGRESS") score += 200;
  else score += 100;

  if (isAgeRelevant(row, ageGroupKey)) score += 50;

  const updated = new Date(row.updatedAt || row.createdAt || 0).getTime();
  score += updated / 1e15;
  return score;
}

function statusMeta(status) {
  if (status === "FAILED") {
    return {
      label: "Needs reteaching",
      eyebrow: "Priority support",
      badge: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/50 dark:text-rose-200",
      card: "border-rose-200 dark:border-rose-900/70",
    };
  }
  if (status === "IN_PROGRESS") {
    return {
      label: "In progress",
      eyebrow: "Keep building",
      badge: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/50 dark:text-amber-200",
      card: "border-amber-200 dark:border-amber-900/70",
    };
  }
  return {
    label: "Not started",
    eyebrow: "Ready to begin",
    badge: "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-slate-800 dark:text-gray-200",
    card: "border-gray-200 dark:border-gray-700",
  };
}

function SummaryStat({ label, value, hint, tone = "rose" }) {
  const tones = {
    rose: "border-rose-200 bg-white/80 text-rose-900 dark:border-rose-900/70 dark:bg-slate-900/80 dark:text-rose-100",
    amber: "border-amber-200 bg-white/80 text-amber-900 dark:border-amber-900/70 dark:bg-slate-900/80 dark:text-amber-100",
    emerald: "border-emerald-200 bg-white/80 text-emerald-900 dark:border-emerald-900/70 dark:bg-slate-900/80 dark:text-emerald-100",
    sky: "border-sky-200 bg-white/80 text-sky-900 dark:border-sky-900/70 dark:bg-slate-900/80 dark:text-sky-100",
  };

  return (
    <div className={`flex h-full min-h-[88px] flex-col rounded-[18px] border p-3 shadow-sm ${tones[tone] || tones.rose}`}>
      <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] opacity-70">{label}</div>
      <div className="mt-2 break-words text-[clamp(1.05rem,1.8vw,1.4rem)] font-black leading-tight tracking-tight">{value}</div>
      <div className="mt-auto pt-2 text-[11px] leading-4 text-gray-600 dark:text-gray-300">{hint}</div>
    </div>
  );
}

export default function CatchupPlansPanel({ progressRows, childName, birthDate }) {
  const months = ageInMonths(birthDate);
  const ageGroup = getAgeGroup(birthDate);
  const ageLabel = formatAge(birthDate);
  const allRows = arr(progressRows);

  const totalSteps = allRows.length;
  const completedSteps = allRows.filter((row) => row?.status === "COMPLETED" || row?.status === "PASSED").length;
  const completionRate = totalSteps ? Math.round((completedSteps / totalSteps) * 100) : 0;

  const pending = allRows
    .filter((row) => ["FAILED", "NOT_STARTED", "IN_PROGRESS"].includes(row?.status))
    .sort((a, b) => priorityScore(b, ageGroup?.key) - priorityScore(a, ageGroup?.key))
    .slice(0, 8)
    .map((row, index) => {
      const domain = inferDomain(row);
      return {
        id: row.id || `catchup-${index}`,
        title: row.lesson?.title || `Goal ${row.goalIndex || 1}`,
        status: row.status || "NOT_STARTED",
        domain,
        when: row.updatedAt || row.createdAt || null,
        recommendation: recommendationForAge(row.status, months, domain),
        ageRelevant: isAgeRelevant(row, ageGroup?.key),
        category: row.lesson?.category?.name || "",
      };
    });

  const failedCount = pending.filter((item) => item.status === "FAILED").length;
  const inProgressCount = pending.filter((item) => item.status === "IN_PROGRESS").length;
  const notStartedCount = pending.filter((item) => item.status === "NOT_STARTED").length;
  const ageAlignedCount = pending.filter((item) => item.ageRelevant).length;

  return (
    <div className="space-y-3">
      <div className="rounded-[24px] border border-rose-200 bg-gradient-to-br from-white via-rose-50/80 to-amber-50 p-4 shadow-sm dark:border-rose-900/60 dark:bg-gradient-to-br dark:from-slate-950 dark:via-rose-950/25 dark:to-amber-950/20">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-rose-600">Support plan</div>
            <h4 className="mt-1.5 text-xl font-black tracking-tight text-gray-900 dark:text-gray-100">Catch-up plans</h4>
            <p className="mt-1.5 text-[13px] leading-5 text-gray-700 dark:text-gray-300">
              {childName
                ? `Focused follow-up actions for ${childName}${ageLabel ? ` (${ageLabel}${ageGroup ? `, ${ageGroup.label}` : ""})` : ""}.`
                : "Focused follow-up actions based on current progress records."}
            </p>
          </div>
          <div className="rounded-full border border-white/70 bg-white/80 px-3 py-1.5 text-[13px] font-semibold text-gray-700 shadow-sm dark:border-gray-700 dark:bg-slate-900/90 dark:text-gray-200">
            {pending.length ? `${pending.length} active plan${pending.length !== 1 ? "s" : ""}` : "All goals are on track"}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5 xl:grid-cols-4">
          <SummaryStat
            label="Plans ready"
            value={pending.length}
            hint="Current priorities surfaced for parent follow-up"
            tone="rose"
          />
          <SummaryStat
            label="Age-aligned"
            value={ageAlignedCount}
            hint="Plans matched to the child age group"
            tone="amber"
          />
          <SummaryStat
            label="Completed"
            value={completedSteps}
            hint="Goals already cleared by the center"
            tone="emerald"
          />
          <SummaryStat
            label="Coverage"
            value={`${completionRate}%`}
            hint="Share of tracked steps already completed"
            tone="sky"
          />
        </div>
      </div>

      {pending.length ? (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_260px] 2xl:grid-cols-[minmax(0,1.05fr)_280px]">
          <div className="space-y-2.5">
            {pending.map((item) => {
              const meta = statusMeta(item.status);
              return (
                <div key={item.id} className={`rounded-[22px] border bg-white p-4 shadow-sm dark:bg-slate-900 ${meta.card}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                        {meta.eyebrow}
                      </div>
                      <div className="mt-1 text-sm font-black tracking-tight text-gray-900 dark:text-gray-100">{item.title}</div>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${meta.badge}`}>
                      {meta.label}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-semibold text-gray-700 dark:border-gray-700 dark:bg-slate-800 dark:text-gray-200">
                      {item.domain}
                    </span>
                    {item.category ? (
                      <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-semibold text-gray-700 dark:border-gray-700 dark:bg-slate-800 dark:text-gray-200">
                        {item.category}
                      </span>
                    ) : null}
                    <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-semibold text-gray-700 dark:border-gray-700 dark:bg-slate-800 dark:text-gray-200">
                      Updated {formatDate(item.when)}
                    </span>
                    {item.ageRelevant ? (
                      <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200">
                        Age-appropriate
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-3 rounded-[16px] border border-gray-200 bg-gray-50/80 p-3.5 dark:border-gray-700 dark:bg-slate-800/90">
                    <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                      Suggested next move
                    </div>
                    <div className="mt-2 text-[13px] leading-5 text-gray-700 dark:text-gray-200">{item.recommendation}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-2.5">
            <div className="rounded-[22px] border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-slate-900">
              <div className="text-base font-black tracking-tight text-gray-900 dark:text-gray-100">How parents can use this</div>
              <div className="mt-3 space-y-2.5 text-[13px] leading-5 text-gray-700 dark:text-gray-300">
                <p>Start with plans marked "Needs reteaching" because those are the clearest signals that a skill needs extra repetition.</p>
                <p>Use the domain labels to ask sharper questions during pickup, for example whether support is needed in language, behavior, or motor work.</p>
                <p>Once the center marks a plan as completed or passed, it will drop out of this view and remain reflected in overall progress.</p>
              </div>
            </div>

            <div className="rounded-[22px] border border-gray-200 bg-gray-50/90 p-4 shadow-sm dark:border-gray-800 dark:bg-slate-900">
              <div className="text-base font-black tracking-tight text-gray-900 dark:text-gray-100">Priority snapshot</div>
              <div className="mt-3 space-y-2.5">
                {[
                  { label: "Needs reteaching", value: failedCount, tone: "bg-rose-400" },
                  { label: "In progress", value: inProgressCount, tone: "bg-amber-400" },
                  { label: "Not started", value: notStartedCount, tone: "bg-gray-400" },
                ].map((item) => {
                  const width = pending.length ? Math.max((item.value / pending.length) * 100, item.value ? 10 : 0) : 0;
                  return (
                    <div key={item.label}>
                      <div className="flex items-center justify-between text-sm font-semibold text-gray-700 dark:text-gray-200">
                        <span>{item.label}</span>
                        <span>{item.value}</span>
                      </div>
                      <div className="mt-1.5 h-2 rounded-full bg-white dark:bg-slate-800">
                        <div className={`h-full rounded-full ${item.tone}`} style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-[24px] border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm dark:border-emerald-900/60 dark:bg-gradient-to-br dark:from-emerald-950/25 dark:to-slate-950">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-emerald-700">Good standing</div>
          <div className="mt-1.5 text-xl font-black tracking-tight text-gray-900 dark:text-gray-100">No catch-up plans needed right now</div>
          <div className="mt-1.5 text-[13px] leading-5 text-gray-700 dark:text-gray-300">
            Every tracked step is currently on pace or already completed. This tab will automatically surface new support items if progress changes.
          </div>
        </div>
      )}
    </div>
  );
}
