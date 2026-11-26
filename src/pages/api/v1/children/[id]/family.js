import { getSession } from "@/lib/auth";
import {
  buildLegacyEmergencyContact,
  normalizeEmergencyContacts,
  normalizeOutOfAreaContact,
  normalizeParentContacts,
} from "@/lib/child-contacts";
import { changeStamps, normalizeHealthInfo, profileTabData } from "@/lib/childProfile";
import { profileAccess } from "@/lib/childProfileServer";
import prisma from "@/lib/prisma";

const has = (body, key) => Object.prototype.hasOwnProperty.call(body || {}, key);

/**
 * PUT /api/v1/children/:id/family { parentContacts?, emergencyContacts?, outOfAreaContact?, pediatrician?, schedule?, healthInfo?, carePlan? }
 * Family Information and Emergency Contacts on the Student Profile, and (client
 * sheet 10-29 (11), row 19) the schedule, Health & Safety and Care Plan.
 * Linked parents and admins; classroom details, the profile fields and
 * authorized pick-up stay with the center (client 07-01, B2-B4).
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (req.method !== "PUT") {
    res.setHeader("Allow", ["PUT"]);
    return res.status(405).end();
  }
  const child = await prisma.child.findUnique({
    where: { id: String(req.query.id) },
    include: { guardians: { select: { guardianId: true } } },
  });
  if (!child) return res.status(404).json({ error: "Child not found" });
  const access = await profileAccess(session.user, child);
  if (!access.editFamily) return res.status(403).json({ error: "Forbidden" });

  const body = req.body || {};
  const data = {};
  if (has(body, "parentContacts")) data.parentContacts = normalizeParentContacts(body.parentContacts);
  if (has(body, "emergencyContacts")) {
    data.emergencyContacts = normalizeEmergencyContacts(body.emergencyContacts);
    data.emergencyContact = buildLegacyEmergencyContact(data.emergencyContacts);
  }
  if (has(body, "outOfAreaContact")) data.outOfAreaContact = normalizeOutOfAreaContact(body.outOfAreaContact);
  if (has(body, "pediatrician") && !has(body, "healthInfo")) {
    data.healthInfo = normalizeHealthInfo({ ...normalizeHealthInfo(child.healthInfo), pediatrician: body.pediatrician });
  }
  // Schedule, Health & Safety and Care Plan: the same rules as Edit Child
  // (Child.allergies and the feeding plan follow), and the kitchen's
  // "updated" stamps when allergies or the feeding plan change.
  const tabs = {};
  for (const key of ["schedule", "healthInfo", "carePlan"]) if (has(body, key)) tabs[key] = body[key];
  if (Object.keys(tabs).length) {
    const tabData = profileTabData(tabs, child);
    Object.assign(data, tabData, changeStamps(child, { allergies: tabData.allergies, feedingPlan: tabData.feedingPlan }));
  }
  if (!Object.keys(data).length) return res.status(400).json({ error: "Nothing to save" });
  await prisma.child.update({ where: { id: child.id }, data });
  return res.status(200).json({ ok: true });
}
