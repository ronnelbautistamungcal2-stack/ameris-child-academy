import { requireGlobalAdmin } from "@/lib/globalAdmin";
import { answerAccess } from "@/lib/supportTickets";

// Ameris ends its access to a subscriber's center (or withdraws a request).
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const session = await requireGlobalAdmin(req, res, "CUSTOMER_SUPPORT");
  if (!session) return;
  const action = String(req.body?.action || "END").toUpperCase();
  const out = await answerAccess(String(req.query.id || ""), action, session.user, "AMERIS");
  if (out.error) return res.status(out.status).json({ error: out.error });
  return res.status(200).json(out.grant);
}
