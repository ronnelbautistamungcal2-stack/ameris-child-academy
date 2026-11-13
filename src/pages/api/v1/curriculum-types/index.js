import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  MAX_TYPE_LABEL,
  PRICED_TYPES,
  canEditCurriculumTypes,
  curriculumTypeUse,
  loadCurriculumTypes,
  typeValueFor,
} from "@/lib/curriculumTypesServer";

// Curriculum > Categories > Types (client sheet 10-29 (8), rows 8-10). The
// list feeds the lesson and step forms, the Lesson Planner's Type, and the
// Global admin's Sales & Leads and Subscribers curriculum type choices.
//
// GET                                 { types: [{ value, label }], canEdit }
// POST   { label }                    (curriculum admins) -> the new type
// PATCH  ?value=  { label }           rename; lessons keep the same value
// DELETE ?value=                      only when nothing uses it

const cleanLabel = (v) => String(v ?? "").trim().replace(/\s+/g, " ").slice(0, MAX_TYPE_LABEL);

function plural(n, word) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export default async function handler(req, res) {
  try {
    const session = await getSession(req, res);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const user = session.user;

    if (req.method === "GET") {
      const [types, canEdit] = await Promise.all([loadCurriculumTypes(), canEditCurriculumTypes(user)]);
      return res.status(200).json({ types: types.map(({ value, label }) => ({ value, label })), canEdit });
    }

    if (!(await canEditCurriculumTypes(user))) {
      return res.status(403).json({ error: "Only the Ameris curriculum admins can change the curriculum types" });
    }
    const existing = await prisma.curriculumType.findMany();
    const clash = (label, except) => existing.find((t) => t.value !== except && t.label.toLowerCase() === label.toLowerCase());

    if (req.method === "POST") {
      const label = cleanLabel(req.body?.label ?? req.body?.name);
      if (!label) return res.status(400).json({ error: "Enter a name" });
      if (clash(label)) return res.status(409).json({ error: `"${label}" is already a type` });
      const value = typeValueFor(label, new Set(existing.map((t) => t.value)));
      const sortOrder = existing.reduce((max, t) => Math.max(max, t.sortOrder), 0) + 1;
      const row = await prisma.curriculumType.create({ data: { value, label, sortOrder } });
      return res.status(201).json({ value: row.value, label: row.label });
    }

    const value = String(req.query.value || "");
    const row = existing.find((t) => t.value === value);
    if (!row) return res.status(404).json({ error: "Type not found" });

    if (req.method === "PATCH") {
      const label = cleanLabel(req.body?.label ?? req.body?.name);
      if (!label) return res.status(400).json({ error: "Enter a name" });
      if (clash(label, value)) return res.status(409).json({ error: `"${label}" is already a type` });
      const saved = await prisma.curriculumType.update({ where: { value }, data: { label } });
      return res.status(200).json({ value: saved.value, label: saved.label });
    }

    if (req.method === "DELETE") {
      if (PRICED_TYPES.includes(value)) {
        return res.status(409).json({ error: `"${row.label}" can't be removed: the subscription prices use it. Rename it instead.` });
      }
      const use = await curriculumTypeUse(value);
      const used = [
        use.lessons && plural(use.lessons, "lesson or step"),
        use.plans && plural(use.plans, "lesson plan"),
        use.accounts && plural(use.accounts, "subscriber"),
      ].filter(Boolean);
      if (used.length) {
        return res.status(409).json({ error: `"${row.label}" is still used by ${used.join(", ")}. Change those first, or rename the type.` });
      }
      await prisma.curriculumType.delete({ where: { value } });
      return res.status(204).end();
    }

    res.setHeader("Allow", ["GET", "POST", "PATCH", "DELETE"]);
    return res.status(405).end();
  } catch (e) {
    console.error("curriculum types error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
