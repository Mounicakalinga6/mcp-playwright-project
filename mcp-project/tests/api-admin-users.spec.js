// @ts-check
import { test, expect } from '@playwright/test';
import { config } from '../utils/env.js';
import { adminUserSchema, listSchema, singleSchema, notFoundErrorSchema, allKeys } from '../utils/apiSchemas.js';

// Read-only GET scenarios for the Admin > System Users API. Expected status
// codes and shapes come from real responses observed first.
// Never prints user data: the shared demo contains names other people typed in.

const USERS = '/web/index.php/api/v2/admin/users';
const USERS_LIST = `${USERS}?limit=50&offset=0&sortField=u.userName&sortOrder=ASC`;
const userList = listSchema(adminUserSchema);

test.describe('Admin Users API', () => {
  test('list matches the response contract (schema)', async ({ request }) => {
    const response = await request.get(USERS_LIST);
    expect(response.status()).toBe(200);
    const body = userList.parse(await response.json());
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data.length).toBeLessThanOrEqual(50); // limit=50
    expect(body.meta.total).toBeGreaterThanOrEqual(body.data.length);
    console.log(`Admin API returned ${body.data.length} users out of ${body.meta.total} total`);
  });

  test('get one user by id', async ({ request }) => {
    const list = userList.parse(await (await request.get(USERS_LIST)).json());
    const { id } = list.data[0];

    const response = await request.get(`${USERS}/${id}`);
    expect(response.status()).toBe(200);
    const body = singleSchema(adminUserSchema).parse(await response.json());
    expect(body.data.id).toBe(id);
  });

  test('unknown user id returns 404 Record Not Found', async ({ request }) => {
    const response = await request.get(`${USERS}/999999999`);
    expect(response.status()).toBe(404);
    notFoundErrorSchema.parse(await response.json());
  });

  test('no password field is exposed in list or single responses', async ({ request }) => {
    const listBody = await (await request.get(USERS_LIST)).json();
    const firstId = listBody.data[0].id;
    const singleBody = await (await request.get(`${USERS}/${firstId}`)).json();

    for (const body of [listBody, singleBody]) {
      const keys = allKeys(body);
      expect([...keys].filter((k) => k.includes('password'))).toEqual([]);
    }
  });

  test('unauthorized request is rejected with 401', async ({ playwright }) => {
    const anonymous = await playwright.request.newContext({
      baseURL: config.baseUrl,
      storageState: { cookies: [], origins: [] }, // genuinely no session
    });
    const response = await anonymous.get(USERS_LIST);
    expect(response.status()).toBe(401);
    await anonymous.dispose();
  });
});
