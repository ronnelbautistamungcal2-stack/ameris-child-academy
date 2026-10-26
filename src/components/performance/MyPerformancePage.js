import MyEvaluations from "@/components/performance/MyEvaluations";
import TeacherSelfPerformanceReport from "@/components/teacher/TeacherSelfPerformanceReport";
import MyPathways from "@/components/training/MyPathways";
import MyTraining from "@/components/training/MyTraining";
import useSyncedCenterId from "@/hooks/useSyncedCenterId";
import { apiJson } from "@/lib/api";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

// My Performance for every role (client request 2026-10-02): My Performance,
// Evaluations, Professional Development and Training tabs, opened with
// ?tab= so the nav and links can go straight to one.

const NAVY = "text-[#0b2a5b] dark:text-blue-100";
const TABS = [
  { key: "performance", label: "My Performance" },
  { key: "evaluations", label: "Evaluations" },
  { key: "professional-development", label: "Professional Development" },
  { key: "training", label: "Training" },
];

export default function MyPerformancePage({ Layout, layoutProps = {} }) {
  const router = useRouter();
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const queryTab = typeof router.query.tab === "string" ? router.query.tab : "";
  const tab = TABS.some((t) => t.key === queryTab) ? queryTab : "performance";
  const portalBase = `/${String(router.pathname).split("/").filter(Boolean)[0] || ""}`;

  useSyncedCenterId(centerId, setCenterId, centers);

  useEffect(() => {
    apiJson("/api/v1/centers")
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : [];
        setCenters(list);
        if (list.length === 1) setCenterId(list[0].id);
      })
      .catch((e) => setError(e.message || "Failed to load centers"))
      .finally(() => setLoading(false));
  }, []);

  const setTab = (key) => router.replace({ pathname: router.pathname, query: { ...router.query, tab: key } }, undefined, { shallow: true });

  return (
    <Layout title="My Performance" {...layoutProps}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white" aria-hidden>
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </span>
            <h1 className={`text-3xl font-black ${NAVY}`}>My Performance</h1>
          </div>
          <label className="block">
            <span className={`text-sm font-bold ${NAVY}`}>Center</span>
            <select
              value={centerId}
              onChange={(e) => setCenterId(e.target.value)}
              disabled={loading}
              aria-label="Center"
              className="mt-1 block w-64 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
            >
              <option value="">Select a center...</option>
              {centers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex gap-6 overflow-x-auto border-b border-gray-200 dark:border-gray-700" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`whitespace-nowrap border-b-2 px-1 pb-2 text-sm font-semibold ${tab === t.key ? "border-blue-600 text-blue-700 dark:text-blue-300" : "border-transparent text-gray-500 hover:text-gray-800"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

        {!centerId ? (
          <p className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900">Choose a center to see your performance.</p>
        ) : tab === "performance" ? (
          <TeacherSelfPerformanceReport centerId={centerId} centers={centers} loading={loading} setCenterId={setCenterId} />
        ) : tab === "evaluations" ? (
          <MyEvaluations centerId={centerId} />
        ) : tab === "professional-development" ? (
          <MyPathways centerId={centerId} pathwayHref={(id) => `${portalBase}/my-pathways/${id}`} />
        ) : (
          <MyTraining centerId={centerId} />
        )}
      </div>
    </Layout>
  );
}
