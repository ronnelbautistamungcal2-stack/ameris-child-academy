import { centerIdFilter, getSession, hasAccessToCenter } from "@/lib/auth";
import {
  clearDeviceCookieHeader,
  deviceCookieHeader,
  DEVICE_COOKIE,
  hashDeviceToken,
  newDeviceToken,
} from "@/lib/kiosk";
import prisma from "@/lib/prisma";

// Admin-only kiosk enrollment. POST turns the browser making the request into
// a kiosk for a center (it receives the device cookie); GET lists enrolled
// devices; DELETE ?id= revokes one so it stops working at once.
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (session.user.role !== "ADMIN") return res.status(403).json({ error: "Only admins can manage kiosks" });

  if (req.method === "GET") {
    const wanted = req.query.centerId ? String(req.query.centerId) : "";
    if (wanted && !(await hasAccessToCenter(session.user.id, wanted))) return res.status(403).json({ error: "Forbidden" });
    // Only kiosks at this admin's own centers (client 2026-11-12: a new
    // subscriber saw Ameris Academy's kiosks).
    const devices = await prisma.kioskDevice.findMany({
      where: { revokedAt: null, centerId: await centerIdFilter(session.user.id, wanted) },
      select: {
        id: true,
        name: true,
        centerId: true,
        center: { select: { name: true } },
        createdAt: true,
        lastSeenAt: true,
        tokenHash: true,
      },
      orderBy: { createdAt: "desc" },
    });
    const currentToken = req.cookies?.[DEVICE_COOKIE];
    const currentHash = currentToken ? hashDeviceToken(currentToken) : null;
    return res.status(200).json(
      devices.map(({ tokenHash, ...device }) => ({ ...device, isThisDevice: tokenHash === currentHash })),
    );
  }

  if (req.method === "POST") {
    const centerId = String(req.body?.centerId || "");
    const name = String(req.body?.name || "").trim().slice(0, 80) || "Front desk kiosk";
    const center = centerId ? await prisma.center.findUnique({ where: { id: centerId } }) : null;
    if (!center) return res.status(400).json({ error: "Choose a center" });
    if (!(await hasAccessToCenter(session.user.id, center.id))) return res.status(403).json({ error: "Forbidden" });

    // Re-enrolling this browser replaces its previous enrollment.
    const previous = req.cookies?.[DEVICE_COOKIE];
    if (previous) {
      await prisma.kioskDevice.updateMany({
        where: { tokenHash: hashDeviceToken(previous), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    const token = newDeviceToken();
    const device = await prisma.kioskDevice.create({
      data: { centerId: center.id, name, tokenHash: hashDeviceToken(token), createdById: session.user.id },
    });
    res.setHeader("Set-Cookie", deviceCookieHeader(token));
    return res.status(201).json({ id: device.id, name: device.name, center: { id: center.id, name: center.name } });
  }

  // PATCH ?id=: open an enrolled kiosk on this browser (client request
  // 2026-10-29). The kiosk gets a fresh device key here, so the tablet that
  // held it before stops working as that kiosk.
  if (req.method === "PATCH") {
    const id = String(req.query.id || "");
    const device = id ? await prisma.kioskDevice.findUnique({ where: { id }, include: { center: { select: { id: true, name: true } } } }) : null;
    if (!device || device.revokedAt || !(await hasAccessToCenter(session.user.id, device.centerId))) {
      return res.status(404).json({ error: "Kiosk not found" });
    }
    const previous = req.cookies?.[DEVICE_COOKIE];
    if (previous && hashDeviceToken(previous) !== device.tokenHash) {
      await prisma.kioskDevice.updateMany({ where: { tokenHash: hashDeviceToken(previous), revokedAt: null }, data: { revokedAt: new Date() } });
    }
    const token = newDeviceToken();
    await prisma.kioskDevice.update({ where: { id }, data: { tokenHash: hashDeviceToken(token) } });
    res.setHeader("Set-Cookie", deviceCookieHeader(token));
    return res.status(200).json({ id: device.id, name: device.name, center: device.center });
  }

  if (req.method === "DELETE") {
    const id = String(req.query.id || "");
    const device = id ? await prisma.kioskDevice.findUnique({ where: { id } }) : null;
    if (!device || !(await hasAccessToCenter(session.user.id, device.centerId))) {
      return res.status(404).json({ error: "Kiosk not found" });
    }
    await prisma.kioskDevice.update({ where: { id }, data: { revokedAt: new Date() } });
    const currentToken = req.cookies?.[DEVICE_COOKIE];
    if (currentToken && hashDeviceToken(currentToken) === device.tokenHash) {
      res.setHeader("Set-Cookie", clearDeviceCookieHeader());
    }
    return res.status(204).end();
  }

  res.setHeader("Allow", ["GET", "POST", "PATCH", "DELETE"]);
  return res.status(405).end();
}
