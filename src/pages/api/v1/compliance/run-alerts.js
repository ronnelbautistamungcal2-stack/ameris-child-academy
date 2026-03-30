import { getSession } from "@/lib/auth";
import { createApiHandler, forbidden, unauthorized } from "@/lib/api-error";
import { ensureObject, optionalString } from "@/lib/validation";
import { runComplianceAlerts } from "@/lib/jobs/compliance-alerts";

export default createApiHandler(async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) throw unauthorized();
  if (session.user.role !== "ADMIN") throw forbidden();

  const body = ensureObject(req.body || {});
  const centerId = optionalString(body, "centerId", { nullable: true }) || null;
  const result = await runComplianceAlerts({
    centerId,
    initiatedBy: session.user.email || session.user.id,
  });

  return res.status(result.created > 0 ? 201 : 200).json(result);
}, { methods: ["POST"], logLabel: "compliance/run-alerts error:" });
