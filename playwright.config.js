const { defineConfig } = require("@playwright/test");

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";
const basePort = Number(new URL(baseURL).port || "3000");
const webServerCommand =
  process.env.PLAYWRIGHT_WEB_SERVER_COMMAND || "npm run dev";

module.exports = defineConfig({
  testDir: "./tests",
  // Routes are precompiled by globalSetup, but a cold dev server still makes the
  // first hit on a heavy page slower than a warm one, so leave some headroom.
  timeout: 60000,
  // The e2e specs share one dev server across workers, so a page can take well
  // over the 5s default to render its data. That default was the single largest
  // source of flaky "element(s) not found" failures.
  expect: { timeout: 15000 },
  retries: 0,
  globalSetup: require.resolve("./tests/helpers/global-setup.js"),
  use: {
    baseURL,
  },
  ...(webServerCommand === "off"
    ? {}
    : {
        webServer: {
          command: webServerCommand,
          port: basePort,
          reuseExistingServer: true,
          timeout: 60000,
        },
      }),
  projects: [
    {
      name: "api",
      testMatch: /.*\.api\.spec\.js/,
    },
    {
      name: "e2e",
      testMatch: /.*\.e2e\.spec\.js/,
      use: { browserName: "chromium" },
    },
  ],
});
