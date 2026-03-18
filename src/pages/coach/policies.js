import CoachLayout from "@/components/coach/CoachLayout";
import {
  CoachBadge,
  CoachEmptyPanel,
  CoachMetricCard,
  CoachPageHero,
  CoachPanel,
  coachInputClass,
} from "@/components/coach/CoachPage";
import Skeleton from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

export default function CoachPolicies() {
  const [docs, setDocs] = useState([]);
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");

      try {
        const [policyResponse, centerResponse] = await Promise.all([
          apiJson("/api/v1/policies"),
          apiJson("/api/v1/centers").catch(() => []),
        ]);

        const nextDocs = Array.isArray(policyResponse) ? policyResponse : [];
        const nextCenters = Array.isArray(centerResponse) ? centerResponse : [];

        setDocs(nextDocs);
        setCenters(nextCenters);
        if (nextCenters.length === 1) setCenterId(nextCenters[0].id);
      } catch (err) {
        setError(err.message || "Failed to load policies");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filteredDocs = useMemo(() => {
    return docs.filter((doc) => {
      const matchesCenter = !centerId || !doc.centerId || doc.centerId === centerId;
      if (!matchesCenter) return false;

      if (!search.trim()) return true;
      const haystack = `${doc.title || ""} ${doc.description || ""}`.toLowerCase();
      return haystack.includes(search.trim().toLowerCase());
    });
  }, [centerId, docs, search]);

  const orgWideCount = docs.filter((doc) => !doc.centerId).length;
  const centerSpecificCount = docs.filter((doc) => doc.centerId).length;
  const activeCenterName = centers.find((center) => center.id === centerId)?.name || "";

  return (
    <CoachLayout title="Policies">
      <div className="space-y-5">
        <CoachPageHero
          eyebrow="Policy Library"
          title="Keep guidance close to the work coaches are reviewing."
          description="Use this library to pull up handbooks, procedures, and center-specific documents while coaching teachers through issues or routines."
          meta={
            <>
              {activeCenterName ? <CoachBadge tone="sky">{activeCenterName}</CoachBadge> : null}
              <CoachBadge tone="slate">{filteredDocs.length} visible documents</CoachBadge>
            </>
          }
          controls={
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <div className="mb-1.5 text-xs font-black uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                  Center View
                </div>
                <select
                  value={centerId}
                  onChange={(event) => setCenterId(event.target.value)}
                  className={coachInputClass}
                >
                  <option value="">All published documents</option>
                  {centers.map((center) => (
                    <option key={center.id} value={center.id}>
                      {center.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <div className="mb-1.5 text-xs font-black uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                  Search
                </div>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className={coachInputClass}
                  placeholder="Find a policy or procedure"
                />
              </label>
            </div>
          }
          stats={
            <>
              <CoachMetricCard
                label="Visible Docs"
                value={String(filteredDocs.length)}
                hint="Current search and center view"
                tone="sky"
                icon={<BookIcon />}
              />
              <CoachMetricCard
                label="Org-wide"
                value={String(orgWideCount)}
                hint="Applies across centers"
                tone="emerald"
                icon={<GlobeIcon />}
              />
              <CoachMetricCard
                label="Center-specific"
                value={String(centerSpecificCount)}
                hint="Published to one center"
                tone="amber"
                icon={<PinIcon />}
              />
              <CoachMetricCard
                label="Search Hits"
                value={search.trim() ? String(filteredDocs.length) : "-"}
                hint={search.trim() ? "Matching current query" : "Start typing to filter"}
                tone="slate"
                icon={<SearchIcon />}
              />
            </>
          }
        />

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        ) : null}

        <CoachPanel
          title="Published Policies"
          description="Org-wide documents remain visible when filtering by center so coaches can keep both local and shared guidance in reach."
        >
          {loading ? (
            <div className="space-y-3">
              <Skeleton count={4} className="h-24 rounded-[1.5rem]" />
            </div>
          ) : filteredDocs.length === 0 ? (
            <CoachEmptyPanel
              title="No policy documents match this view."
              description="Try clearing the search or switch back to all published documents."
              icon={<BookIcon />}
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {filteredDocs.map((doc) => {
                const centerName = centers.find((center) => center.id === doc.centerId)?.name || "";

                return (
                  <a
                    key={doc.id}
                    href={doc.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900/80"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-base font-black text-gray-900 dark:text-gray-100">
                          {doc.title}
                        </div>
                        <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-400">
                          {doc.description || "No description provided."}
                        </p>
                      </div>
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
                        <BookIcon />
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <CoachBadge tone={doc.centerId ? "amber" : "emerald"}>
                        {doc.centerId ? centerName || "Center specific" : "Org wide"}
                      </CoachBadge>
                      <CoachBadge tone="slate">
                        Published {new Date(doc.createdAt).toLocaleDateString("en-US")}
                      </CoachBadge>
                    </div>

                    <div className="mt-4 flex items-center justify-between text-sm font-bold text-slate-700 dark:text-slate-300">
                      <span>Open document</span>
                      <svg
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                      >
                        <path
                          fillRule="evenodd"
                          d="M5 10a.75.75 0 01.75-.75h6.638L10.23 7.29a.75.75 0 111.04-1.08l3.5 3.25a.75.75 0 010 1.08l-3.5 3.25a.75.75 0 11-1.04-1.08l2.158-1.96H5.75A.75.75 0 015 10z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </CoachPanel>
      </div>
    </CoachLayout>
  );
}

function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 5.25A2.25 2.25 0 016.75 3h10.5a2.25 2.25 0 012.25 2.25v13.5A2.25 2.25 0 0117.25 21H6.75A2.25 2.25 0 014.5 18.75V5.25z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5h7.5M8.25 11.25h7.5M8.25 15h4.5" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3.75A8.25 8.25 0 1012 20.25 8.25 8.25 0 0012 3.75z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5M12 3.75c2.25 2.25 3 4.5 3 8.25s-.75 6-3 8.25m0-16.5c-2.25 2.25-3 4.5-3 8.25s.75 6 3 8.25" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s6-4.35 6-10.125A6 6 0 106 10.875C6 16.65 12 21 12 21z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 12.75a1.875 1.875 0 100-3.75 1.875 1.875 0 000 3.75z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15z" />
    </svg>
  );
}
