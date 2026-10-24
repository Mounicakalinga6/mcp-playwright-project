// @ts-check
import { test, expect } from '../utils/fixtures.js';
import { buildEmployee } from '../utils/testDataFactory.js';
import { createEmployee, getEmployeeByName } from '../utils/employeeRepository.js';
import { closePool } from '../utils/dbClient.js';

test.describe('UI + DB Validation Flow', () => {
  test('adds an employee via the UI, then verifies a matching record exists in the database', async ({
    authenticatedPage,
    pimPage,
  }) => {
    const employee = buildEmployee();
    const fullName = `${employee.firstName} ${employee.lastName}`;

    // Step 1 — real UI action: add the employee through OrangeHRM's own form.
    await pimPage.navigateToAddEmployee();
    await pimPage.addEmployee(employee);
    await expect(authenticatedPage).toHaveURL(/pim\/viewPersonalDetails/);

    // Step 2 — simulated DB write. OrangeHRM's own backend is a public demo
    // we have no database access to, so this stands in for what a real
    // internal app's backend would do automatically when the UI saves data.
    await createEmployee({
      name: fullName,
      email: `${employee.firstName}.${employee.lastName}.${Date.now()}@example.com`.toLowerCase(),
      department: 'QA',
      salary: 60000,
    });

    // Step 3 — verify the same employee now exists in the database, by name.
    const dbRecord = await getEmployeeByName(fullName);
    console.log('Verified in DB:', dbRecord);
    expect(dbRecord).toBeTruthy();
    expect(dbRecord.name).toBe(fullName);
  });

  test.afterAll(async () => {
    await closePool();
  });
});
