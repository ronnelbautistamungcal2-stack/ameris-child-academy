import Link from "next/link";
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
  const [cancelling, setCancelling] = useState(false);
  const [cancelSent, setCancelSent] = useState("");

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
            {/* The child limit applies to each center. */}
            {(data.usage?.childrenByCenter || []).map((c) => (
              <div key={c.id} className="flex justify-between py-1 text-sm">
                <span className="text-gray-500 dark:text-gray-400">Children at {c.name}</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {c.children} of {account.maxChildren ?? "no limit"}
                </span>
              </div>
            ))}
            {account.hasSignedAgreement ? (
              <div className="mt-4 rounded-xl bg-blue-50 p-3 text-sm dark:bg-blue-900/30">
                <div className="font-bold text-gray-900 dark:text-gray-100">Signed Subscriber Agreement</div>
                <a href={`/api/v1/signed-agreements/${account.id}`} target="_blank" rel="noreferrer" className="font-semibold text-blue-700 underline dark:text-blue-300">
                  View signed agreement (PDF)
                </a>
                {" · "}
                <a href={`/api/v1/signed-agreements/${account.id}?file=certificate`} target="_blank" rel="noreferrer" className="font-semibold text-blue-700 underline dark:text-blue-300">
                  Signing certificate
                </a>
              </div>
            ) : null}
            <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
              To add an add-on, more centers or more children, request a change and the Ameris Solutions team will send you a new quote.
            </p>
            {/* Cancel / Request a Change (client sheet 10-29 (11), row 36). */}
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/solutions/request-quote" className="rounded-lg bg-blue-800 px-4 py-2 text-sm font-bold text-white hover:bg-blue-900">
                Request a Change
              </Link>
              <button type="button" onClick={() => setCancelling(true)} className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-50 dark:bg-gray-900">
                Cancel Subscription
              </button>
            </div>
            {cancelSent ? (
              <div className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
                Your cancellation request was sent to Ameris Solutions (support ticket {cancelSent}). They will contact you to finish it.
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {cancelling ? (
        <CancelDialog
          account={account}
          onClose={() => setCancelling(false)}
          onSent={(number) => {
            setCancelling(false);
            setCancelSent(number);
          }}
        />
      ) : null}
    </AdminLayout>
  );
}

/**
 * Asks Ameris Solutions to cancel: opens a support ticket with the reason.
 * Nothing is cancelled here; the Ameris team ends the subscription.
 */
function CancelDialog({ account, onClose, onSent }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function send() {
    setBusy(true);
    setError("");
    try {
      const ticket = await apiJson("/api/v1/support/tickets", {
        method: "POST",
        body: JSON.stringify({
          subject: `Cancellation request: ${account.name}`,
          body: `Please cancel the Ameris Solutions subscription for ${account.name} (Account #${account.accountNumber}).\n\nReason: ${reason.trim() || "(not given)"}`,
        }),
      });
      onSent(ticket.number);
    } catch (e) {
      setError(e.message || "Could not send the request");
      setBusy(false);
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="cancel-title">
      <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
        <h2 id="cancel-title" className="text-xl font-extrabold text-gray-900 dark:text-gray-100">Cancel Subscription</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          This sends a cancellation request to the Ameris Solutions team. Your subscription stays active until they contact you and complete it.
        </p>
        <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200">
          Reason (optional)
          <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800" />
        </label>
        {error ? <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold">Keep Subscription</button>
          <button type="button" onClick={send} disabled={busy} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50">
            {busy ? "Sending..." : "Send Cancellation Request"}
          </button>
        </div>
      </div>
    </div>
  );
}
