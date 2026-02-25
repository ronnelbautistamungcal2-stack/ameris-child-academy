const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: "http://localhost:3000",
    extraHTTPHeaders: {
      "Content-Type": "application/json",
    },
  },
  webServer: {
    command: "npm run dev",
    port: 3000,
    reuseExistingServer: true,
    timeout: 60000,
  },
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
