import { runComplianceAlerts } from "@/lib/jobs/compliance-alerts";
import { runFormRenewalCheck } from "@/lib/jobs/form-renewals";

const jobState = new Map();
const runningTimers = [];

function recordJobStart(name) {
  const previous = jobState.get(name) || {};
  jobState.set(name, {
    ...previous,
    name,
    running: true,
    lastStartedAt: new Date().toISOString(),
    lastStatus: previous.lastStatus || "idle",
  });
}

function recordJobFinish(name, status, result) {
  const previous = jobState.get(name) || {};
  jobState.set(name, {
    ...previous,
    name,
    running: false,
    lastFinishedAt: new Date().toISOString(),
    lastStatus: status,
    lastResult: result || null,
  });
}

export const JOB_DEFINITIONS = [
  {
    name: "form-renewals",
    intervalMs: Number(process.env.FORM_RENEWAL_JOB_INTERVAL_MS || 12 * 60 * 60 * 1000),
    run: () => runFormRenewalCheck({ initiatedBy: "scheduler" }),
  },
  {
    name: "compliance-alerts",
    intervalMs: Number(process.env.COMPLIANCE_JOB_INTERVAL_MS || 6 * 60 * 60 * 1000),
    run: () => runComplianceAlerts({ initiatedBy: "scheduler" }),
  },
];

export async function runNamedJob(name) {
  const job = JOB_DEFINITIONS.find((entry) => entry.name === name);
  if (!job) {
    throw new Error(`Unknown job: ${name}`);
  }

  recordJobStart(name);
  try {
    const result = await job.run();
    recordJobFinish(name, "success", result);
    return result;
  } catch (error) {
    recordJobFinish(name, "error", { message: error?.message || "Job failed" });
    throw error;
  }
}

export function getJobStatus() {
  return JOB_DEFINITIONS.map((job) => ({
    name: job.name,
    intervalMs: job.intervalMs,
    ...(jobState.get(job.name) || {
      running: false,
      lastStatus: "idle",
      lastStartedAt: null,
      lastFinishedAt: null,
      lastResult: null,
    }),
  }));
}

export function startScheduledJobs() {
  if (process.env.SCHEDULED_JOBS_ENABLED === "false") {
    return [];
  }

  if (runningTimers.length) {
    return runningTimers;
  }

  for (const job of JOB_DEFINITIONS) {
    const timer = setInterval(() => {
      runNamedJob(job.name).catch((error) => {
        console.error(`[jobs] ${job.name} failed:`, error);
      });
    }, Math.max(60_000, job.intervalMs));

    if (typeof timer.unref === "function") {
      timer.unref();
    }

    runningTimers.push(timer);
  }

  return runningTimers;
}
