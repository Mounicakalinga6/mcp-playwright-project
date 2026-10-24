// @ts-check
import { test, expect } from '@playwright/test';
import { getAllEmployees, getEmployeeById } from '../utils/employeeRepository.js';
import { closePool } from '../utils/dbClient.js';

test.describe('Database - Read Employees', () => {
  test('reads all employees and prints them', async () => {
    const employees = await getAllEmployees();
    console.table(employees);
    expect(employees.length).toBeGreaterThan(0);
  });

  test('reads one employee by id', async () => {
    const employee = await getEmployeeById(1);
    console.log(employee);
    expect(employee).toBeTruthy();
    expect(employee.id).toBe(1);
  });

  test.afterAll(async () => {
    await closePool();
  });
});
