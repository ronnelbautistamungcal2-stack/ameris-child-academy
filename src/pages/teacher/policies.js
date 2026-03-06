import TeacherLayout from "@/components/teacher/TeacherLayout";
import Skeleton from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import { useEffect, useState } from "react";

export default function TeacherPolicies() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const d = await apiJson("/api/v1/policies");
        setDocs(Array.isArray(d) ? d : []);
      } catch (e) {
        setError(e.message || "Failed to load policies");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <TeacherLayout title="Policies & Handbook">
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-extrabold">Policies & Procedures Handbook</h2>
        <p className="mt-1 text-sm text-gray-600">
          Policies and procedures available for your role.
        </p>

        {error ? (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-4"><Skeleton count={4} /></div>
        ) : docs.length ? (
          <div className="mt-4 space-y-3">
            {docs.map((d) => (
              <a
                key={d.id}
                href={d.url}
                target="_blank"
                rel="noreferrer"
                className="block rounded-xl border border-gray-200 bg-white p-4 hover:bg-gray-50"
              >
                <div className="font-extrabold text-gray-900">{d.title}</div>
                <div className="mt-1 text-sm text-gray-600">{d.description || "—"}</div>
              </a>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
            No policy documents have been published yet.
          </div>
        )}

        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Admins can publish policy documents via a simple API (not yet exposed in UI).
        </div>
      </div>
    </TeacherLayout>
  );
}

 
