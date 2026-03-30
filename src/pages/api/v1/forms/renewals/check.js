import { getSession } from "@/lib/auth";
import { createApiHandler, forbidden, unauthorized } from "@/lib/api-error";
import { runFormRenewalCheck } from "@/lib/jobs/form-renewals";

export default createApiHandler(async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) throw unauthorized();
  if (session.user.role !== "ADMIN") throw forbidden();

  const result = await runFormRenewalCheck({
    initiatedBy: session.user.email || session.user.id,
  });

  return res.status(200).json(result);
}, { methods: ["POST"], logLabel: "forms/renewals/check error:" });
