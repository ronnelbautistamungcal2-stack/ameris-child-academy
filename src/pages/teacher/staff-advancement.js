import TeacherLayout from "@/components/teacher/TeacherLayout";
import { SkeletonCard } from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

function isProbablyLink(value) {
  const s = String(value || "").trim();
  if (!s) return false;
  return s.startsWith("http://") || s.startsWith("https://") || s.startsWith("/");
}

export default function TeacherStaffAdvancement() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [advancements, setAdvancements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [expandedId, setExpandedId] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const c = await apiJson("/api/v1/centers");
        const arr = Array.isArray(c) ? c : [];
        setCenters(arr);
        if (arr.length === 1) setCenterId(arr[0].id);
      } catch (e) {
        setError(e.message || "Failed to load centers");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!centerId) {
        setAdvancements([]);
        setQuery("");
        setCategory("");
        setExpandedId("");
        return;
      }
      setLoading(true);
      setError("");
      try {
        const data = await apiJson(
          `/api/v1/staff-advancement?centerId=${encodeURIComponent(centerId)}`,
        );
        setAdvancements(Array.isArray(data) ? data : []);
      } catch (e) {
        setError(e.message || "Failed to load staff advancement");
      } finally {
        setLoading(false);
      }
    })();
  }, [centerId]);

  const categories = useMemo(() => {
    const set = new Set();
    for (const a of advancements) {
      if (a.category) set.add(a.category);
    }
    return [...set].sort();
  }, [advancements]);

  const filtered = useMemo(() => {
    const q = String(query || "").trim().toLowerCase();
    return advancements.filter((a) => {
      if (category && (a.category || "") !== category) return false;
      if (!q) return true;
      return [a.title, a.description, a.category]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [advancements, query, category]);

  return (
    <TeacherLayout title="Staff Advancement">
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-extrabold">Staff Advancement</h2>
        <p className="mt-1 text-sm text-gray-600">
          View the steps of progression for staff advancement at your center.
        </p>

        {error ? (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <div className="mt-4">
          <label className="block max-w-lg">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Center
            </div>
            <select
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={centerId}
              onChange={(e) => setCenterId(e.target.value)}
              disabled={loading}
            >
              <option value="">Select a center…</option>
              {centers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {centerId ? (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="block md:col-span-2">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Search
              </div>
              <input
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                placeholder="Title, description, category…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>

            <label className="block">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Category
              </div>
              <select
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
          </div>
        ) : null}

        <div className="mt-4">
          {loading ? (
            <div className="space-y-3">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              title="No staff advancement records found"
              description={
                query || category
                  ? "Try adjusting your search or category filter."
                  : centerId
                    ? "No staff advancement records are set up for this center yet. Ask your administrator."
                    : "Select a center to view staff advancement steps."
              }
              icon={
                <svg viewBox="0 0 24 24" className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
                </svg>
              }
            />
          ) : (
            <div className="space-y-3">
              <div className="text-xs text-gray-600">
                {filtered.length} record{filtered.length === 1 ? "" : "s"}
                {category ? ` in "${category}"` : ""}
              </div>

              {filtered.map((adv) => {
                const expanded = expandedId === adv.id;
                const steps = Array.isArray(adv.steps) ? adv.steps : [];

                return (
                  <div key={adv.id} className="rounded-xl border border-gray-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-base font-extrabold text-gray-900">
                          {adv.title}
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          {adv.category || "Uncategorized"}
                          {steps.length ? ` • ${steps.length} step${steps.length === 1 ? "" : "s"}` : ""}
                        </div>
                        {adv.description ? (
                          <div className="mt-1 text-sm text-gray-600">{adv.description}</div>
                        ) : null}
                      </div>

                      <button
                        type="button"
                        className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                        onClick={() => setExpandedId(expanded ? "" : adv.id)}
                      >
                        {expanded ? "Hide steps" : "View steps"}
                      </button>
                    </div>

                    {Array.isArray(adv.media) && adv.media.length ? (
                      <div className="mt-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Media
                        </div>
                        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                          {adv.media.map((m) => (
                            <li key={m}>
                              <a
                                href={m}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-600 hover:text-blue-700"
                              >
                                {m}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {expanded ? (
                      <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Steps of Progression
                        </div>
                        {steps.length ? (
                          <div className="mt-2 space-y-2">
                            {steps
                              .slice()
                              .sort((a, b) => Number(a.stepIndex || 0) - Number(b.stepIndex || 0))
                              .map((step) => (
                                <div
                                  key={step.id}
                                  className="rounded-lg border border-gray-200 bg-white p-3"
                                >
                                  <div className="text-sm font-semibold text-gray-900">
                                    Step {step.stepIndex}: {step.title}
                                  </div>

                                  {step.description ? (
                                    <div className="mt-1 text-sm text-gray-700">
                                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                        Testing criteria
                                      </div>
                                      <div className="mt-1 whitespace-pre-wrap">{step.description}</div>
                                    </div>
                                  ) : null}

                                  {step.resource || step.notes ? (
                                    <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                                      {step.resource ? (
                                        <div className="text-xs text-gray-700">
                                          <div className="font-semibold text-gray-500">Resource</div>
                                          {isProbablyLink(step.resource) ? (
                                            <a
                                              className="text-blue-600 hover:text-blue-700"
                                              href={step.resource}
                                              target="_blank"
                                              rel="noreferrer"
                                            >
                                              {step.resource}
                                            </a>
                                          ) : (
                                            <div className="whitespace-pre-wrap">{String(step.resource)}</div>
                                          )}
                                        </div>
                                      ) : null}
                                      {step.notes ? (
                                        <div className="text-xs text-gray-700">
                                          <div className="font-semibold text-gray-500">Notes</div>
                                          <div className="whitespace-pre-wrap">{String(step.notes)}</div>
                                        </div>
                                      ) : null}
                                    </div>
                                  ) : null}
                                </div>
                              ))}
                          </div>
                        ) : (
                          <div className="mt-2 text-sm text-gray-600">No steps added yet.</div>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </TeacherLayout>
  );
}
