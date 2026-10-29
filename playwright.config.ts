import { defineConfig, devices } from "@playwright/test";
const external = Boolean(process.env.PLAYWRIGHT_BASE_URL);
export default defineConfig({
  testDir: "./tests/e2e", timeout: 30_000, fullyParallel: true,
  use: { baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:5173", trace: "retain-on-failure" },
  webServer: external ? undefined : { command: "npm run dev", url: "http://127.0.0.1:5173", reuseExistingServer: true, timeout: 120_000 },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
