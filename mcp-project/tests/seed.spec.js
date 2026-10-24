// @ts-check
import { test } from '@playwright/test';
import { DashboardPage } from '../pages/DashboardPage.js';

// Starting point for the Playwright Test Agents (planner / generator): they
// run this test to get a page that's already logged in (via the saved
// session from config/global-setup.js), then explore from the Dashboard.
// Also doubles as a smoke test that the saved session is still valid.
test.describe('Seed', () => {
  test('starts logged in on the Dashboard', async ({ page }) => {
    await page.goto('/web/index.php/dashboard/index');
    await new DashboardPage(page).isLoaded();
  });
});
