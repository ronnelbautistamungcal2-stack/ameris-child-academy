// The Order Form a center signs in DocuSign with its Subscriber Agreement
// (client 2026-11-11: the signed documents must include or reference the
// selected services, pricing, billing terms and discounts). DocuSign turns
// this HTML into a PDF; the white /sn1/ and /ds1/ text marks where the
// signature and date go.

const esc = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const money = (cents) => `$${((Number(cents) || 0) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (d) => new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

export const SIGN_ANCHOR = "/sn1/";
export const DATE_ANCHOR = "/ds1/";

/**
 * lead: the Lead (center, contact, quote); signer: { fullName, email };
 * charges: enrollmentCharges(); agreement: { name, version }; termMonths.
 */
export function orderFormHtml({ lead, signer, charges, agreement, termMonths, company }) {
  const q = lead.quoteData || {};
  const annual = charges.billingCycle === "ANNUAL";
  const rows = [
    ...(q.lines || []).map((l) => `<tr><td>${esc(l.label)}</td><td class="r">${money(l.amount)}</td></tr>`),
    ...(q.discounts || []).map((d) => `<tr><td>${esc(d.label)}</td><td class="r">${money(d.amount)}</td></tr>`),
  ].join("");
  const curriculum = (q.curriculumDetails || [])
    .map((c) => `${esc(c.label)}${c.classrooms ? ` (${c.classrooms} classroom${c.classrooms === 1 ? "" : "s"})` : ""}`)
    .join(", ");
  return `<!doctype html><html><head><meta charset="utf-8"><style>
body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#1f2937;margin:28px}
h1{font-size:20px;color:#0b2a5b;margin:0 0 4px}h2{font-size:14px;color:#0b2a5b;margin:18px 0 6px}
table{width:100%;border-collapse:collapse}td{padding:5px 6px;border-bottom:1px solid #e5e7eb;vertical-align:top}
td.r{text-align:right;white-space:nowrap}.k{color:#6b7280;width:38%}.tot td{font-weight:bold;border-top:2px solid #0b2a5b}
.sig td{border:none;padding-top:60px}.line{border-bottom:1px solid #111;height:34px}.anchor{color:#ffffff;font-size:10px}
.small{font-size:10px;color:#6b7280}
</style></head><body>
<h1>${esc(company)} — Subscription Order Form</h1>
<div class="small">Quote ${esc(lead.quoteNumber)} · Prepared ${day(lead.quoteDate || new Date())}</div>

<h2>Subscriber</h2>
<table>
<tr><td class="k">Program / Center</td><td>${esc(lead.centerName)}</td></tr>
<tr><td class="k">Contact</td><td>${esc(lead.contactName)} (${esc(lead.email)}${lead.phone ? `, ${esc(lead.phone)}` : ""})</td></tr>
${lead.location ? `<tr><td class="k">Location</td><td>${esc(lead.location)}</td></tr>` : ""}
<tr><td class="k">Number of children</td><td>${esc(q.children ?? lead.pricingSelection?.children ?? "")}</td></tr>
<tr><td class="k">Locations</td><td>${esc(lead.locations || 1)}</td></tr>
<tr><td class="k">Authorized signer</td><td>${esc(signer.fullName)} (${esc(signer.email)})</td></tr>
</table>

<h2>Selected Services and Pricing</h2>
<table>${rows}
<tr class="tot"><td>${annual ? "Annual" : "Monthly"} subscription</td><td class="r">${money(charges.recurringAmount)}</td></tr>
</table>
${curriculum ? `<p>Curriculum (${esc(q.curriculumVersion === "FAITH_BASED" ? "Faith Based" : "Standard")}): ${curriculum}</p>` : ""}

<h2>Billing Terms</h2>
<table>
<tr><td class="k">Billing frequency</td><td>${annual ? "Annual" : "Monthly"}</td></tr>
<tr><td class="k">Start date</td><td>${day(charges.startDate)}</td></tr>
<tr><td class="k">Due at enrollment</td><td>${money(charges.dueToday)} — ${esc(charges.dueTodayNote)}</td></tr>
<tr><td class="k">Recurring charge</td><td>${money(charges.recurringAmount)} ${annual ? "each year" : "on the 1st of each month"}, beginning ${day(charges.nextBillingDate)}</td></tr>
<tr><td class="k">Initial term</td><td>${termMonths} months, renewing automatically for further ${termMonths}-month terms at the then-current rate unless cancelled before the renewal date</td></tr>
<tr><td class="k">Payment method</td><td>Charged automatically to the payment method provided at enrollment</td></tr>
</table>

<h2>Agreement</h2>
<p>This Order Form is governed by the <b>${esc(agreement.name)}</b> (version ${esc(agreement.version)}), which is attached and made part of this Order Form. By signing, the Subscriber agrees to the Agreement and to the services, pricing, billing terms and discounts above, and confirms the signer is authorized to sign for the Subscriber.</p>

<table class="sig"><tr>
<td style="width:60%"><div class="line"><span class="anchor">${SIGN_ANCHOR}</span></div>Signature — ${esc(signer.fullName)}</td>
<td><div class="line"><span class="anchor">${DATE_ANCHOR}</span></div>Date</td>
</tr></table>
</body></html>`;
}
