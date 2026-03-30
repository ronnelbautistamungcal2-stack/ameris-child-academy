import { getSession } from "@/lib/auth";
import { createApiHandler, forbidden, unauthorized } from "@/lib/api-error";
import { ensureObject, requiredString } from "@/lib/validation";
import { runNamedJob } from "@/lib/jobs";

export default createApiHandler(async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) throw unauthorized();
  if (session.user.role !== "ADMIN") throw forbidden();

  const body = ensureObject(req.body || {});
  const job = requiredString(body, "job");
  const result = await runNamedJob(job);

  return res.status(200).json({
    ok: true,
    job,
    result,
  });
}, { methods: ["POST"], logLabel: "jobs/run error:" });
