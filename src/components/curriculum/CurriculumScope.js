import { createContext, useContext, useEffect, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import GlobalLayout from "@/components/global/GlobalLayout";
import { apiJson } from "@/lib/api";

// Where the curriculum editors (Lesson Planner, Lesson Bank, Categories,
// Steps of Progression Bank) are shown. In the Admin portal they use the Admin
// layout and the admin's own centers. Under Global admin > Lesson Bank & SOP
// (client sheet 10-29 (9), rows 4/5) they use the Global layout and edit the
// Ameris curriculum center only.

export const ADMIN_TAB_HREFS = {
  calendar: "/admin/curriculum/calendar",
  planner: "/admin/curriculum/planner",
  bank: "/admin/lessons",
  categories: "/admin/curriculum?tab=categories",
  steps: "/admin/curriculum?tab=lessons",
};

export const GLOBAL_TAB_HREFS = {
  planner: "/global/curriculum",
  bank: "/global/curriculum/bank",
  categories: "/global/curriculum/categories",
  steps: "/global/curriculum/steps",
  // The Global Character Guide (client sheet 10-29 (11), row 66).
  characterGuide: "/global/curriculum/character-guide",
};

const ADMIN_SCOPE = { global: false, Layout: AdminLayout, centers: null, tabHrefs: ADMIN_TAB_HREFS };

const CurriculumScopeContext = createContext(ADMIN_SCOPE);

/** { global, Layout, centers (null = load the user's own), tabHrefs } */
export function useCurriculumScope() {
  return useContext(CurriculumScopeContext);
}

function GlobalCurriculumLayout({ children }) {
  return <GlobalLayout title="Lesson Bank & SOP">{children}</GlobalLayout>;
}

/**
 * Global admin pages wrap an editor in this: it loads the curriculum center
 * and hands it to the editor as its only center.
 */
export function GlobalCurriculumScope({ children }) {
  const [source, setSource] = useState(undefined); // undefined = loading
  const [error, setError] = useState("");

  useEffect(() => {
    apiJson("/api/v1/global/curriculum")
      .then((data) => setSource(data.source || null))
      .catch((e) => {
        setError(e.message || "Could not load the curriculum");
        setSource(null);
      });
  }, []);

  if (source === undefined || !source) {
    return (
      <GlobalCurriculumLayout>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-600 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
          {source === undefined ? "Loading..." : error || "No curriculum center is set yet."}
        </div>
      </GlobalCurriculumLayout>
    );
  }

  const scope = {
    global: true,
    Layout: GlobalCurriculumLayout,
    // The editors read a center's classrooms from `classes`; the plans don't need them.
    centers: [{ id: source.id, name: source.name, curriculumSource: true, classes: [] }],
    tabHrefs: GLOBAL_TAB_HREFS,
  };
  return <CurriculumScopeContext.Provider value={scope}>{children}</CurriculumScopeContext.Provider>;
}
