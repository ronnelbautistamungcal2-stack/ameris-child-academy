function arr(v) {
  return Array.isArray(v) ? v : [];
}

function formatDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString();
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
  const now = new Date();
  let months = (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());
  if (now.getDate() < dob.getDate()) months -= 1;
  return months;
}

function getAgeGroup(birthDate) {
  const months = ageInMonths(birthDate);
  if (months === null) return null;
  return AGE_GROUPS.find((g) => months >= g.min && months <= g.max) || null;
}

function formatAge(birthDate) {
  const months = ageInMonths(birthDate);
  if (months === null) return "";
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years === 0) return `${rem} months`;
  if (rem === 0) return `${years} year${years > 1 ? "s" : ""}`;
  return `${years}y ${rem}mo`;
}

function inferDomain(row) {
  const cat = String(row?.lesson?.category?.name || "").toLowerCase();
  const title = String(row?.lesson?.title || "").toLowerCase();
  const text = `${cat} ${title}`;
  if (text.includes("social") || text.includes("emotion") || text.includes("behavior")) return "Social-Emotional";
  if (text.includes("physical") || text.includes("motor") || text.includes("movement")) return "Physical";
  if (text.includes("language") || text.includes("literacy") || text.includes("reading") || text.includes("phonics")) return "Language & Literacy";
  if (text.includes("creative") || text.includes("art") || text.includes("music")) return "Creative";
  return "Cognitive";
}

function isAgeRelevant(row, ageGroupKey) {
  if (!ageGroupKey) return true;
  const catAge = String(row?.lesson?.category?.ageRange || "").toLowerCase().trim();
  if (!catAge) return true;
  const group = AGE_GROUPS.find((g) => g.key === ageGroupKey);
  if (!group) return true;
  return catAge.includes(ageGroupKey) || catAge.includes(group.label.toLowerCase());
}

function recommendationForAge(status, months, domain) {
  const isInfant = months !== null && months <= 11;
  const isToddler = months !== null && months >= 12 && months <= 35;
  const isPreK = months !== null && months >= 36 && months <= 59;

  if (status === "FAILED") {
    if (isInfant) return `Break this ${domain} activity into sensory-based micro-steps. Use repetition with visual and tactile cues, then reassess in 1-2 weeks.`;
    if (isToddler) return `Re-introduce this ${domain} lesson through play-based activities. Use shorter sessions (5-10 min) with hands-on materials, reassess in 1-2 weeks.`;
    if (isPreK) return `Re-teach this ${domain} lesson in smaller steps using visual aids and group activities. Reassess within 2-3 sessions.`;
    return `Review this ${domain} lesson with guided practice and one-on-one support. Reassess within 2-3 sessions.`;
  }

  if (status === "IN_PROGRESS") {
    if (isInfant) return `Continue daily ${domain} exposure through caregiver interactions. Track small wins and repeat activities during routine care.`;
    if (isToddler) return `Add guided ${domain} practice during daily routines. Encourage parent follow-up with simple at-home activities this week.`;
    if (isPreK) return `Reinforce this ${domain} skill with structured practice activities. Add parent follow-up and peer-learning opportunities this week.`;
    return `Continue guided ${domain} practice with increasing independence. Add parent follow-up activities this week.`;
  }

  // NOT_STARTED
  if (isInfant) return `Introduce this ${domain} activity through gentle sensory play and caregiver modeling during daily routines.`;
  if (isToddler) return `Start this ${domain} lesson with short, engaging play-based sessions. Use songs, stories, or hands-on materials.`;
  if (isPreK) return `Schedule focused ${domain} practice sessions. Begin with teacher-guided activities, then transition to independent practice.`;
  return `Schedule focused ${domain} practice sessions and monitor progress checkpoints.`;
}

// Priority: FAILED > IN_PROGRESS > NOT_STARTED, then age-relevant first
function priorityScore(row, ageGroupKey) {
  let score = 0;
  if (row.status === "FAILED") score += 300;
  else if (row.status === "IN_PROGRESS") score += 200;
  else score += 100;

  if (isAgeRelevant(row, ageGroupKey)) score += 50;

  // More recent updates get slight priority
  const updated = new Date(row.updatedAt || row.createdAt || 0).getTime();
  score += updated / 1e15; // tiny tiebreaker

  return score;
}

export default function CatchupPlansPanel({ progressRows, childName, birthDate }) {
  const months = ageInMonths(birthDate);
  const ageGroup = getAgeGroup(birthDate);
  const ageLabel = formatAge(birthDate);
  const allRows = arr(progressRows);

  const totalSteps = allRows.length;
  const completedSteps = allRows.filter((r) => r?.status === "COMPLETED" || r?.status === "PASSED").length;
  const completionRate = totalSteps ? Math.round((completedSteps / totalSteps) * 100) : 0;

  const pending = allRows
    .filter((row) => ["FAILED", "NOT_STARTED", "IN_PROGRESS"].includes(row?.status))
    .sort((a, b) => priorityScore(b, ageGroup?.key) - priorityScore(a, ageGroup?.key))
    .slice(0, 12)
    .map((row, index) => {
      const domain = inferDomain(row);
      const relevant = isAgeRelevant(row, ageGroup?.key);
      return {
        id: row.id || `catchup-${index}`,
        title: row.lesson?.title || `Goal ${row.goalIndex || 1}`,
        status: row.status || "NOT_STARTED",
        domain,
        when: row.updatedAt || row.createdAt || null,
        recommendation: recommendationForAge(row.status, months, domain),
        ageRelevant: relevant,
        category: row.lesson?.category?.name || "",
      };
    });

  const failedCount = pending.filter((p) => p.status === "FAILED").length;
  const inProgressCount = pending.filter((p) => p.status === "IN_PROGRESS").length;
  const notStartedCount = pending.filter((p) => p.status === "NOT_STARTED").length;

  const statusColors = {
    FAILED: "border-red-200 bg-red-50",
    IN_PROGRESS: "border-amber-200 bg-amber-50",
    NOT_STARTED: "border-gray-200 bg-gray-50",
  };
  const statusTextColors = {
    FAILED: "text-red-700",
    IN_PROGRESS: "text-amber-700",
    NOT_STARTED: "text-gray-600",
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <h4 className="text-base font-extrabold text-gray-900">Catch-up Plans</h4>
      <p className="mt-1 text-sm text-gray-600">
        {childName
          ? `Auto-generated catch-up actions for ${childName}${ageLabel ? ` (${ageLabel}${ageGroup ? `, ${ageGroup.label} group` : ""})` : ""}.`
          : "Auto-generated catch-up actions based on progress records."}
      </p>

      {totalSteps > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-semibold text-gray-700">
            {completedSteps}/{totalSteps} steps completed ({completionRate}%)
          </span>
          {failedCount > 0 && (
            <span className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
              {failedCount} needs reteaching
            </span>
          )}
          {inProgressCount > 0 && (
            <span className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
              {inProgressCount} in progress
            </span>
          )}
          {notStartedCount > 0 && (
            <span className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-semibold text-gray-600">
              {notStartedCount} not started
            </span>
          )}
        </div>
      )}

      {pending.length ? (
        <div className="mt-3 space-y-2">
          {pending.map((item) => (
            <div
              key={item.id}
              className={[
                "rounded-xl border p-3",
                statusColors[item.status] || "border-gray-200 bg-gray-50",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-extrabold text-gray-900">{item.title}</div>
                {item.ageRelevant && ageGroup ? (
                  <span className="shrink-0 rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                    Age-appropriate
                  </span>
                ) : null}
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 text-xs">
                <span className={["font-semibold", statusTextColors[item.status] || "text-gray-600"].join(" ")}>
                  {item.status.replace("_", " ")}
                </span>
                <span className="text-gray-500">
                  {item.domain}
                </span>
                {item.category ? (
                  <span className="text-gray-400">{item.category}</span>
                ) : null}
                <span className="text-gray-400">
                  Updated: {formatDate(item.when)}
                </span>
              </div>
              <div className="mt-2 text-xs text-gray-700">{item.recommendation}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
          No catch-up plans needed right now. All steps are on track!
        </div>
      )}
    </div>
  );
}
