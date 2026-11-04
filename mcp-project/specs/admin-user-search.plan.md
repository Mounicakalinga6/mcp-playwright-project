# Admin User Management - System Users Search/Filter

## Application Overview

Read-only plan for Admin > User Management > System Users (/web/index.php/admin/viewSystemUsers) on the shared OrangeHRM demo. Never click Add, Save, Edit, Delete or Reset Password (row action icons and the checkboxes are out of scope). Page facts verified live on 2026-11-04: heading "System Users" (level 5); filter form with Username textbox (no accessible name; scope with .oxd-input-group:has-text("Username") input), User Role custom select (.oxd-input-group:has-text("User Role") .oxd-select-text; options "-- Select --", "Admin", "ESS" via role=option), Employee Name textbox "Type for hints...", Status select, and buttons "Search" and "Reset" (the Reset in the filter form clears filters only; it is unrelated to Reset Password). Results: table rows .oxd-table-body .oxd-table-row with cells Username, User Role, Employee Name, Status; record count text "(N) Records Found" in .orangehrm-horizontal-padding span. Initial load showed 38 records, so do not assert exact counts except where noted.

## Test Scenarios

### 1. System Users search and filter

**Seed:** `tests/seed.spec.js`

#### 1.1. Search by username Admin returns the built-in Admin user

**File:** `tests/admin-user-search/search-by-username.spec.js`

**Steps:**
  1. Navigate to /web/index.php/admin/viewSystemUsers and wait for the 'System Users' heading.
    - expect: Filter form and results table are visible.
  2. Type 'Admin' into the Username textbox.
    - expect: Textbox shows 'Admin'.
  3. Click the 'Search' button.
    - expect: Record count reads '(1) Record Found' (observed; safer assertion: at least one row).
    - expect: A row exists whose Username cell is 'Admin', User Role cell is 'Admin', Employee Name 'John Doe', Status 'Enabled'.

#### 1.2. Filter by User Role Admin shows only Admin-role rows

**File:** `tests/admin-user-search/filter-by-role.spec.js`

**Steps:**
  1. Navigate to the System Users page.
    - expect: Page loads with the full list (about 38 records, mixed Admin and ESS roles).
  2. Click the User Role select, then choose the option 'Admin' (options are '-- Select --', 'Admin', 'ESS').
    - expect: Select displays 'Admin'.
  3. Click 'Search'.
    - expect: At least one row is shown.
    - expect: Every row's User Role cell equals 'Admin' (no 'ESS' rows). Observed result: 1 record (Admin / John Doe), but do not assert exact count since others may change data.

#### 1.3. Search for a non-existent username shows No Records Found

**File:** `tests/admin-user-search/search-no-results.spec.js`

**Steps:**
  1. Navigate to the System Users page.
    - expect: Page loads.
  2. Type 'zzqx_no_such_user' into the Username textbox and click 'Search'.
    - expect: Text 'No Records Found' appears in the record count area.
    - expect: An info toast with 'No Records Found' appears briefly.
    - expect: The table body contains zero data rows.
