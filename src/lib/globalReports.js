// Global admin > Reports (client mockups 2026-11-06). Each report returns
// { stats: [{ label, value, money? }], charts, columns, rows, totals?, note? }
// so one page can show, print and export any of them. Money is in cents.
//
// Payments aren't taken yet (Stripe comes with enrollment), so Revenue shows
// the expected monthly revenue from each subscriber's price (Pricing card)
// and Outstanding Payments is empty until then.

import prisma from "@/lib/prisma";
import { ADD_ON_LABELS, ADD_ONS } from "@/lib/addOns";
import { accountQuote } from "@/lib/pricingServer";
import { LEAD_STATUSES } from "@/lib/leads";

export const REPORTS = [
  { key: "subscriptions", label: "Subscription Report" },
  { key: "revenue", label: "Revenue Report" },
  { key: "outstanding", label: "Outstanding Payments" },
  { key: "sales", label: "Sales Pipeline Report" },
  { key: "support", label: "Customer Support Report" },
  { key: "addons", label: "Add-On Report" },
  { key: "activity", label: "Activity Log" },
];

const STATUS_LABELS = { ACTIVE: "Active", PENDING: "Pending Approval", ON_HOLD: "On Hold", CANCELLED: "Cancelled" };
const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");
const inRange = (d, range) => d && new Date(d) >= range.from && new Date(d) < range.to;

/** { from, to } as Dates; `to` is the day after the last day. Default: this month. */
export function parseRange(query = {}) {
  const now = new Date();
  const ok = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
  const from = ok(query.from) ? new Date(`${query.from}T00:00:00.000Z`) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const lastDay = ok(query.to) ? new Date(`${query.to}T00:00:00.000Z`) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  const to = new Date(lastDay.getTime() + 86400000);
  return { from, to, fromKey: day(from), toKey: day(lastDay) };
}

async function accountsWithPrices() {
  const accounts = await prisma.subscriberAccount.findMany({
    include: { centers: { select: { _count: { select: { children: true } } } } },
    orderBy: { accountNumber: "asc" },
  });
  const out = [];
  for (const a of accounts) {
    const q = await accountQuote(a);
    const children = a.centers.reduce((s, c) => s + c._count.children, 0);
    const base = q && !q.error ? q.lines.filter((l) => l.kind === "BASE").reduce((s, l) => s + l.amount, 0) : 0;
    const extras = q && !q.error ? q.lines.filter((l) => l.kind !== "BASE").reduce((s, l) => s + l.amount, 0) : 0;
    const discount = q && !q.error ? q.discounts.reduce((s, d) => s + d.amount, 0) : 0;
    // The discount comes off both parts in proportion.
    const share = base + extras ? (base + extras + discount) / (base + extras) : 1;
    out.push({
      account: a,
      children,
      quote: q && !q.error ? q : null,
      monthly: q && !q.error ? q.monthly : 0,
      baseMonthly: Math.round(base * share),
      addOnMonthly: Math.round(extras * share),
      byKind: q && !q.error ? q.lines.reduce((m, l) => ({ ...m, [l.kind === "ADD_ON" ? l.label : l.kind]: (m[l.kind === "ADD_ON" ? l.label : l.kind] || 0) + Math.round(l.amount * share) }), {}) : {},
    });
  }
  return out;
}

async function subscriptions(range) {
  const rows = await accountsWithPrices();
  const count = (s) => rows.filter((r) => r.account.status === s).length;
  return {
    stats: [
      { label: "Total Subscribers", value: rows.length },
      { label: "Active", value: count("ACTIVE") },
      { label: "Pending Approval", value: count("PENDING") },
      { label: "New This Period", value: rows.filter((r) => inRange(r.account.createdAt, range)).length },
      { label: "Expected Monthly Revenue", value: rows.filter((r) => r.account.status === "ACTIVE").reduce((s, r) => s + r.monthly, 0), money: true },
    ],
    charts: {
      pie: { title: "Subscribers by Status", data: Object.entries(STATUS_LABELS).map(([k, label]) => ({ label, value: count(k) })) },
    },
    columns: [
      { key: "accountNumber", label: "Account #" },
      { key: "name", label: "Subscriber (Center Name)" },
      { key: "status", label: "Status" },
      { key: "children", label: "# of Children", align: "right" },
      { key: "addOns", label: "Add-Ons", align: "right" },
      { key: "monthly", label: "Monthly", money: true, align: "right" },
      { key: "startDate", label: "Start Date" },
      { key: "renewalDate", label: "Renewal Date" },
    ],
    rows: rows.map((r) => ({
      accountNumber: r.account.accountNumber,
      name: r.account.name,
      status: STATUS_LABELS[r.account.status] || r.account.status,
      children: r.account.pricingSelection?.children ?? r.children,
      addOns: r.account.addOns.length,
      monthly: r.quote ? r.monthly : null,
      startDate: day(r.account.startDate),
      renewalDate: day(r.account.renewalDate),
    })),
    note: "Monthly is the price from each subscriber's Pricing card (blank when no pricing is set up).",
  };
}

async function revenue() {
  const rows = (await accountsWithPrices()).filter((r) => r.account.status === "ACTIVE" && r.quote);
  const total = rows.reduce((s, r) => s + r.monthly, 0);
  const base = rows.reduce((s, r) => s + r.baseMonthly, 0);
  const addOn = rows.reduce((s, r) => s + r.addOnMonthly, 0);
  const byKind = {};
  for (const r of rows) for (const [k, v] of Object.entries(r.byKind)) byKind[k] = (byKind[k] || 0) + v;
  const pieLabels = { BASE: "Subscription (Base Program)", CURRICULUM: "Curriculum" };
  return {
    stats: [
      { label: "Expected Monthly Revenue", value: total, money: true },
      { label: "Subscription Revenue", value: base, money: true },
      { label: "Add-On Revenue", value: addOn, money: true },
      { label: "Paying Subscribers", value: rows.length },
    ],
    charts: {
      pie: { title: "Revenue by Type", money: true, data: Object.entries(byKind).map(([k, v]) => ({ label: pieLabels[k] || k, value: v })) },
    },
    columns: [
      { key: "accountNumber", label: "Account #" },
      { key: "name", label: "Subscriber (Center Name)" },
      { key: "base", label: "Subscription Revenue", money: true, align: "right" },
      { key: "addOn", label: "Add-On Revenue", money: true, align: "right" },
      { key: "total", label: "Total Revenue", money: true, align: "right" },
    ],
    rows: rows.map((r) => ({ accountNumber: r.account.accountNumber, name: r.account.name, base: r.baseMonthly, addOn: r.addOnMonthly, total: r.monthly })),
    totals: { accountNumber: "Total Revenue", base, addOn, total },
    note: "Expected monthly revenue of active subscribers, from their pricing (after discounts). Actual payments appear here once online payment (Stripe) is connected.",
  };
}

async function outstanding() {
  return {
    stats: [
      { label: "Total Outstanding", value: 0, money: true },
      { label: "# of Accounts", value: 0 },
      { label: "Oldest Balance", value: "—" },
      { label: "Avg. Balance", value: 0, money: true },
    ],
    columns: [
      { key: "accountNumber", label: "Account #" },
      { key: "name", label: "Subscriber (Center Name)" },
      { key: "amount", label: "Amount Due", money: true, align: "right" },
      { key: "days", label: "Days Past Due", align: "right" },
      { key: "invoice", label: "Last Invoice Date" },
    ],
    rows: [],
    note: "Online payment isn't connected yet, so there are no invoices or balances. Once Stripe is connected, unpaid invoices show here.",
  };
}

async function sales(range) {
  const leads = await prisma.lead.findMany({ where: { createdAt: { gte: range.from, lt: range.to } }, orderBy: { createdAt: "desc" } });
  const total = leads.length;
  const byStatus = LEAD_STATUSES.map((s) => ({ label: s.label, value: leads.filter((l) => l.status === s.value).length }));
  // Potential revenue: quotes of leads still open (not Won or Lost).
  const open = leads.filter((l) => l.quoteData && !["WON", "LOST"].includes(l.status));
  const potential = {};
  for (const l of open) {
    const share = l.quoteData.lines.reduce((s, x) => s + x.amount, 0) ? l.quoteData.monthly / l.quoteData.lines.reduce((s, x) => s + x.amount, 0) : 1;
    for (const line of l.quoteData.lines) {
      const k = line.kind === "BASE" ? "Base Program" : line.kind === "CURRICULUM" ? "Curriculum Add-On" : `${line.label} Add-On`;
      potential[k] = (potential[k] || 0) + Math.round(line.amount * share);
    }
  }
  const potentialTotal = open.reduce((s, l) => s + l.quoteData.monthly, 0);
  const label = (v) => LEAD_STATUSES.find((s) => s.value === v)?.label || v;
  return {
    stats: [
      { label: "Total Leads", value: total },
      { label: "Quotes Sent", value: leads.filter((l) => l.quoteNumber).length },
      { label: "Won (Subscribed)", value: leads.filter((l) => l.status === "WON").length },
      { label: "Total Potential Revenue", value: potentialTotal, money: true },
    ],
    charts: {
      pie: { title: "Sales Pipeline", data: byStatus },
      breakdown: { title: "Potential Monthly Revenue", money: true, data: Object.entries(potential).map(([label, value]) => ({ label, value })) },
    },
    columns: [
      { key: "name", label: "Center / Prospect Name" },
      { key: "status", label: "Status" },
      { key: "quote", label: "Quote Amount (Per Month)", money: true, align: "right" },
      { key: "quoteDate", label: "Quote Date" },
      { key: "followUp", label: "Follow-Up Date" },
    ],
    rows: leads.map((l) => ({
      name: l.centerName,
      status: label(l.status),
      quote: l.quoteData ? l.quoteData.monthly : null,
      quoteDate: day(l.quoteDate),
      followUp: day(l.followUpDate),
    })),
    note: "Leads created in the date range. Potential revenue counts quotes of leads that aren't Won or Lost yet.",
  };
}

async function support(range) {
  const tickets = await prisma.supportTicket.findMany({
    where: { createdAt: { gte: range.from, lt: range.to } },
    include: {
      account: { select: { accountNumber: true, name: true } },
      messages: { where: { fromAmeris: true, isEvent: false }, select: { createdAt: true }, orderBy: { createdAt: "asc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });
  const hours = (a, b) => (new Date(b) - new Date(a)) / 3600000;
  const responded = tickets.filter((t) => t.messages[0]);
  const closed = tickets.filter((t) => t.closedAt);
  const avg = (list) => (list.length ? Math.round((list.reduce((s, x) => s + x, 0) / list.length) * 10) / 10 : null);
  const count = (s) => tickets.filter((t) => t.status === s).length;
  const avgResponse = avg(responded.map((t) => hours(t.createdAt, t.messages[0].createdAt)));
  const avgResolution = avg(closed.map((t) => hours(t.createdAt, t.closedAt)));
  return {
    stats: [
      { label: "Total Tickets", value: tickets.length },
      { label: "Open", value: count("OPEN") },
      { label: "In Progress", value: count("IN_PROGRESS") },
      { label: "Resolved", value: count("CLOSED") },
      { label: "Avg. Response Time", value: avgResponse == null ? "—" : `${avgResponse} hrs` },
      { label: "Avg. Resolution Time", value: avgResolution == null ? "—" : `${avgResolution} hrs` },
    ],
    charts: {
      bars: { title: "Tickets by Status", data: [{ label: "Resolved", value: count("CLOSED") }, { label: "In Progress", value: count("IN_PROGRESS") }, { label: "Open", value: count("OPEN") }] },
    },
    columns: [
      { key: "number", label: "Ticket #" },
      { key: "date", label: "Date / Time" },
      { key: "account", label: "Center / Subscriber" },
      { key: "subject", label: "Subject" },
      { key: "status", label: "Status" },
      { key: "resolution", label: "Resolution Time", align: "right" },
    ],
    rows: tickets.map((t) => ({
      number: t.number,
      date: new Date(t.createdAt).toISOString().slice(0, 16).replace("T", " "),
      account: `${t.account?.accountNumber || ""} ${t.account?.name || ""}`.trim(),
      subject: t.subject,
      status: { OPEN: "Open", IN_PROGRESS: "In Progress", CLOSED: "Resolved" }[t.status] || t.status,
      resolution: t.closedAt ? `${Math.round(hours(t.createdAt, t.closedAt) * 10) / 10} hrs` : "—",
    })),
    note: "Tickets opened in the date range. Response time is until the first Ameris reply; resolution time until the ticket was closed.",
  };
}

async function addons() {
  const rows = await accountsWithPrices();
  const withAny = rows.filter((r) => r.account.addOns.length);
  const totalSubs = rows.reduce((s, r) => s + r.account.addOns.length, 0);
  const totals = Object.fromEntries(ADD_ONS.map((k) => [k, rows.filter((r) => r.account.addOns.includes(k)).length]));
  return {
    stats: [
      { label: "Total Subscribers", value: rows.length },
      { label: "Subscribers with Add-Ons", value: withAny.length },
      { label: "Total Add-On Subscriptions", value: totalSubs },
      { label: "Avg. Add-Ons per Subscriber", value: rows.length ? Math.round((totalSubs / rows.length) * 10) / 10 : 0 },
    ],
    charts: { bars: { title: "Subscribers per Add-On", data: ADD_ONS.map((k) => ({ label: ADD_ON_LABELS[k], value: totals[k] })) } },
    columns: [
      { key: "accountNumber", label: "Account #" },
      { key: "name", label: "Subscriber (Center Name)" },
      { key: "children", label: "# of Children", align: "right" },
      ...ADD_ONS.map((k) => ({ key: k, label: ADD_ON_LABELS[k], align: "center" })),
    ],
    rows: rows.map((r) => ({
      accountNumber: r.account.accountNumber,
      name: r.account.name,
      children: r.account.pricingSelection?.children ?? r.children,
      ...Object.fromEntries(ADD_ONS.map((k) => [k, r.account.addOns.includes(k) ? "X" : ""])),
    })),
    totals: { accountNumber: "Total Subscribers with Add-Ons", children: "—", ...totals },
  };
}

async function activity(range) {
  const [notes, leadActs, ticketEvents] = await Promise.all([
    prisma.subscriberAccountNote.findMany({
      where: { createdAt: { gte: range.from, lt: range.to } },
      include: { author: { select: { name: true, email: true } }, account: { select: { accountNumber: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.leadActivity.findMany({
      where: { createdAt: { gte: range.from, lt: range.to } },
      include: { staff: { select: { name: true, email: true } }, lead: { select: { number: true, centerName: true } } },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.supportTicketMessage.findMany({
      where: { isEvent: true, createdAt: { gte: range.from, lt: range.to } },
      include: { author: { select: { name: true, email: true } }, ticket: { select: { number: true, account: { select: { accountNumber: true, name: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
  ]);
  const who = (u, fallback) => u?.name || u?.email || fallback;
  const rows = [
    ...notes.map((n) => ({ at: n.createdAt, area: "Subscribers", about: `${n.account.accountNumber} ${n.account.name}`, staff: who(n.author, "System"), description: n.description })),
    ...leadActs.map((a) => ({ at: a.createdAt, area: "Sales & Leads", about: `${a.lead.number} ${a.lead.centerName}`, staff: who(a.staff, "Website"), description: a.description })),
    ...ticketEvents.map((m) => ({ at: m.createdAt, area: "Customer Support", about: `${m.ticket.number} ${m.ticket.account?.name || ""}`.trim(), staff: who(m.author, "System"), description: m.body })),
  ]
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .map((r) => ({ ...r, at: new Date(r.at).toISOString().slice(0, 16).replace("T", " ") }));
  return {
    stats: [
      { label: "Activities", value: rows.length },
      { label: "Subscribers", value: notes.length },
      { label: "Sales & Leads", value: leadActs.length },
      { label: "Customer Support", value: ticketEvents.length },
    ],
    columns: [
      { key: "at", label: "Date / Time (UTC)" },
      { key: "area", label: "Area" },
      { key: "about", label: "Account / Lead / Ticket" },
      { key: "staff", label: "Staff" },
      { key: "description", label: "Activity" },
    ],
    rows,
  };
}

const BUILDERS = { subscriptions, revenue, outstanding, sales, support, addons, activity };

export async function buildReport(key, range) {
  const fn = BUILDERS[key];
  if (!fn) return null;
  const report = REPORTS.find((r) => r.key === key);
  return { key, label: report.label, from: range.fromKey, to: range.toKey, ...(await fn(range)) };
}
