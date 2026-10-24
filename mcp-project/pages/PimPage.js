// @ts-check
import { expect } from '@playwright/test';
import { LOCATORS } from '../locators/PimLocators.js';
import { LOCATORS as MENU } from '../locators/DashboardLocators.js';
import { logInfo, logError } from '../utils/logger.js';

export class PimPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;
    this.addEmployeeButton = page.locator(LOCATORS.addEmployeeButton);
    this.firstNameInput = page.locator(LOCATORS.firstNameInput);
    this.lastNameInput = page.locator(LOCATORS.lastNameInput);
    this.employeeIdInput = page.locator(LOCATORS.employeeIdInput);
    this.saveButton = page.locator(LOCATORS.saveButton);
    this.employeeSearchInput = page.locator(LOCATORS.employeeSearchInput);
    this.employeeListRows = page.locator(LOCATORS.employeeListRows);
  }

  // Home → sidebar "PIM" → lands on Employee List.
  async navigateToEmployeeList() {
    try {
      logInfo('Navigating to PIM > Employee List');
      await this.page.goto('/');
      await this.page.locator(MENU.menuItemByName('PIM')).click();
      await this.page.waitForURL(/pim\/viewEmployeeList/);
      logInfo('Employee List opened');
    } catch (error) {
      logError(`Navigation to Employee List failed: ${error instanceof Error ? error.message : error}`);
      throw error;
    }
  }

  // Employee List → "+ Add" button → Add Employee form.
  async navigateToAddEmployee() {
    try {
      await this.navigateToEmployeeList();
      logInfo('Opening Add Employee form');
      await this.addEmployeeButton.click();
      await this.page.waitForURL(/pim\/addEmployee/);
      logInfo('Add Employee form opened');
    } catch (error) {
      logError(`Navigation to Add Employee failed: ${error instanceof Error ? error.message : error}`);
      throw error;
    }
  }

  /**
   * @param {{firstName: string, lastName: string}} employee
   */
  async addEmployee(employee) {
    await this.firstNameInput.fill(employee.firstName);
    await this.lastNameInput.fill(employee.lastName);
    await this.saveButton.click();
  }

  async getGeneratedEmployeeId() {
    // The Personal Details view still has a loading spinner briefly after
    // navigation; wait for the field to actually be populated before reading it.
    await expect(this.employeeIdInput).not.toHaveValue('');
    return this.employeeIdInput.inputValue();
  }

  /** @param {string} name */
  async searchEmployeeByName(name) {
    await this.navigateToEmployeeList();
    await this.employeeSearchInput.fill(name);
    // Scope to the autocomplete dropdown item specifically — a broad text
    // match can grab an unrelated element elsewhere on the page.
    const option = this.page.locator(LOCATORS.autocompleteOptionByText(name));
    await option.first().waitFor({ state: 'visible' });
    await option.first().click();
    await this.page.locator(LOCATORS.searchButton).click();
  }
}
