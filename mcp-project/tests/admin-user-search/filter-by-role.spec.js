// @ts-check
// spec: specs/admin-user-search.plan.md
// seed: tests/seed.spec.js
import { test, expect } from '@playwright/test';

test.describe('System Users search and filter', () => {
  test('Filter by User Role Admin shows only Admin-role rows', async ({ page }) => {
    // 1. Navigate to the System Users page.
    await page.goto('/web/index.php/admin/viewSystemUsers');
    await expect(page.getByRole('heading', { name: 'System Users' })).toBeVisible();

    // 2. Click the User Role select, then choose the option 'Admin'.
    const roleSelect = page.locator('.oxd-input-group:has-text("User Role") .oxd-select-text');
    await roleSelect.click();
    await page.getByRole('option', { name: 'Admin' }).click();
    await expect(roleSelect).toHaveText('Admin');

    // 3. Click 'Search'.
    await page.getByRole('button', { name: 'Search' }).click();
    const rows = page.locator('.oxd-table-body .oxd-table-row');
    await expect(rows.first()).toBeVisible();
    await expect(rows.filter({ has: page.getByRole('cell', { name: 'ESS', exact: true }) })).toHaveCount(0);
    const count = await rows.count();
    for (let i = 0; i < count; i++) {
      await expect(rows.nth(i).getByRole('cell').nth(2)).toHaveText('Admin');
    }
  });
});
