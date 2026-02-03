import ParentLayout from "@/components/parent/ParentLayout";
import { apiJson } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

export default function ParentChildren() {
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const kids = await apiJson("/api/v1/children");
        setChildren(Array.isArray(kids) ? kids : []);
      } catch (e) {
        setError(e.message || "Failed to load children");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const sorted = useMemo(() => {
    return [...children].sort((a, b) =>
      (a.firstName || "").localeCompare(b.firstName || ""),
    );
  }, [children]);

  return (
    <ParentLayout title="My Children">
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-extrabold text-gray-900">My Children</h2>
        <p className="mt-1 text-sm text-gray-600">
          View your child information and recent activity.
        </p>

        {error ? (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-4 text-sm text-gray-600">Loading…</div>
        ) : sorted.length === 0 ? (
          <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
            No children found for this account.
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sorted.map((ch) => (
              <div
                key={ch.id}
                className="rounded-2xl border border-gray-200 bg-white p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 text-sm font-extrabold text-gray-700">
                    {initials(ch.firstName, ch.lastName)}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-extrabold text-gray-900">
                      {ch.firstName} {ch.lastName || ""}
                    </div>
                    <div className="truncate text-xs text-gray-500">
                      {ch.centerId ? `Center: ${ch.centerId}` : "Center: —"}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <Link
                    href={`/parent/progress?childId=${encodeURIComponent(ch.id)}`}
                    className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-extrabold text-white hover:bg-blue-700"
                  >
                    View Progress
                  </Link>
                  <Link
                    href={`/activities?childId=${encodeURIComponent(ch.id)}`}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-extrabold text-gray-900 hover:bg-gray-50"
                  >
                    Activity Logs
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ParentLayout>
  );
}

function initials(firstName, lastName) {
  const f = (firstName || "").trim().slice(0, 1).toUpperCase();
  const l = (lastName || "").trim().slice(0, 1).toUpperCase();
  return `${f}${l}` || "C";
}

