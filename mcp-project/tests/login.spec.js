// @ts-check
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage.js';
import { DashboardPage } from '../pages/DashboardPage.js';
import { config } from '../utils/env.js';
import users from '../test-data/users.json' with { type: 'json' };

test.describe('OrangeHRM Login', () => {
  // The rest of the suite reuses a saved logged-in session (see
  // config/global-setup.js), but login itself needs to start from a clean,
  // unauthenticated browser — otherwise we'd already be on the Dashboard.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('logs in successfully with valid credentials', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);

    await loginPage.open();
    await loginPage.login(config.adminUsername, config.adminPassword);

    await expect(page).toHaveURL(/dashboard\/index/);
    expect(await dashboardPage.getPageHeading()).toBe('Dashboard');
  });

  for (const invalidUser of users.invalidUsers) {
    test(`rejects login for "${invalidUser.username || '(empty)'}" / "${invalidUser.password || '(empty)'}"`, async ({ page }) => {
      const loginPage = new LoginPage(page);

      await loginPage.open();
      await loginPage.login(invalidUser.username, invalidUser.password);

      if (invalidUser.username && invalidUser.password) {
        expect(await loginPage.getErrorMessage()).toContain(invalidUser.expectedError);
      } else {
        await expect(page.getByText('Required').first()).toBeVisible();
      }
    });
  }

  test('logs out back to the login page', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);

    await loginPage.open();
    await loginPage.login(config.adminUsername, config.adminPassword);
    await dashboardPage.isLoaded();

    await dashboardPage.logout();

    await expect(page).toHaveURL(/auth\/login/);
  });
});
