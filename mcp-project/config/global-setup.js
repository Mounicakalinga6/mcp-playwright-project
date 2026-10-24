// @ts-check
import fs from 'fs';
import { chromium } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage.js';
import { config } from '../utils/env.js';
import { logInfo } from '../utils/logger.js';

export const AUTH_FILE = 'playwright/.auth/admin.json';

// How long a saved session is trusted before global-setup bothers logging in
// again. OrangeHRM's own session cookie outlives this easily, so this is a
// conservative safety margin, not a measurement of the real cookie expiry.
const SESSION_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

function isSavedSessionFresh() {
  if (!fs.existsSync(AUTH_FILE)) {
    return false;
  }
  const ageMs = Date.now() - fs.statSync(AUTH_FILE).mtimeMs;
  return ageMs < SESSION_MAX_AGE_MS;
}

/**
 * Logs in once, before any test runs, and saves the authenticated session
 * (cookies) to disk. Every spec then starts already logged in via
 * `storageState`, instead of each test repeating the login flow itself.
 *
 * If a recent saved session already exists, skip logging in again — set
 * GLOBAL_SETUP_FORCE_REFRESH=1 to force a fresh login regardless.
 */
export default async function globalSetup() {
  // Set by the read-only QA agent: it must never log in or overwrite the
  // saved session itself. Takes precedence over GLOBAL_SETUP_FORCE_REFRESH.
  if (process.env.GLOBAL_SETUP_NO_REFRESH) {
    if (isSavedSessionFresh()) {
      logInfo(`Reusing saved session from ${AUTH_FILE} (no-refresh mode)`);
      return;
    }
    throw new Error(
      'Saved OrangeHRM session is missing or stale. Ask the user to run `npm run auth:refresh` manually.'
    );
  }

  if (!process.env.GLOBAL_SETUP_FORCE_REFRESH && isSavedSessionFresh()) {
    logInfo(`Reusing saved session from ${AUTH_FILE} (still fresh, skipping login)`);
    return;
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL: config.baseUrl });

  const loginPage = new LoginPage(page);
  await loginPage.open();
  await loginPage.login(config.adminUsername, config.adminPassword);
  await page.waitForURL(/dashboard\/index/);

  await page.context().storageState({ path: AUTH_FILE });
  logInfo(`Saved authenticated session to ${AUTH_FILE}`);

  await browser.close();
}
