// @ts-check
// spec: specs/admin-user-search.plan.md
// seed: tests/seed.spec.js
import { test, expect } from '@playwright/test';

test.describe('System Users search and filter', () => {
  test('Search for a non-existent username shows No Records Found', async ({ page }) => {
    // 1. Navigate to the System Users page.
    await page.goto('/web/index.php/admin/viewSystemUsers');
    await expect(page.getByRole('heading', { name: 'System Users' })).toBeVisible();

    // 2. Type 'zzqx_no_such_user' into the Username textbox and click 'Search'.
    await page.locator('.oxd-input-group:has-text("Username") input').fill('zzqx_no_such_user');
    await page.getByRole('button', { name: 'Search' }).click();

    // Inline record-count area shows 'No Records Found' (not the transient toast).
    await expect(
      page.locator('.orangehrm-horizontal-padding span').filter({ hasText: 'No Records Found' })
    ).toBeVisible();
    await expect(page.locator('.oxd-table-body .oxd-table-row')).toHaveCount(0);
  });
});
