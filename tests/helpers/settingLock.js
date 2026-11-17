// A lock shared by every Playwright worker, for test files that change the
// same global setting (e.g. the "agreements" GlobalSetting, changed by both
// enrollment and global-admin-pages). Hold it from the hook that saves the
// setting until the hook that restores it, so the files take turns instead of
// overwriting each other's agreements when they run in parallel.
const fs = require("fs");
const os = require("os");
const path = require("path");

const WAIT_MS = 240000; // longest a file waits for the other one
const STALE_MS = 600000; // a lock older than this was left by a crashed run

/** Waits for the named lock and takes it. Returns a function that releases it. */
async function acquireSettingLock(name) {
  const file = path.join(os.tmpdir(), `ameris-test-lock-${name}`);
  const started = Date.now();
  for (;;) {
    try {
      fs.writeFileSync(file, String(process.pid), { flag: "wx" });
      return () => {
        try {
          fs.unlinkSync(file);
        } catch {}
      };
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
      try {
        if (Date.now() - fs.statSync(file).mtimeMs > STALE_MS) fs.unlinkSync(file);
      } catch {}
      if (Date.now() - started > WAIT_MS) throw new Error(`Timed out waiting for the "${name}" test lock (${file})`);
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
}

module.exports = { acquireSettingLock, SETTING_LOCK_WAIT_MS: WAIT_MS };
