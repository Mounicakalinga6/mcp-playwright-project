// @ts-check
import { defineConfig } from '@playwright/test';

// Local-only specs: no OrangeHRM global setup, no saved session, no baseURL.
// Only list specs that never touch the website or need a login.
export default defineConfig({
  workers: 1,
  timeout: 30_000,
  projects: [
    // Read-only queries against the local practice Postgres.
    { name: 'db-only', testDir: './tests', testMatch: ['db-read.spec.js'] },
  ],
});
