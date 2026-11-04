// @ts-check
// spec: specs/admin-user-search.plan.md
// seed: tests/seed.spec.js
import { test, expect } from '@playwright/test';

test.describe('System Users search and filter', () => {
  test('Search by username Admin returns the built-in Admin user', async ({ page }) => {
    // 1. Navigate to /web/index.php/admin/viewSystemUsers and wait for the 'System Users' heading.
    await page.goto('/web/index.php/admin/viewSystemUsers');
    await expect(page.getByRole('heading', { name: 'System Users' })).toBeVisible();

    // 2. Type 'Admin' into the Username textbox.
    const username = page.locator('.oxd-input-group:has-text("Username") input');
    await username.fill('Admin');
    await expect(username).toHaveValue('Admin');

    // 3. Click the 'Search' button.
    await page.getByRole('button', { name: 'Search' }).click();
    const rows = page.locator('.oxd-table-body .oxd-table-row');
    await expect(rows.first()).toBeVisible();
    const adminRow = rows.filter({
      has: page.getByRole('cell', { name: 'Admin', exact: true }),
    }).first();
    await expect(adminRow.getByRole('cell').nth(1)).toHaveText('Admin');
    await expect(adminRow.getByRole('cell').nth(2)).toHaveText('Admin');
  });
});
