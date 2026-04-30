import StaffLayout from "@/components/staff/StaffLayout";
import Skeleton from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import { useEffect, useState } from "react";

export default function StaffResources() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await apiJson("/api/v1/policies");
        setDocs(Array.isArray(data) ? data : []);
      } catch (nextError) {
        setError(nextError.message || "Failed to load resources");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <StaffLayout title="Resources">
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-extrabold text-gray-900">Resources</h2>
        <p className="mt-1 text-sm text-gray-600">
          Shared policies, procedures, and reference documents published for your role.
        </p>

        {error ? (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-4">
            <Skeleton count={4} />
          </div>
        ) : docs.length ? (
          <div className="mt-4 space-y-3">
            {docs.map((doc) => (
              <a
                key={doc.id}
                href={doc.url}
                target="_blank"
                rel="noreferrer"
                className="block rounded-xl border border-gray-200 bg-white p-4 hover:bg-gray-50"
              >
                <div className="font-extrabold text-gray-900">{doc.title}</div>
                <div className="mt-1 text-sm text-gray-600">{doc.description || "-"}</div>
              </a>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
            No resources have been published yet.
          </div>
        )}
      </div>
    </StaffLayout>
  );
}
