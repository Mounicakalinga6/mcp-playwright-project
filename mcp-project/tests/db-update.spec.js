// @ts-check
import { test, expect } from '@playwright/test';
import { createEmployee, updateEmployeeSalary, getEmployeeById } from '../utils/employeeRepository.js';
import { closePool } from '../utils/dbClient.js';

test.describe('Database - Update Employee', () => {
  test('updates an employee salary and verifies the change', async () => {
    // Create a throwaway employee so this test never mutates the original
    // seed rows (id 1-8) — updating those permanently on every run would
    // make the test suite's own history hard to trust.
    const created = await createEmployee({
      name: 'Update Target',
      email: `update.target.${Date.now()}@example.com`,
      department: 'QA',
      salary: 50000,
    });

    const updated = await updateEmployeeSalary(created.id, 70000);
    console.log('Updated employee:', updated);
    expect(Number(updated.salary)).toBe(70000);

    // Read it back separately, proving the UPDATE actually persisted.
    const fetched = await getEmployeeById(created.id);
    expect(Number(fetched.salary)).toBe(70000);
  });

  test.afterAll(async () => {
    await closePool();
  });
});
