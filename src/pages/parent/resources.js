import DocumentLibrary from "@/components/parent/DocumentLibrary";
import ParentLayout from "@/components/parent/ParentLayout";
import { apiJson } from "@/lib/api";
import { useEffect, useState } from "react";

const NAVY = "text-[#12386a] dark:text-slate-100";

export default function ParentResources() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const result = await apiJson("/api/v1/policies?category=RESOURCE");
        setDocs(sortByCreated(Array.isArray(result) ? result : []));
      } catch (e) {
        setError(e.message || "Failed to load resources");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <ParentLayout title="Additional Resources">
      <div className="space-y-4">
        <div>
          <h1 className={`text-2xl font-black tracking-tight sm:text-3xl ${NAVY}`}>
            Additional Resources
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            View, print, or download helpful resources for parents, staff, and students.
          </p>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-950/25 dark:text-red-200">
            {error}
          </div>
        ) : null}

        <DocumentLibrary
          docs={docs}
          loading={loading}
          listTitle="Available Resources"
          searchPlaceholder="Search resources..."
          emptyText="The center has not published any resources yet."
          iconVariant="tinted"
        />
      </div>
    </ParentLayout>
  );
}

// Oldest first, so the list follows the order the center added documents in.
function sortByCreated(docs) {
  return [...docs].sort(
    (a, b) =>
      new Date(a.createdAt || 0) - new Date(b.createdAt || 0) ||
      String(a.title || "").localeCompare(String(b.title || "")),
  );
}
