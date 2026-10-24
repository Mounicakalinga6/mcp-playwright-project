// @ts-check
import { test, expect } from '../utils/fixtures.js';

test.describe('OrangeHRM Employees API', () => {
  test('GET employees returns 200 with a valid employee list', async ({ authenticatedPage }) => {
    // authenticatedPage.request shares cookies with the already-logged-in
    // browser context (via storageState) — no separate API login needed.
    const response = await authenticatedPage.request.get(
      '/web/index.php/api/v2/pim/employees?limit=50&offset=0&model=detailed&includeEmployees=onlyCurrent&sortField=employee.firstName&sortOrder=ASC'
    );

    expect(response.status()).toBe(200);

    const body = await response.json();

    // Confirmed real shape from the actual response: { data: [...], meta: { total }, rels: [] }
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(typeof body.meta.total).toBe('number');
    expect(body.meta.total).toBeGreaterThan(0);

    console.log(`API returned ${body.data.length} employees out of ${body.meta.total} total`);
  });

  test('unauthorized request is rejected', async ({ playwright }) => {
    // A brand-new request context, deliberately with no storageState —
    // simulates someone who never logged in trying to hit the same endpoint.
    // storageState must be overridden explicitly here: playwright.config.js
    // sets a global storageState for the whole project, and without this
    // override, even a "new" context here silently inherits our saved admin
    // session instead of being genuinely anonymous.
    const anonymousContext = await playwright.request.newContext({
      baseURL: 'https://opensource-demo.orangehrmlive.com',
      storageState: { cookies: [], origins: [] },
    });

    // Prove this context genuinely holds no cookies, before drawing any
    // conclusion from what the API does with it.
    const state = await anonymousContext.storageState();
    console.log('Anonymous context cookies:', JSON.stringify(state.cookies));

    const response = await anonymousContext.get(
      '/web/index.php/api/v2/pim/employees?limit=50&offset=0'
    );

    // Confirmed real behavior: a clean 401 Unauthorized, no redirect at all.
    expect(response.status()).toBe(401);

    await anonymousContext.dispose();
  });
});
