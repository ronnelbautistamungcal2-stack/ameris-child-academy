import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { apiJson } from "@/lib/api";
import { ACCOUNT_STATUS_LABELS, ADD_ONS, ADD_ON_LABELS } from "@/lib/addOns";

const card = "rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900";

// "Ameris Solutions Subscription" page on the regular admin (client mockup
// 2026-11-06). Billing, payment method and the Manage / Cancel pop-ups wait on
// the payment provider; this shows the plan, add-ons and limits.
export default function AdminSubscriptionPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiJson("/api/v1/account")
      .then(setData)
      .catch((err) => setError(err.message || "Could not load your subscription"));
  }, []);

  const account = data?.account;
  return (
    <AdminLayout title="Ameris Solutions Subscription">
      <h1 className="mb-5 text-3xl font-extrabold text-gray-900 dark:text-gray-100">Ameris Solutions Subscription</h1>
      {error ? <div className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {!data && !error ? <div className={card}>Loading...</div> : null}
      {data && !account ? <div className={card}>This center isn't linked to a subscription.</div> : null}
      {account ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className={card}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-gray-900 dark:text-gray-100">Current Subscription</h2>
              <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-bold text-green-800 dark:bg-green-900/40 dark:text-green-200">
                {ACCOUNT_STATUS_LABELS[account.status] || account.status}
              </span>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {account.name} | Account #{account.accountNumber}
            </div>
            <div className="mt-4 font-bold text-gray-900 dark:text-gray-100">Base Program</div>
            <div className="mt-4 font-bold text-gray-900 dark:text-gray-100">Add-Ons</div>
            <ul className="mt-1 space-y-1">
              {ADD_ONS.map((key) => {
                const on = (data.addOns || []).includes(key);
                return (
                  <li key={key} className={`flex items-center gap-2 text-sm ${on ? "text-gray-900 dark:text-gray-100" : "text-gray-400"}`}>
                    <span aria-hidden="true">{on ? "✓" : "🔒"}</span>
                    {ADD_ON_LABELS[key]}
                    {on ? "" : " (not included)"}
                  </li>
                );
              })}
            </ul>
          </div>
          <div className={card}>
            <h2 className="mb-3 text-xl font-extrabold text-gray-900 dark:text-gray-100">Usage</h2>
            <div className="flex justify-between py-1 text-sm">
              <span className="text-gray-500 dark:text-gray-400">Centers</span>
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                {data.usage?.centers ?? "—"} of {account.maxCenters}
              </span>
            </div>
            <div className="flex justify-between py-1 text-sm">
              <span className="text-gray-500 dark:text-gray-400">Children</span>
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                {data.usage?.children ?? "—"} of {account.maxChildren ?? "no limit"}
              </span>
            </div>
            <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
              To add an add-on, more centers or more children, contact the Ameris Solutions sales team. Online upgrades and billing are coming soon.
            </p>
          </div>
        </div>
      ) : null}
    </AdminLayout>
  );
}
