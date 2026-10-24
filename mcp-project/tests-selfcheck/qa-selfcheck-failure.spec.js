// @ts-check
import { test, expect } from '@playwright/test';

// INTENTIONAL-FAILURE SELF-CHECK for the QA agent's failure reporting.
// Uses a tiny inline page only: no website, no login, no database.
// The second assertion is meant to fail; that failure is the expected result.
test.describe('QA self-check (intentional failure)', () => {
  test('reports a deliberate assertion failure with evidence', async ({ page }) => {
    await page.setContent('<h1 id="title">Self-check page</h1>');

    // Sanity check: proves the page rendered.
    await expect(page.locator('#title')).toHaveText('Self-check page');

    // Deliberate failure.
    await expect(
      page.locator('#title'),
      'INTENTIONAL FAILURE: verifies agent failure reporting'
    ).toHaveText('This text is deliberately wrong', { timeout: 2000 });
  });
});
