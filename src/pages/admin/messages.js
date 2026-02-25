import AdminLayout from "@/components/admin/AdminLayout";
import MessageInbox from "@/components/messages/MessageInbox";
import { apiJson } from "@/lib/api";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";

export default function AdminMessages() {
  const router = useRouter();
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const c = await apiJson("/api/v1/centers");
        const centersArr = Array.isArray(c) ? c : [];
        setCenters(centersArr);
        const fromQuery =
          typeof router.query.centerId === "string" ? router.query.centerId : "";
        setCenterId(fromQuery || (centersArr.length === 1 ? centersArr[0].id : ""));
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    })();
  }, [router.query.centerId]);

  return (
    <AdminLayout title="Messages">
      <div className="mb-4 flex items-end gap-3">
        <label className="block">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Center
          </div>
          <select
            value={centerId}
            onChange={(e) => setCenterId(e.target.value)}
            className="mt-1 w-72 max-w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">All centers</option>
            {centers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {loading ? (
        <div className="text-sm text-gray-600">Loading...</div>
      ) : (
        <MessageInbox centerId={centerId || undefined} isAdmin />
      )}
    </AdminLayout>
  );
}
