import { apiJson } from "@/lib/api";
import { CHARGE_TYPES, chargeTypeLabel } from "@/lib/chargeTypes";
import { useCallback, useEffect, useState } from "react";

// Invoice (client mockup 09-06), opened from the parent's Billing page and the
// admin Billing list, with a Print button.

const money = (cents) => `$${((Number(cents) || 0) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const longDate = (key) => (key ? new Date(`${String(key).slice(0, 10)}T00:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "");
const shortDate = (key) => (key ? new Date(`${String(key).slice(0, 10)}T00:00:00`).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }) : "");
const cell = "border border-[#9cb8dc] px-4 py-2";
const head = "border border-[#9cb8dc] bg-[#dbe8f7] px-4 py-2 font-bold text-[#0b2a5b]";

/** canEdit (admin Billing): edit or delete each charge (client request 2026-10-29). */
export default function InvoiceView({ invoiceId, onClose, canEdit = false, onChanged }) {
  const [invoice, setInvoice] = useState(null);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState("");
  const [draft, setDraft] = useState(null);

  const load = useCallback(() => {
    apiJson(`/api/v1/billing/invoices/${invoiceId}`)
      .then(setInvoice)
      .catch((e) => setError(e.message || "Failed to load the invoice"));
  }, [invoiceId]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveCharge() {
    try {
      await apiJson(`/api/v1/billing/charges/${editingId}`, {
        method: "PUT",
        body: JSON.stringify({ description: draft.description, amount: draft.amount, date: draft.date, chargeType: draft.chargeType }),
      });
      setEditingId("");
      load();
      onChanged?.();
    } catch (e) {
      setError(e.message || "Failed to save the charge");
    }
  }

  async function deleteCharge(charge) {
    if (!window.confirm(`Delete "${charge.description}" (${money(charge.amountCents)}) from this invoice?`)) return;
    try {
      await apiJson(`/api/v1/billing/charges/${charge.id}`, { method: "DELETE" });
      load();
      onChanged?.();
    } catch (e) {
      setError(e.message || "Failed to delete the charge");
    }
  }

  const center = invoice?.center || {};
  const cityLine = [center.city, [center.state, center.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 px-3 py-6" role="dialog" aria-modal="true" aria-label="Invoice">
      <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl">
        <div className="no-print flex items-center justify-end gap-2 border-b border-gray-200 px-5 py-3">
          <button type="button" onClick={() => window.print()} disabled={!invoice} className="rounded-lg border border-blue-300 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-50">🖨 Print</button>
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700">Close</button>
        </div>
        {error ? <p className="p-6 text-sm text-red-700">{error}</p> : !invoice ? <p className="p-6 text-sm text-gray-500">Loading…</p> : (
          <div id="invoice-print-sheet" className="space-y-6 p-8 text-gray-900">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div>
                <div className="text-3xl font-black text-[#0b2a5b]" style={{ fontFamily: "Georgia, serif" }}>Ameris Academy</div>
                <div className="text-[10px] tracking-[0.3em] text-[#0b2a5b]">FROM BLESSINGS TO PILLARS</div>
                <div className="mt-3 text-lg font-bold">{center.name}</div>
                {center.address ? <div>{center.address}</div> : null}
                {cityLine ? <div>{cityLine}</div> : null}
                {center.phone ? <div>Phone: {center.phone}</div> : null}
                {center.contactEmail ? <div>Email: {center.contactEmail}</div> : null}
              </div>
              <div className="min-w-[18rem]">
                <div className="rounded-lg bg-[#dbe8f7] px-6 py-3 text-4xl font-black tracking-wide text-[#0b2a5b]" style={{ fontFamily: "Georgia, serif" }}>INVOICE</div>
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
                  <dt className="font-bold">Invoice Number:</dt><dd>{invoice.number}</dd>
                  <dt className="font-bold">Invoice Date:</dt><dd>{longDate(invoice.invoiceDate)}</dd>
                  <dt className="font-bold">Due Date:</dt><dd>{longDate(invoice.dueDate)}</dd>
                  <dt className="font-bold">Page:</dt><dd>1 of 1</dd>
                </dl>
              </div>
            </div>

            <div className="max-w-md rounded-md border border-[#9cb8dc]">
              <div className="bg-[#dbe8f7] px-4 py-2 font-bold text-[#0b2a5b]">Bill To:</div>
              <div className="whitespace-pre-line px-4 py-3">
                {[invoice.billTo?.name, invoice.billTo?.address, invoice.billTo?.phone ? `Phone: ${invoice.billTo.phone}` : "", invoice.billTo?.email ? `Email: ${invoice.billTo.email}` : ""].filter(Boolean).join("\n")}
              </div>
            </div>

            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {["Date", "Child Name", "Charge Type", "Description", "Amount"].map((h) => <th key={h} className={head}>{h}</th>)}
                  {canEdit ? <th className={`${head} no-print`}>Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {invoice.charges.map((c) =>
                  editingId === c.id ? (
                    <tr key={c.id} className="no-print">
                      <td className={cell}><input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} aria-label="Charge date" className="w-full rounded border border-gray-300 px-2 py-1" /></td>
                      <td className={cell}>{c.childName}</td>
                      <td className={cell}>
                        <select value={draft.chargeType} onChange={(e) => setDraft({ ...draft, chargeType: e.target.value })} aria-label="Charge type" className="w-full rounded border border-gray-300 px-2 py-1">
                          {CHARGE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </td>
                      <td className={cell}><input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} aria-label="Charge description" className="w-full rounded border border-gray-300 px-2 py-1" /></td>
                      <td className={cell}><input type="number" min="0" step="0.01" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} aria-label="Charge amount" className="w-24 rounded border border-gray-300 px-2 py-1 text-right" /></td>
                      <td className={`${cell} whitespace-nowrap`}>
                        <button type="button" onClick={saveCharge} className="mr-2 font-bold text-blue-700">Save</button>
                        <button type="button" onClick={() => setEditingId("")} className="text-gray-600">Cancel</button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={c.id}>
                      <td className={`${cell} text-center`}>{shortDate(c.date)}</td>
                      <td className={cell}>{c.childName}</td>
                      <td className={cell}>{chargeTypeLabel(c.chargeType)}</td>
                      <td className={cell}>{c.description}</td>
                      <td className={`${cell} text-right`}>{money(c.amountCents)}</td>
                      {canEdit ? (
                        <td className={`${cell} no-print whitespace-nowrap`}>
                          <button type="button" onClick={() => { setEditingId(c.id); setDraft({ date: String(c.date).slice(0, 10), description: c.description, amount: (c.amountCents / 100).toFixed(2), chargeType: c.chargeType || "OTHER" }); }} className="mr-2 font-semibold text-blue-700">✎ Edit</button>
                          <button type="button" onClick={() => deleteCharge(c)} aria-label={`Delete ${c.description}`} className="text-red-600">🗑</button>
                        </td>
                      ) : null}
                    </tr>
                  ),
                )}
              </tbody>
            </table>

            <div className="grid gap-6 md:grid-cols-[1fr_22rem]">
              <div className="rounded-md border border-[#9cb8dc]">
                <div className="bg-[#dbe8f7] px-4 py-2 font-bold text-[#0b2a5b]">Notes</div>
                <div className="whitespace-pre-line px-4 py-3 text-sm">
                  {invoice.notes || `Thank you for being a part of Ameris Academy!\nIf you have any questions about this invoice, please contact our office.`}
                </div>
              </div>
              <table className="w-full border-collapse text-sm">
                <tbody>
                  {[
                    ["Subtotal", invoice.totalCents],
                    ["Sales Tax", 0],
                    ["Total Invoice Amount", invoice.totalCents],
                    ["Payment/Credit Applied", invoice.paidCents],
                  ].map(([label, value]) => (
                    <tr key={label}>
                      <td className={`${cell} bg-[#eef4fb] font-bold`}>{label}</td>
                      <td className={`${cell} text-right`}>{money(value)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className={`${cell} bg-[#c6d9f0] text-base font-black text-[#0b2a5b]`}>TOTAL AMOUNT DUE</td>
                    <td className={`${cell} bg-[#c6d9f0] text-right text-lg font-black text-[#0b2a5b]`}>{money(invoice.balanceCents)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      <style jsx global>{`
        @media print {
          @page {
            size: portrait;
            margin: 10mm;
          }
          body * {
            visibility: hidden;
          }
          #invoice-print-sheet,
          #invoice-print-sheet * {
            visibility: visible;
          }
          #invoice-print-sheet {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
