// @ts-check
import { faker } from '@faker-js/faker';

/** Generates a unique employee so parallel test runs never collide. */
export function buildEmployee() {
  return {
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
  };
}

/**
 * Generates a unique system user, reusing an existing employee's name.
 * @param {string} employeeName
 * @param {Partial<{role: string, status: string, username: string, password: string}>} [overrides]
 */
export function buildSystemUser(employeeName, overrides = {}) {
  return {
    role: 'ESS',
    employeeName,
    status: 'Enabled',
    username: `${faker.internet.username()}_${Date.now()}`,
    password: `${faker.internet.password({ length: 10 })}1!`,
    ...overrides,
  };
}
