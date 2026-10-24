// @ts-check
import { test, expect } from '../utils/fixtures.js';
import { buildEmployee } from '../utils/testDataFactory.js';

test.describe('PIM - Add Employee', () => {
  test('adds a new employee and generates an employee ID', async ({ authenticatedPage, pimPage }) => {
    const employee = buildEmployee();

    await pimPage.navigateToAddEmployee();
    await pimPage.addEmployee(employee);

    await expect(authenticatedPage).toHaveURL(/pim\/viewPersonalDetails/);
    const employeeId = await pimPage.getGeneratedEmployeeId();
    expect(employeeId).not.toBe('');
  });

  test('finds a previously added employee via search', async ({ authenticatedPage, pimPage }) => {
    const employee = buildEmployee();

    await pimPage.navigateToAddEmployee();
    await pimPage.addEmployee(employee);
    await expect(authenticatedPage).toHaveURL(/pim\/viewPersonalDetails/);

    await pimPage.searchEmployeeByName(`${employee.firstName} ${employee.lastName}`);

    await expect(pimPage.employeeListRows.first()).toContainText(employee.firstName);
  });
});
