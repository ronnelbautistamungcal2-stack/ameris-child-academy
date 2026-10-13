import { getSession } from "@/lib/auth";
import { decryptPin } from "@/lib/kioskPins";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

// "View PIN" on Account Settings: after re-entering their password, a user
// sees the PIN they set at the kiosk. It cannot be changed here.
export default async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }
  if (session.user.id !== String(req.query.id)) {
    return res.status(403).json({ error: "You can only view your own PIN" });
  }

  const password = String(req.body?.password || "");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { password: true, kioskCredential: true },
  });
  if (!user?.password || !password || !(await bcrypt.compare(password, user.password))) {
    return res.status(400).json({ error: "Incorrect password" });
  }

  const credential = user.kioskCredential;
  if (!credential?.pinCipher) {
    return res.status(200).json({ hasPin: false, pin: null });
  }
  return res.status(200).json({ hasPin: true, pin: decryptPin(credential.pinCipher) });
}
