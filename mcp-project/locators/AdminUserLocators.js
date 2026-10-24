// @ts-check

export const LOCATORS = {
  // Scope every form field to `.oxd-form` — the topbar has its own search
  // input that also matches loose selectors, which can silently steal fill() calls.
  form: '.oxd-form',
  addButton: 'button:has-text("Add")',
  selectTextDropdown: '.oxd-select-text', // used with .nth(0)/.nth(1) for User Role / Status
  employeeNameInput: 'input[placeholder="Type for hints..."]',
  usernameInput: '.oxd-input-group:has-text("Username") input',
  passwordInputs: 'input[type="password"]', // used with .nth(0)/.nth(1) for Password / Confirm Password
  saveButton: 'button:has-text("Save")',
  searchUsernameInput: '.oxd-table-filter-area input',
  searchButton: 'button:has-text("Search")',
  resultRows: '.oxd-table-card',

  /** @param {string} text */
  selectOptionByText: (text) => `.oxd-select-option:has-text("${text}")`,

  /** @param {string} name */
  autocompleteOptionByText: (name) => `.oxd-autocomplete-option:has-text("${name}")`,
};
