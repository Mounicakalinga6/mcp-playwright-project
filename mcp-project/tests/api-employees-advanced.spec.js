// @ts-check
import { test, expect } from '@playwright/test';
import { config } from '../utils/env.js';
import { employeeSchema, listSchema, singleSchema, invalidParamErrorSchema } from '../utils/apiSchemas.js';

// Read-only GET scenarios for the PIM employees API. Expected status codes
// and shapes come from real responses observed first, not guesses.
// The `request` fixture uses the saved session (storageState) and baseURL
// from playwright.config.js, without opening a browser.

const EMPLOYEES = '/web/index.php/api/v2/pim/employees';
const employeeList = listSchema(employeeSchema);

test.describe('Employees API: contract, paging, sorting, filtering', () => {
  test('list matches the response contract (schema)', async ({ request }) => {
    const response = await request.get(`${EMPLOYEES}?limit=50&offset=0`);
    expect(response.status()).toBe(200);
    const body = employeeList.parse(await response.json());
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.meta.total).toBeGreaterThanOrEqual(body.data.length);
  });

  test('pagination: limit is respected and pages do not overlap', async ({ request }) => {
    const page1 = employeeList.parse(await (await request.get(`${EMPLOYEES}?limit=5&offset=0`)).json());
    const page2 = employeeList.parse(await (await request.get(`${EMPLOYEES}?limit=5&offset=5`)).json());

    expect(page1.data.length).toBeLessThanOrEqual(5);
    expect(page2.data.length).toBeLessThanOrEqual(5);
    // Shared demo: someone could add/remove an employee between the two
    // calls, so this checks overlap by id rather than exact positions.
    const page1Ids = page1.data.map((e) => e.empNumber);
    const overlap = page2.data.filter((e) => page1Ids.includes(e.empNumber));
    expect(overlap).toHaveLength(0);
  });

  test('sorting: ASC and DESC order by first name', async ({ request }) => {
    const firstNames = async (/** @type {string} */ order) =>
      employeeList
        .parse(await (await request.get(`${EMPLOYEES}?limit=20&offset=0&sortField=employee.firstName&sortOrder=${order}`)).json())
        .data.map((e) => e.firstName);

    const asc = await firstNames('ASC');
    const desc = await firstNames('DESC');
    const compare = (/** @type {string} */ a, /** @type {string} */ b) => a.localeCompare(b, 'en', { sensitivity: 'base' });

    for (let i = 1; i < asc.length; i++) expect(compare(asc[i - 1], asc[i])).toBeLessThanOrEqual(0);
    for (let i = 1; i < desc.length; i++) expect(compare(desc[i - 1], desc[i])).toBeGreaterThanOrEqual(0);
    expect(asc[0]).not.toBe(desc[0]);
  });

  test('filtering: nameOrId returns only matching employees', async ({ request }) => {
    const list = employeeList.parse(await (await request.get(`${EMPLOYEES}?limit=50&offset=0`)).json());
    const sample = list.data.find((e) => e.firstName.trim().length >= 2);
    test.skip(!sample, 'No employee with a usable first name in the first page');
    const term = /** @type {NonNullable<typeof sample>} */ (sample).firstName.trim();

    const result = employeeList.parse(
      await (await request.get(`${EMPLOYEES}?limit=50&offset=0&nameOrId=${encodeURIComponent(term)}`)).json()
    );
    expect(result.data.length).toBeGreaterThan(0);
    for (const e of result.data) {
      const searchable = [e.firstName, e.middleName, e.lastName, e.employeeId].join(' ').toLowerCase();
      expect(searchable).toContain(term.toLowerCase());
    }
  });

  test('filtering: a term that matches nothing returns an empty list', async ({ request }) => {
    const response = await request.get(`${EMPLOYEES}?limit=50&offset=0&nameOrId=zzqxqzz_nomatch`);
    expect(response.status()).toBe(200);
    const body = employeeList.parse(await response.json());
    expect(body.data).toHaveLength(0);
    expect(body.meta.total).toBe(0);
  });
});

test.describe('Employees API: single record and errors', () => {
  test('get one employee by empNumber', async ({ request }) => {
    const list = employeeList.parse(await (await request.get(`${EMPLOYEES}?limit=1&offset=0`)).json());
    const { empNumber } = list.data[0];

    const response = await request.get(`${EMPLOYEES}/${empNumber}`);
    expect(response.status()).toBe(200);
    const body = singleSchema(employeeSchema).parse(await response.json());
    expect(body.data.empNumber).toBe(empNumber);
  });

  test('unknown employee id returns 422 Invalid Parameter (observed: not 404)', async ({ request }) => {
    const response = await request.get(`${EMPLOYEES}/999999999`);
    expect(response.status()).toBe(422);
    const body = invalidParamErrorSchema.parse(await response.json());
    expect(body.error.data.invalidParamKeys).toEqual(['empNumber']);
  });

  for (const [param, value] of /** @type {const} */ ([
    ['limit', '-1'],
    ['limit', 'abc'],
    ['offset', '-5'],
    ['sortField', 'bogusField'],
    ['sortOrder', 'SIDEWAYS'],
  ])) {
    test(`invalid query param ${param}=${value} returns 422 naming that param`, async ({ request }) => {
      const response = await request.get(`${EMPLOYEES}?${param}=${value}`);
      expect(response.status()).toBe(422);
      expect(response.headers()['content-type']).toContain('application/json');
      const body = invalidParamErrorSchema.parse(await response.json());
      expect(body.error.data.invalidParamKeys).toContain(param);
    });
  }
});

test.describe('Employees API: auth, headers, timing', () => {
  test('a fake session cookie is rejected with 401', async ({ playwright }) => {
    const fake = await playwright.request.newContext({
      baseURL: config.baseUrl,
      storageState: { cookies: [], origins: [] }, // don't inherit the real saved session
      extraHTTPHeaders: { Cookie: 'orangehrm=thisisnotarealsession123' },
    });
    const response = await fake.get(`${EMPLOYEES}?limit=1`);
    expect(response.status()).toBe(401);
    await fake.dispose();
  });

  test('responds with JSON within a reasonable time', async ({ request }) => {
    const started = Date.now();
    const response = await request.get(`${EMPLOYEES}?limit=5&offset=0`);
    const elapsedMs = Date.now() - started;

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');
    // Loose on purpose: this is a slow, shared public demo. A real target
    // app would get a tighter budget agreed with the team.
    expect(elapsedMs).toBeLessThan(5000);
  });
});
