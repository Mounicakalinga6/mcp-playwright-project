// @ts-check

export const LOCATORS = {
  userDropdown: '.oxd-userdropdown-tab',
  logoutLink: '[role="menuitem"]:has-text("Logout")',
  sidebarMenu: '.oxd-sidepanel',
  pageHeading: '.oxd-topbar-header-breadcrumb h6',

  // Left sidebar menu entries (Admin, PIM, Leave, ...). Shared by every page
  // object, since navigation always starts from this menu.
  /** @param {string} name */
  menuItemByName: (name) => `a.oxd-main-menu-item:has-text("${name}")`,
};
