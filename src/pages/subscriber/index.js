import SubscriberLayout from "@/components/subscriber/SubscriberLayout";
import Skeleton from "@/components/ui/Skeleton";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

export default function SubscriberHome() {
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const c = await apiJson("/api/v1/centers");
        setCenters(Array.isArray(c) ? c : []);
      } catch (e) {
        setError(e.message || "Failed to load subscription info");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const sorted = useMemo(
    () => [...centers].sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [centers],
  );

  return (
    <SubscriberLayout title="Subscription">
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-extrabold text-gray-900">Subscription & Tier</h2>
        <p className="mt-1 text-sm text-gray-600">
          External daycare access should be feature-gated by subscription tier (not fully implemented yet).
        </p>

        {error ? (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-4"><Skeleton count={4} /></div>
        ) : sorted.length === 0 ? (
          <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
            No centers are linked to this subscriber account.
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sorted.map((c) => (
              <div key={c.id} className="rounded-2xl border border-gray-200 p-4">
                <div className="text-sm font-extrabold text-gray-900">{c.name}</div>
                <div className="mt-1 text-xs text-gray-500">{c.address || "—"}</div>
                <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Tier</span>
                    <span className="font-extrabold text-gray-900">
                      {c.subscription?.tier || "—"}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-gray-600">Active</span>
                    <span className="font-extrabold text-gray-900">
                      {c.subscription ? (c.subscription.active ? "Yes" : "No") : "—"}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-gray-600">Expires</span>
                    <span className="font-extrabold text-gray-900">
                      {c.subscription?.expiresAt
                        ? new Date(c.subscription.expiresAt).toLocaleDateString()
                        : "—"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </SubscriberLayout>
  );
}

