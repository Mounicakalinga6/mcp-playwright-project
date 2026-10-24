// @ts-check
import { test, expect } from '../utils/fixtures.js';
import { buildEmployee, buildSystemUser } from '../utils/testDataFactory.js';

test.describe('Admin - Add System User', () => {
  test('creates a new ESS user linked to a freshly added employee', async ({
    authenticatedPage,
    pimPage,
    adminUserPage,
  }) => {
    const employee = buildEmployee();
    await pimPage.navigateToAddEmployee();
    await pimPage.addEmployee(employee);
    await expect(authenticatedPage).toHaveURL(/pim\/viewPersonalDetails/);

    const employeeFullName = `${employee.firstName} ${employee.lastName}`;
    const user = buildSystemUser(employeeFullName);

    await adminUserPage.navigateToAddUser();
    await adminUserPage.addUser(user);

    await expect(authenticatedPage).toHaveURL(/admin\/viewSystemUsers/);
    await adminUserPage.searchByUsername(user.username);
    await expect(adminUserPage.resultRows.first()).toContainText(user.username);
  });
});
