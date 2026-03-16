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

  const filteredDocs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter((doc) =>
      `${doc.title || ""} ${doc.description || ""}`.toLowerCase().includes(q),
    );
  }, [docs, query]);

  return (
    <ParentLayout title="Policies">
      <div className="space-y-4">
        <ParentPageHeader
          eyebrow="Family handbook"
          title="Policies and procedures in one clear place"
          description="Search published documents, open the current handbook, and quickly find the rules parents most often need during drop-off, pickup, illness, and enrollment renewals."
          accent="sky"
          layout="split"
          stats={[
            { label: "Published", value: docs.length, hint: "Available documents", tone: "sky" },
            { label: "Search", value: query ? filteredDocs.length : "Ready", hint: query ? "Matching results" : "Find any policy fast", tone: "gray" },
            { label: "Parent use", value: "Daily", hint: "Designed for quick lookup", tone: "emerald" },
            { label: "Format", value: "Web/PDF", hint: "Opens in a new tab", tone: "amber" },
          ]}
        />

        {error ? (
          <ParentSurface className="border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </ParentSurface>
        ) : null}

        <ParentSection
          title="Search policies"
          description="Type a keyword like pickup, illness, payments, or handbook."
          className="bg-gradient-to-br from-white via-sky-50/40 to-white"
          action={
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search policies..."
              className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-800 sm:w-72"
            />
          }
        >
          {loading ? (
            <Skeleton count={4} />
          ) : filteredDocs.length ? (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.1fr_0.9fr]">
              {filteredDocs.map((doc) => (
                <a
                  key={doc.id}
                  href={doc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group rounded-[28px] border border-sky-100 bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-300 hover:bg-sky-50/70 hover:shadow-md dark:border-gray-700 dark:bg-gray-900/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-extrabold text-gray-900 dark:text-gray-100">
                        {doc.title}
                      </div>
                      <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        {doc.description || "No summary provided for this document yet."}
                      </div>
                    </div>
                    <div className="shrink-0 text-sky-500 transition group-hover:translate-x-0.5">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                        <path fillRule="evenodd" d="M5 10a.75.75 0 01.75-.75h6.638L10.23 7.29a.75.75 0 111.04-1.08l3.5 3.25a.75.75 0 010 1.08l-3.5 3.25a.75.75 0 11-1.04-1.08l2.158-1.96H5.75A.75.75 0 015 10z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                  <div className="mt-4 inline-flex rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-extrabold text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    Open document
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <ParentEmpty
              title="No matching policies"
              description="Try a broader search term or clear the filter."
              action={<ParentButton variant="secondary" onClick={() => setQuery("")}>Clear search</ParentButton>}
            />
          )}
        </ParentSection>
      </div>
    </ParentLayout>
  );
}
