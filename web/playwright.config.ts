import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

// The suite runs against a production build on its own port, data folder and build
// folder, so it never touches `npm run dev` or your dev data in .data/.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  workers: 4,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  // The dev backend hashes passwords synchronously in one process, so 4 workers
  // signing up at once queue behind each other. Generous, not flaky.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    timezoneId: "Asia/Karachi",
    locale: "en-GB",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }, grepInvert: /@crowd/ },
    { name: "mobile", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } }, testMatch: /a11y|f03|f04/, grepInvert: /@crowd/ },
    // Rate-limit tests fire dozens of sign-ups; run them alone so they don't starve the rest.
    { name: "crowd", use: { ...devices["Desktop Chrome"] }, grep: /@crowd/, dependencies: ["desktop", "mobile"] },
  ],
  webServer: {
    command: `node e2e/reset-data.mjs && npm run build && npm run start -- --port ${PORT}`,
    url: `http://localhost:${PORT}/signin`,
    timeout: 240_000,
    reuseExistingServer: false,
    env: {
      DAWR_DATA_DIR: ".data-e2e",
      NEXT_DIST_DIR: ".next-e2e",
      DAWR_ALLOW_FAKE_BACKEND: "1",
      // Make sure a filled-in .env.local can never point the suite at real Supabase.
      SUPABASE_URL: "",
      SUPABASE_ANON_KEY: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
    },
  },
});
