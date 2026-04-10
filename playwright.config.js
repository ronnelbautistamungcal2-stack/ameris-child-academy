const { defineConfig } = require("@playwright/test");

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";
const basePort = Number(new URL(baseURL).port || "3000");
const webServerCommand =
  process.env.PLAYWRIGHT_WEB_SERVER_COMMAND || "npm run dev";

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 30000,
  retries: 0,
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
