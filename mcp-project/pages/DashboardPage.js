// @ts-check
import { LOCATORS } from '../locators/DashboardLocators.js';

export class DashboardPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;
    this.userDropdown = page.locator(LOCATORS.userDropdown);
    this.logoutLink = page.locator(LOCATORS.logoutLink);
    this.sidebarMenu = page.locator(LOCATORS.sidebarMenu);
    this.pageHeading = page.locator(LOCATORS.pageHeading);
  }

  /** @param {string} name */
  menuItem(name) {
    return this.page.locator(LOCATORS.menuItemByName(name));
  }

  /** @param {string} menuName */
  async navigateTo(menuName) {
    await this.menuItem(menuName).click();
  }

  async logout() {
    await this.userDropdown.click();
    await this.logoutLink.click();
  }

  async isLoaded() {
    await this.page.waitForURL(/dashboard\/index/);
    return this.pageHeading.isVisible();
  }

  async getPageHeading() {
    return this.pageHeading.innerText();
  }
}
