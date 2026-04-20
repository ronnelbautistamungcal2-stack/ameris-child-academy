import ParentLayout from "@/components/parent/ParentLayout";
import {
  ParentButton,
  ParentEmpty,
  ParentPageHeader,
  ParentSection,
  ParentSurface,
} from "@/components/parent/ParentUI";
import Skeleton from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

const TOPIC_SHORTCUTS = [
  {
    id: "pickup",
    label: "Pickup & release",
    description: "Dismissal rules, guardians, and release procedures.",
    tone: "sky",
    terms: ["pickup", "drop off", "drop-off", "release", "guardian"],
  },
  {
    id: "health",
    label: "Illness & attendance",
    description: "Sick-day guidance, absences, and when children can return.",
    tone: "amber",
    terms: ["illness", "sick", "attendance", "absence", "fever", "return"],
  },
  {
    id: "billing",
    label: "Billing & payments",
    description: "Tuition, invoices, payment expectations, and account reminders.",
    tone: "emerald",
    terms: ["billing", "payment", "tuition", "invoice", "account"],
  },
  {
    id: "enrollment",
    label: "Enrollment & forms",
    description: "Registration, renewals, medical paperwork, and required documents.",
    tone: "sky",
    terms: ["enrollment", "renewal", "form", "medical", "document", "registration"],
  },
];

export default function ParentPolicies() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const result = await apiJson("/api/v1/policies");
        setDocs(Array.isArray(result) ? result : []);
      } catch (e) {
        setError(e.message || "Failed to load policies");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const sortedDocs = useMemo(
    () =>
      [...docs].sort((a, b) =>
        String(a.title || "").localeCompare(String(b.title || "")),
      ),
    [docs],
  );

  const filteredDocs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return sortedDocs;
    return sortedDocs.filter((doc) =>
      buildPolicyText(doc).includes(normalizedQuery),
    );
  }, [query, sortedDocs]);

  const featuredDoc = useMemo(() => {
    if (!sortedDocs.length) return null;
    return (
      sortedDocs.find((doc) =>
        /handbook|parent handbook|family handbook/i.test(
          `${doc.title || ""} ${doc.description || ""}`,
        ),
      ) || sortedDocs[0]
    );
  }, [sortedDocs]);

  const topicSummaries = useMemo(
    () =>
      TOPIC_SHORTCUTS.map((topic) => ({
        ...topic,
        count: sortedDocs.filter((doc) => matchesPolicyTopic(doc, topic)).length,
      })),
    [sortedDocs],
  );

  return (
    <ParentLayout title="Policies">
      <div className="space-y-4">
        <ParentPageHeader
          eyebrow="Family handbook"
          title="Policies organized around the questions parents ask most"
          description="Jump straight to pickup, illness, billing, and enrollment guidance, or search the full library when you need a specific document."
          accent="sky"
          layout="split"
          stats={[
            {
              label: "Published",
              value: docs.length,
              hint: "Available documents",
              tone: "sky",
            },
            {
              label: "Topics",
              value: TOPIC_SHORTCUTS.length,
              hint: "Common parent questions",
              tone: "gray",
            },
            {
              label: "Search",
              value: query ? filteredDocs.length : "Ready",
              hint: query ? "Matching results" : "Find any policy fast",
              tone: query ? "emerald" : "gray",
            },
            {
              label: "Format",
              value: "Web/PDF",
              hint: "Opens in a new tab",
              tone: "amber",
            },
          ]}
          actions={
            query ? (
              <ParentButton variant="secondary" onClick={() => setQuery("")}>
                Clear search
              </ParentButton>
            ) : null
          }
        />

        {error ? (
          <ParentSurface className="border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </ParentSurface>
        ) : null}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <ParentSection
            title="Common parent questions"
            description="Choose a topic first if you are not sure which document contains the answer."
            className="bg-gradient-to-br from-white via-sky-50/40 to-white"
          >
            {loading ? (
              <Skeleton count={4} />
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {topicSummaries.map((topic) => (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() => setQuery(topic.terms[0])}
                      className={[
                        "rounded-[24px] border p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm",
                        topicCardTone(topic.tone),
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-extrabold text-gray-900 dark:text-gray-100">
                            {topic.label}
                          </div>
                          <div className="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-300">
                            {topic.description}
                          </div>
                        </div>
                        <span className="rounded-full border border-white/80 bg-white/90 px-2.5 py-1 text-[11px] font-extrabold text-gray-600 shadow-sm dark:border-gray-700 dark:bg-slate-900 dark:text-gray-300">
                          {topic.count}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>

                {featuredDoc ? (
                  <a
                    href={featuredDoc.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group block rounded-[28px] border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-amber-50/60 p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-sky-800 dark:bg-slate-900/70"
                  >
                    <div className="inline-flex rounded-full border border-sky-200 bg-white px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-sky-700 dark:border-sky-800 dark:bg-slate-950 dark:text-sky-200">
                      Featured handbook
                    </div>
                    <div className="mt-3 flex items-start justify-between gap-3">
                      <div>
                        <div className="text-lg font-black tracking-tight text-gray-900 dark:text-gray-100">
                          {featuredDoc.title}
                        </div>
                        <div className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
                          {featuredDoc.description ||
                            "Open the current handbook for the broadest parent-facing guidance."}
                        </div>
                      </div>
                      <div className="shrink-0 text-sky-500 transition group-hover:translate-x-0.5">
                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                          <path
                            fillRule="evenodd"
                            d="M5 10a.75.75 0 01.75-.75h6.638L10.23 7.29a.75.75 0 111.04-1.08l3.5 3.25a.75.75 0 010 1.08l-3.5 3.25a.75.75 0 11-1.04-1.08l2.158-1.96H5.75A.75.75 0 015 10z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    </div>
                    <div className="mt-4 inline-flex rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-extrabold text-gray-600 dark:border-gray-700 dark:bg-slate-950 dark:text-gray-300">
                      Open document
                    </div>
                  </a>
                ) : (
                  <ParentEmpty
                    title="No policy documents yet"
                    description="Published documents will appear here once the center shares them."
                  />
                )}
              </div>
            )}
          </ParentSection>

          <ParentSection
            title="Search the full policy library"
            description="Type a keyword like pickup, handbook, invoice, illness, or medical."
            className="bg-gradient-to-br from-white via-white to-amber-50/35"
            action={
              <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-600 dark:border-gray-700 dark:bg-slate-900 dark:text-gray-300">
                {query ? `${filteredDocs.length} result${filteredDocs.length === 1 ? "" : "s"}` : `${docs.length} documents`}
              </span>
            }
          >
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search policies..."
                  className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-800 sm:flex-1"
                />
                {query ? (
                  <ParentButton variant="soft" onClick={() => setQuery("")}>
                    Reset
                  </ParentButton>
                ) : null}
              </div>

              {loading ? (
                <Skeleton count={4} />
              ) : filteredDocs.length ? (
                <div className="grid grid-cols-1 gap-3">
                  {filteredDocs.map((doc) => (
                    <PolicyDocCard key={doc.id} doc={doc} />
                  ))}
                </div>
              ) : (
                <ParentEmpty
                  title="No matching policies"
                  description="Try a broader search term or use one of the common topic shortcuts."
                  action={
                    <ParentButton variant="secondary" onClick={() => setQuery("")}>
                      Clear search
                    </ParentButton>
                  }
                />
              )}
            </div>
          </ParentSection>
        </div>
      </div>
    </ParentLayout>
  );
}

function PolicyDocCard({ doc }) {
  const docTopics = TOPIC_SHORTCUTS.filter((topic) => matchesPolicyTopic(doc, topic)).slice(
    0,
    3,
  );

  return (
    <a
      href={doc.url}
      target="_blank"
      rel="noreferrer"
      className="group rounded-[28px] border border-sky-100 bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-300 hover:bg-sky-50/70 hover:shadow-md dark:border-gray-700 dark:bg-gray-900/30"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-base font-extrabold text-gray-900 dark:text-gray-100">
            {doc.title}
          </div>
          <div className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
            {doc.description || "No summary provided for this document yet."}
          </div>
        </div>
        <div className="shrink-0 text-sky-500 transition group-hover:translate-x-0.5">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
            <path
              fillRule="evenodd"
              d="M5 10a.75.75 0 01.75-.75h6.638L10.23 7.29a.75.75 0 111.04-1.08l3.5 3.25a.75.75 0 010 1.08l-3.5 3.25a.75.75 0 11-1.04-1.08l2.158-1.96H5.75A.75.75 0 015 10z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="inline-flex rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-extrabold text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300">
          Open document
        </span>
        {docTopics.map((topic) => (
          <span
            key={`${doc.id}-${topic.id}`}
            className={topicBadgeTone(topic.tone)}
          >
            {topic.label}
          </span>
        ))}
      </div>
    </a>
  );
}

function buildPolicyText(doc) {
  return `${doc?.title || ""} ${doc?.description || ""}`.toLowerCase();
}

function matchesPolicyTopic(doc, topic) {
  const text = buildPolicyText(doc);
  return topic.terms.some((term) => text.includes(term));
}

function topicCardTone(tone = "sky") {
  const tones = {
    sky: "border-sky-200 bg-sky-50/80 hover:bg-sky-50 dark:border-sky-800 dark:bg-sky-950/20",
    emerald:
      "border-emerald-200 bg-emerald-50/80 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/20",
    amber:
      "border-amber-200 bg-amber-50/80 hover:bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20",
  };

  return tones[tone] || tones.sky;
}

function topicBadgeTone(tone = "sky") {
  const tones = {
    sky: "rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700 dark:border-sky-800 dark:bg-sky-950/20 dark:text-sky-200",
    emerald:
      "rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-200",
    amber:
      "rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-200",
  };

  return tones[tone] || tones.sky;
}
