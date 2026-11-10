import { requireSubscriberAdmin } from "@/lib/supportAuth";
import { answerAccess } from "@/lib/supportTickets";

// The subscriber grants, declines or ends Ameris support's access to a center.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const user = await requireSubscriberAdmin(req, res);
  if (!user) return;
  const action = String(req.body?.action || "").toUpperCase();
  const out = await answerAccess(String(req.query.id || ""), action, user, "SUBSCRIBER");
  if (out.error) return res.status(out.status).json({ error: out.error });
  return res.status(200).json(out.grant);
}
