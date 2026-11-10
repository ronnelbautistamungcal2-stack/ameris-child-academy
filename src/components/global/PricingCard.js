import { useEffect, useMemo, useState } from "react";
import { apiJson } from "@/lib/api";
import { BILLING_CYCLES, CURRICULUM_VERSIONS, PROGRAM_TYPES, chosenDiscountId, classroomCounts, money, quote } from "@/lib/subscriptionPricing";

// Global admin > Subscribers > a subscriber > Pricing (client 2026-11-10,
// step G). The Ameris team types how many children they have and what they
// chose; the price comes from the pricing set in effect (Settings >
// Subscription Pricing). Add-ons are the ones ticked on the subscription.

const card = "rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900";
const input =
  "w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100";
const button =
  "rounded-xl border border-blue-700 px-4 py-2 text-sm font-bold text-blue-800 hover:bg-blue-50 disabled:opacity-50 dark:border-blue-400 dark:text-blue-200 dark:hover:bg-blue-900/30";
const primary = "rounded-xl bg-blue-800 px-4 py-2 text-sm font-bold text-white hover:bg-blue-900 disabled:opacity-50";

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function fromDetail(detail) {
  const s = detail.pricingSelection || {};
  return {
    children: s.children ?? "",
    billingCycle: s.billingCycle || "MONTHLY",
    programType: s.programType || "CENTER",
    // Faith Based when the account's types are only the Christian one.
    curriculumVersion:
      s.curriculumVersion ||
      ((detail.curriculumTypes || []).includes("NON_DENOMINATIONAL_CHRISTIAN") && !(detail.curriculumTypes || []).includes("NON_DENOMINATIONAL")
        ? "FAITH_BASED"
        : "STANDARD"),
    // Classrooms in each age group (client 2026-11-11: price per classroom).
    classrooms: classroomCounts(s),
    homeDaycareProgram: s.homeDaycareProgram || "",
    // Discounts can't be combined (client 2026-11-11).
    discountId: chosenDiscountId(s) || "",
    orderDate: s.orderDate || today(),
  };
}

function Lines({ q }) {
  if (!q) return <p className="text-sm text-gray-500">Enter the number of children to see the price.</p>;
  if (q.error) return <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{q.error}</p>;
  return (
    <table className="w-full text-sm">
      <tbody>
        {[...q.lines, ...q.discounts].map((l, i) => (
          <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
            <td className="py-1 text-gray-800 dark:text-gray-200">{l.label}</td>
            <td className="py-1 text-right text-xs text-gray-500">{l.detail || ""}</td>
            <td className={`py-1 text-right font-semibold ${l.amount < 0 ? "text-green-700" : "text-gray-900 dark:text-gray-100"}`}>{money(l.amount)}</td>
          </tr>
        ))}
        <tr>
          <td className="pt-2 font-extrabold text-gray-900 dark:text-gray-100">Monthly</td>
          <td />
          <td className="pt-2 text-right font-extrabold text-gray-900 dark:text-gray-100">{money(q.monthly)}</td>
        </tr>
        {q.periodTotal !== q.monthly ? (
          <tr>
            <td className="font-bold text-gray-900 dark:text-gray-100">Annual (12 months)</td>
            <td />
            <td className="text-right font-bold text-gray-900 dark:text-gray-100">{money(q.periodTotal)}</td>
          </tr>
        ) : null}
        <tr>
          <td className="text-gray-700 dark:text-gray-300">First payment</td>
          <td className="text-right text-xs text-gray-500">{q.firstPaymentNote}</td>
          <td className="text-right font-bold text-blue-800 dark:text-blue-200">{money(q.firstPayment)}</td>
        </tr>
      </tbody>
    </table>
  );
}

export default function PricingCard({ detail, saving, onSave }) {
  const [pricing, setPricing] = useState(null); // the set in effect
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => fromDetail(detail));
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    apiJson("/api/v1/global/pricing-sets")
      .then(({ sets }) => setPricing(sets.find((s) => s.current) || null))
      .catch(() => setPricing(null));
  }, []);
  useEffect(() => setForm(fromDetail(detail)), [detail]);

  const preview = useMemo(() => {
    if (!pricing || form.children === "") return null;
    return quote(pricing.data, { ...form, children: Number(form.children), orderDate: `${form.orderDate}T12:00:00`, addOns: detail.addOns });
  }, [pricing, form, detail.addOns]);

  const curriculumOn = detail.addOns.includes("CURRICULUM");
  const setClassrooms = (key, value) => {
    const n = Math.max(0, Math.min(99, Number.parseInt(value, 10) || 0));
    const next = { ...form.classrooms };
    if (n) next[key] = n;
    else delete next[key];
    set({ classrooms: next });
  };

  return (
    <div className={card}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-extrabold text-gray-900 dark:text-gray-100">Pricing</h3>
        {!editing ? (
          <button type="button" className={button} onClick={() => setEditing(true)}>
            {detail.pricingSelection ? "Edit Pricing" : "Set Up Pricing"}
          </button>
        ) : null}
      </div>
      {!editing ? (
        <>
          <Lines q={detail.quote} />
          {detail.quote?.pricingSet ? (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Prices from &ldquo;{detail.quote.pricingSet.name}&rdquo; (Settings &gt; Subscription Pricing).
              {detail.pricingSelection?.billingCycle === "ANNUAL" ? " Billed annually." : " Billed monthly."}
            </p>
          ) : null}
        </>
      ) : !pricing ? (
        <p className="text-sm text-amber-800">No pricing set yet. Add one under Settings &gt; Subscription Pricing.</p>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                <span className="mb-1 block font-semibold text-gray-700 dark:text-gray-200">Number of Children</span>
                <input className={input} type="number" min="1" value={form.children} onChange={(e) => set({ children: e.target.value })} />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-semibold text-gray-700 dark:text-gray-200">Billing</span>
                <select className={input} value={form.billingCycle} onChange={(e) => set({ billingCycle: e.target.value })}>
                  {BILLING_CYCLES.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-semibold text-gray-700 dark:text-gray-200">Order Date</span>
                <input className={input} type="date" value={form.orderDate} onChange={(e) => set({ orderDate: e.target.value })} />
              </label>
            </div>

            <fieldset>
              <legend className="mb-1 text-sm font-bold text-gray-700 dark:text-gray-200">Curriculum</legend>
              {!curriculumOn ? (
                <p className="text-xs text-gray-500">The Curriculum add-on is off on this subscription.</p>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-3">
                    <select className={input} aria-label="Program type" value={form.programType} onChange={(e) => set({ programType: e.target.value })}>
                      {PROGRAM_TYPES.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    <select className={input} aria-label="Curriculum version" value={form.curriculumVersion} onChange={(e) => set({ curriculumVersion: e.target.value })}>
                      {CURRICULUM_VERSIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  {form.programType === "HOME_DAYCARE" ? (
                    <select className={input} aria-label="Home Daycare program" value={form.homeDaycareProgram} onChange={(e) => set({ homeDaycareProgram: e.target.value })}>
                      <option value="">Choose a program</option>
                      {pricing.data.homeDaycare.map((p) => (
                        <option key={p.key} value={p.key}>{p.label}</option>
                      ))}
                    </select>
                  ) : (
                    <div>
                      <div className="mb-1 text-xs text-gray-500 dark:text-gray-400">Number of classrooms in each age group</div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        {pricing.data.curriculumCenters.map((g) => (
                          <label key={g.key} className="flex items-center justify-between gap-2 text-sm text-gray-800 dark:text-gray-200">
                            {g.label}
                            <input
                              type="number"
                              min="0"
                              max="99"
                              aria-label={`${g.label} classrooms`}
                              className="w-16 rounded-lg border border-gray-300 bg-white px-2 py-1 text-right text-sm dark:border-gray-600 dark:bg-gray-800"
                              value={form.classrooms[g.key] || ""}
                              placeholder="0"
                              onChange={(e) => setClassrooms(g.key, e.target.value)}
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </fieldset>

            <fieldset>
              <legend className="mb-1 text-sm font-bold text-gray-700 dark:text-gray-200">Discount (one at most)</legend>
              <div className="grid grid-cols-2 gap-1">
                <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                  <input type="radio" name="pricing-discount" checked={!form.discountId} onChange={() => set({ discountId: "" })} />
                  No discount
                </label>
                {pricing.data.discounts
                  .filter((d) => d.active || form.discountId === d.id)
                  .map((d) => (
                    <label key={d.id} className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                      <input type="radio" name="pricing-discount" checked={form.discountId === d.id} onChange={() => set({ discountId: d.id })} />
                      {d.name} ({d.amount}%){d.active ? "" : " – inactive"}
                    </label>
                  ))}
              </div>
            </fieldset>
            <p className="text-xs text-gray-500 dark:text-gray-400">Add-ons are the ones ticked on the subscription above.</p>
          </div>

          <div>
            <div className="mb-1 text-sm font-bold text-gray-700 dark:text-gray-200">Price</div>
            <Lines q={preview} />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className={button}
                disabled={saving}
                onClick={() => {
                  setForm(fromDetail(detail));
                  setEditing(false);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className={primary}
                disabled={saving || !preview || preview.error}
                onClick={async () => {
                  if (await onSave({ ...form, children: Number(form.children) })) setEditing(false);
                }}
              >
                {saving ? "Saving..." : "Save Pricing"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
