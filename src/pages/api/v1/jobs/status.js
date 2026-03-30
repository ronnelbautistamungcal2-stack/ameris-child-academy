import { getSession } from "@/lib/auth";
import { createApiHandler, forbidden, unauthorized } from "@/lib/api-error";
import { getJobStatus } from "@/lib/jobs";

export default createApiHandler(async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session) throw unauthorized();
  if (session.user.role !== "ADMIN") throw forbidden();

  return res.status(200).json({
    jobs: getJobStatus(),
    enabled: process.env.SCHEDULED_JOBS_ENABLED !== "false",
  });
}, { methods: ["GET"], logLabel: "jobs/status error:" });
