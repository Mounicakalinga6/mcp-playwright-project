// @ts-check
import { test, expect } from '@playwright/test';
import { createEmployee, getEmployeeById } from '../utils/employeeRepository.js';
import { closePool } from '../utils/dbClient.js';

test.describe('Database - Create Employee', () => {
  test('creates a new employee and verifies it exists', async () => {
    const newEmployee = {
      name: 'Test User',
      // Timestamped so re-running this test never collides with a
      // previous run's row.
      email: `test.user.${Date.now()}@example.com`,
      department: 'QA',
      salary: 60000,
    };

    const created = await createEmployee(newEmployee);
    console.log('Created employee:', created);

    expect(created.id).toBeTruthy();
    expect(created.name).toBe(newEmployee.name);
    expect(created.email).toBe(newEmployee.email);

    // Read it back separately, proving it actually persisted in Postgres —
    // not just that INSERT returned something in memory.
    const fetched = await getEmployeeById(created.id);
    expect(fetched.name).toBe(newEmployee.name);
  });

  test.afterAll(async () => {
    await closePool();
  });
});
