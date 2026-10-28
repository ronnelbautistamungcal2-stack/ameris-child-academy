import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { hoursBetween } from "@/lib/timeSheetReport";
import { listRows, loadTimeSheetAccess } from "@/lib/timeSheets";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const dbDay = (key) => new Date(`${key}T00:00:00.000Z`);
const serialize = (s) => ({
  ...s,
  from: s.from.toISOString().slice(0, 10),
  to: s.to.toISOString().slice(0, 10),
});

/**
 * Employee time sheet e-signatures (client request 2026-10-02).
 * GET  ?userId=[&from=&to=]  the person's signed time sheets (themselves,
 *      or admins, coaches and HR at their centers)
 * POST { from, to, signatureName, certify: true }  the signed-in employee
 *      signs and submits their time sheet for from..to
 */
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (req.method === "GET") {
    const userId = String(req.query.userId || session.user.id);
    const access = await loadTimeSheetAccess(prisma, session, "staff", userId, { allowSelfRead: true });
    if (access.error) return res.status(access.status).json({ error: access.error });
    const where = { userId };
    if (DATE.test(String(req.query.from || "")) && DATE.test(String(req.query.to || ""))) {
      where.from = dbDay(req.query.from);
      where.to = dbDay(req.query.to);
    }
    const rows = await prisma.timeSheetSignature.findMany({ where, orderBy: { from: "desc" }, take: 100 });
    return res.status(200).json(rows.map(serialize));
  }

  if (req.method === "POST") {
    const { from, to, signatureName, certify } = req.body || {};
    if (!DATE.test(String(from || "")) || !DATE.test(String(to || "")) || from > to) {
      return res.status(400).json({ error: "Choose a valid date range" });
    }
    const name = String(signatureName || "").trim();
    if (name.length < 2) return res.status(400).json({ error: "Type your full name to sign" });
    if (certify !== true) return res.status(400).json({ error: "Confirm that the time sheet is accurate" });
    const access = await loadTimeSheetAccess(prisma, session, "staff", session.user.id, { allowSelfRead: true });
    if (access.error) return res.status(access.status).json({ error: access.error });
    const rows = await listRows(prisma, "staff", access.subject, { from: `${from}T00:00`, to: `${to}T00:00` });
    const totalHours = Math.round(rows.reduce((sum, r) => sum + hoursBetween(r.timeIn, r.timeOut), 0) * 100) / 100;
    const signature = await prisma.timeSheetSignature.upsert({
      where: { userId_from_to: { userId: session.user.id, from: dbDay(from), to: dbDay(to) } },
      update: { signatureName: name.slice(0, 120), totalHours, signedAt: new Date() },
      create: { userId: session.user.id, from: dbDay(from), to: dbDay(to), signatureName: name.slice(0, 120), totalHours },
    });
    return res.status(201).json(serialize(signature));
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).end();
}
