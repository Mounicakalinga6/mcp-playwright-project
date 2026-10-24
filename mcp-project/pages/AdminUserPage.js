// @ts-check
import { LOCATORS } from '../locators/AdminUserLocators.js';
import { LOCATORS as MENU } from '../locators/DashboardLocators.js';
import { logInfo, logError } from '../utils/logger.js';

export class AdminUserPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;
    this.form = page.locator(LOCATORS.form);
    this.addButton = page.locator(LOCATORS.addButton);
    this.userRoleSelect = this.form.locator(LOCATORS.selectTextDropdown).nth(0);
    this.employeeNameInput = this.form.locator(LOCATORS.employeeNameInput);
    this.statusSelect = this.form.locator(LOCATORS.selectTextDropdown).nth(1);
    this.usernameInput = this.form.locator(LOCATORS.usernameInput);
    this.passwordInput = this.form.locator(LOCATORS.passwordInputs).nth(0);
    this.confirmPasswordInput = this.form.locator(LOCATORS.passwordInputs).nth(1);
    this.saveButton = page.locator(LOCATORS.saveButton);
    this.searchUsernameInput = page.locator(LOCATORS.searchUsernameInput).first();
    this.searchButton = page.locator(LOCATORS.searchButton);
    this.resultRows = page.locator(LOCATORS.resultRows);
  }

  // Home → sidebar "Admin" → lands on User Management > Users.
  async navigateToSystemUsers() {
    try {
      logInfo('Navigating to Admin > System Users');
      await this.page.goto('/');
      await this.page.locator(MENU.menuItemByName('Admin')).click();
      await this.page.waitForURL(/admin\/viewSystemUsers/);
      logInfo('System Users list opened');
    } catch (error) {
      logError(`Navigation to System Users failed: ${error instanceof Error ? error.message : error}`);
      throw error;
    }
  }

  // System Users → "+ Add" button → Add User form.
  async navigateToAddUser() {
    try {
      await this.navigateToSystemUsers();
      logInfo('Opening Add User form');
      await this.addButton.click();
      await this.page.waitForURL(/admin\/saveSystemUser/);
      logInfo('Add User form opened');
    } catch (error) {
      logError(`Navigation to Add User failed: ${error instanceof Error ? error.message : error}`);
      throw error;
    }
  }

  /**
   * @param {import('@playwright/test').Locator} dropdownLocator
   * @param {string} optionText
   */
  async selectDropdownOption(dropdownLocator, optionText) {
    await dropdownLocator.click();
    await this.page.locator(LOCATORS.selectOptionByText(optionText)).click();
  }

  /**
   * @param {{role: string, employeeName: string, status: string, username: string, password: string}} user
   */
  async addUser(user) {
    await this.selectDropdownOption(this.userRoleSelect, user.role);
    await this.employeeNameInput.fill(user.employeeName);
    const employeeOption = this.page.locator(LOCATORS.autocompleteOptionByText(user.employeeName));
    await employeeOption.first().waitFor({ state: 'visible' });
    await employeeOption.first().click();
    await this.selectDropdownOption(this.statusSelect, user.status);
    await this.usernameInput.fill(user.username);
    await this.passwordInput.fill(user.password);
    await this.confirmPasswordInput.fill(user.password);
    await this.saveButton.click();
  }

  /** @param {string} username */
  async searchByUsername(username) {
    await this.navigateToSystemUsers();
    await this.searchUsernameInput.fill(username);
    await this.searchButton.click();
  }
}
