// @ts-check
import { defineConfig } from '@playwright/test';

// Local-only specs: no OrangeHRM global setup, no saved session, no baseURL.
// This config deliberately skips the OrangeHRM session guard, so only list
// reviewed specs that never touch the website or need a login.
export default defineConfig({
  workers: 1,
  timeout: 30_000,
  projects: [
    // Read-only queries against the local practice Postgres.
    { name: 'db-only', testDir: './tests', testMatch: ['db-read.spec.js'] },
    // Intentional-failure self-check: inline HTML only, no network or DB.
    // Its own folder keeps it out of playwright.config.js runs.
    {
      name: 'selfcheck',
      testDir: './tests-selfcheck',
      testMatch: ['qa-selfcheck-failure.spec.js'],
      use: { screenshot: 'only-on-failure' },
    },
  ],
});
