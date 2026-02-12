import fs from "fs/promises";
import path from "path";

const projectRoot = process.cwd();
const targets = [".next-build", ".next"].map((p) => path.join(projectRoot, p));

function isRetriable(err) {
  const code = err?.code;
  return code === "EPERM" || code === "EBUSY" || code === "ENOTEMPTY";
}

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function exists(p) {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

async function safeRemove(targetPath) {
  if (!(await exists(targetPath))) return { removed: false };

  const maxAttempts = 6;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await fs.rm(targetPath, { recursive: true, force: true });
      return { removed: true };
    } catch (err) {
      if (!isRetriable(err) || attempt === maxAttempts) {
        break;
      }
      await sleep(150 * attempt);
    }
  }

  const renamed = `${targetPath}.old-${Date.now()}`;
  try {
    await fs.rename(targetPath, renamed);
    return { removed: false, renamedTo: renamed };
  } catch (err) {
    return { removed: false, error: err };
  }
}

const results = [];
for (const t of targets) {
  // eslint-disable-next-line no-await-in-loop
  results.push({ target: t, ...(await safeRemove(t)) });
}

for (const r of results) {
  const name = path.basename(r.target);
  if (r.removed) {
    console.log(`[clean] removed ${name}`);
  } else if (r.renamedTo) {
    console.log(`[clean] renamed ${name} -> ${path.basename(r.renamedTo)}`);
  } else if (r.error) {
    console.warn(
      `[clean] could not remove ${name}: ${r.error.code || ""} ${r.error.message || r.error}`,
    );
  }
}

