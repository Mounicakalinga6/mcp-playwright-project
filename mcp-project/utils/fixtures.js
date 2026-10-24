// @ts-check
import { test as base } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage.js';
import { DashboardPage } from '../pages/DashboardPage.js';
import { PimPage } from '../pages/PimPage.js';
import { AdminUserPage } from '../pages/AdminUserPage.js';

/**
 * @typedef {Object} CustomFixtures
 * @property {LoginPage} loginPage
 * @property {DashboardPage} dashboardPage
 * @property {PimPage} pimPage
 * @property {AdminUserPage} adminUserPage
 * @property {import('@playwright/test').Page} authenticatedPage
 */

/**
 * Extends the base Playwright test with page objects. `authenticatedPage`
 * is just `page` itself — every test already starts logged in via the
 * storageState global-setup saved, so there's nothing left to do here.
 * @type {import('@playwright/test').TestType<
 *   import('@playwright/test').PlaywrightTestArgs & import('@playwright/test').PlaywrightTestOptions & CustomFixtures,
 *   import('@playwright/test').PlaywrightWorkerArgs & import('@playwright/test').PlaywrightWorkerOptions
 * >}
 */
export const test = base.extend({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },
  pimPage: async ({ page }, use) => {
    await use(new PimPage(page));
  },
  adminUserPage: async ({ page }, use) => {
    await use(new AdminUserPage(page));
  },
  authenticatedPage: async ({ page }, use) => {
    await use(page);
  },
});

export { expect } from '@playwright/test';
