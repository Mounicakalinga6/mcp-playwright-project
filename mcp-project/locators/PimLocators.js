// @ts-check

export const LOCATORS = {
  addEmployeeButton: 'button:has-text("Add")',
  firstNameInput: 'input[placeholder="First Name"]',
  lastNameInput: 'input[placeholder="Last Name"]',
  // Personal Details view (after Save) — different layout than the Add form.
  employeeIdInput: '.oxd-input-group:has-text("Employee Id") input',
  saveButton: 'button:has-text("Save")',
  // Scoped to the Employee Name group — the search form also has a
  // Supervisor Name field with the same "Type for hints..." placeholder.
  employeeSearchInput: '.oxd-input-group:has-text("Employee Name") input[placeholder="Type for hints..."]',
  employeeListRows: '.oxd-table-card',
  searchButton: 'button:has-text("Search")',

  /** @param {string} name */
  autocompleteOptionByText: (name) => `.oxd-autocomplete-option:has-text("${name}")`,
};
