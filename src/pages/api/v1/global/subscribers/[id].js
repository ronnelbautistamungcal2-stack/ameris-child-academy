import prisma from "@/lib/prisma";
import { ACCOUNT_STATUS_LABELS, ADD_ON_LABELS } from "@/lib/addOns";
import { curriculumTypeLabels } from "@/lib/curriculumTypes";
import { parseAccountInput, requireGlobalAdmin } from "@/lib/globalAdmin";
import { ageGroupOptions, normalizeAgeGroups } from "@/lib/curriculumSource";
import { accountQuote, parsePricingSelection } from "@/lib/pricingServer";
import { money } from "@/lib/subscriptionPricing";

async function loadDetail(id) {
  const account = await prisma.subscriberAccount.findUnique({
    where: { id },
    include: {
      centers: { select: { id: true, name: true, city: true, state: true, _count: { select: { children: true } } }, orderBy: { name: "asc" } },
      users: {
        where: { OR: [{ role: "ADMIN" }, { roles: { has: "ADMIN" } }] },
        select: { id: true, name: true, email: true, disabled: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
      notes: {
        include: { author: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!account) return null;
  const options = await ageGroupOptions();
  const ageGroupNames = options.filter((o) => account.curriculumAgeGroups.includes(o.id)).map((o) => o.name);
  const childCount = account.centers.reduce((sum, c) => sum + c._count.children, 0);
  return {
    ...account,
    childCount,
    ageGroupNames,
    // The price from the account's pricing choices and the pricing set in effect (step G).
    quote: await accountQuote(account),
    centers: account.centers.map(({ _count, ...c }) => ({ ...c, childCount: _count.children })),
  };
}

function describeChanges(before, data) {
  const out = [];
  if (data.status && data.status !== before.status) {
    out.push(`Status changed to ${ACCOUNT_STATUS_LABELS[data.status] || data.status}.`);
  }
  if (data.addOns) {
    const added = data.addOns.filter((k) => !before.addOns.includes(k));
    const removed = before.addOns.filter((k) => !data.addOns.includes(k));
    if (added.length) out.push(`Add-ons turned on: ${added.map((k) => ADD_ON_LABELS[k]).join(", ")}.`);
    if (removed.length) out.push(`Add-ons turned off: ${removed.map((k) => ADD_ON_LABELS[k]).join(", ")}.`);
  }
  if (data.curriculumTypes) {
    const same = data.curriculumTypes.length === (before.curriculumTypes || []).length && data.curriculumTypes.every((t) => before.curriculumTypes.includes(t));
    if (!same) out.push(`Curriculum types set to ${curriculumTypeLabels(data.curriculumTypes) || "none"}.`);
  }
  if (data.curriculumAgeGroups) {
    const before_ = before.curriculumAgeGroups || [];
    const same = data.curriculumAgeGroups.length === before_.length && data.curriculumAgeGroups.every((g) => before_.includes(g));
    if (!same) out.push(`Age groups set to ${(data.ageGroupNames || []).join(", ") || "none"}.`);
  }
  if (data.maxCenters !== undefined && data.maxCenters !== before.maxCenters) out.push(`Center limit set to ${data.maxCenters}.`);
  if (data.maxChildren !== undefined && data.maxChildren !== before.maxChildren) {
    out.push(data.maxChildren == null ? "Child limit removed." : `Child limit set to ${data.maxChildren}.`);
  }
  return out;
}

/**
 * GET   /api/v1/global/subscribers/:id
 * PATCH /api/v1/global/subscribers/:id { status, addOns, maxCenters, maxChildren, ..., pricingSelection, note }
 *       Every change is written to the account's Notes. A plain { note } adds a note.
 */
export default async function handler(req, res) {
  const session = await requireGlobalAdmin(req, res);
  if (!session) return undefined;
  const id = String(req.query.id || "");

  if (req.method === "GET") {
    const detail = await loadDetail(id);
    if (!detail) return res.status(404).json({ error: "Subscriber not found" });
    return res.status(200).json(detail);
  }

  if (req.method === "PATCH") {
    const before = await prisma.subscriberAccount.findUnique({ where: { id } });
    if (!before) return res.status(404).json({ error: "Subscriber not found" });
    const body = req.body || {};
    const parsed = parseAccountInput(body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const data = parsed.data;
    let ageGroupNames = [];
    if (data.curriculumAgeGroups) {
      const options = await ageGroupOptions();
      data.curriculumAgeGroups = await normalizeAgeGroups(data.curriculumAgeGroups);
      ageGroupNames = options.filter((o) => data.curriculumAgeGroups.includes(o.id)).map((o) => o.name);
    }
    if (data.status === "ACTIVE" && !before.activatedAt) data.activatedAt = new Date();
    if (body.pricingSelection !== undefined) {
      const pricing = parsePricingSelection(body.pricingSelection);
      if (pricing.error) return res.status(400).json({ error: pricing.error });
      data.pricingSelection = pricing.data;
    }

    const notes = describeChanges(before, { ...data, ageGroupNames });
    if (data.pricingSelection) {
      const q = await accountQuote({ ...before, ...data });
      notes.push(q && !q.error ? `Pricing updated: ${money(q.monthly)} a month (${data.pricingSelection.children} children, ${data.pricingSelection.billingCycle === "ANNUAL" ? "annual" : "monthly"}).` : "Pricing choices updated.");
    }
    const typed = String(body.note || "").trim().slice(0, 2000);
    if (typed) notes.push(typed);

    await prisma.$transaction([
      prisma.subscriberAccount.update({ where: { id }, data }),
      ...notes.map((description) =>
        prisma.subscriberAccountNote.create({ data: { accountId: id, authorId: session.user.id, description } }),
      ),
    ]);
    return res.status(200).json(await loadDetail(id));
  }

  res.setHeader("Allow", ["GET", "PATCH"]);
  return res.status(405).end();
}
