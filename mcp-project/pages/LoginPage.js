// @ts-check
import { logInfo, logError } from '../utils/logger.js';
import { LOCATORS } from '../locators/LoginLocators.js';

export class LoginPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;
    this.usernameInput = page.locator(LOCATORS.usernameInput);
    this.passwordInput = page.locator(LOCATORS.passwordInput);
    this.loginButton = page.locator(LOCATORS.loginButton);
    this.errorAlert = page.locator(LOCATORS.errorAlert);
    this.forgotPasswordLink = page.locator(LOCATORS.forgotPasswordLink);
  }

  async open() {
    await this.page.goto('/web/index.php/auth/login');
  }

  /**
   * @param {string} username
   * @param {string} password
   */
  async login(username, password) {
    try {
      logInfo(`Logging in as "${username}"`);
      await this.usernameInput.fill(username);
      await this.passwordInput.fill(password);
      await this.loginButton.click();
      logInfo('Login form submitted');
    } catch (error) {
      logError(`Login failed for "${username}": ${error instanceof Error ? error.message : error}`);
      throw error;
    }
  }

  async getErrorMessage() {
    try {
      await this.errorAlert.waitFor({ state: 'visible' });
      return await this.errorAlert.innerText();
    } catch (error) {
      logError(`Could not read login error message: ${error instanceof Error ? error.message : error}`);
      throw error;
    }
  }
}
