// The same suite against a real Postgres (the setup on your own server), instead
// of the file-based dev backend. Starts a throwaway local Postgres, migrates it,
// builds into its own folder and serves on its own port.
//   npm run e2e:postgres
import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

process.env.E2E_BACKEND = "postgres"; // read by e2e/fixtures.ts, in every worker

const PORT = 3101;
const PG = "127.0.0.1:54330/dawr";

export default defineConfig({
  ...base,
  // Async password hashing: the server no longer queues sign-ups behind each other.
  timeout: 45_000,
  use: { ...base.use, baseURL: `http://localhost:${PORT}` },
  webServer: [
    {
      command: "node scripts/local-postgres.mjs --e2e",
      port: 54330,
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      command: `node e2e/reset-data.mjs --postgres && npm run build && npm run start -- --port ${PORT}`,
      url: `http://localhost:${PORT}/signin`,
      timeout: 300_000,
      reuseExistingServer: false,
      env: {
        NEXT_DIST_DIR: ".next-e2e-pg",
        DATABASE_URL: `postgres://dawr_app:local-app@${PG}`,
        MIGRATE_DATABASE_URL: `postgres://dawr_owner:local-owner@${PG}`,
        DAWR_MAIL_DIR: ".mail-e2e",
        SITE_URL: `http://localhost:${PORT}`,
        CRON_SECRET: "e2e-cron-secret",
        // Never real email or Supabase from a test run.
        RESEND_API_KEY: "",
        EMAIL_FROM: "",
        SUPABASE_URL: "",
        SUPABASE_ANON_KEY: "",
        SUPABASE_SERVICE_ROLE_KEY: "",
        DAWR_ALLOW_FAKE_BACKEND: "",
      },
    },
  ],
});
