-- Creates the employees table and its 8 seed rows for the practice Postgres DB.
--
-- Run it against the database named in DB_NAME in your .env, e.g.:
--   psql -U postgres -d playwrightdb -f db/setup.sql
--
-- WARNING: drops the existing employees table first, so every row added by
-- db-create / db-update / ui-db-flow runs is lost. That's the point — run it
-- any time to reset back to the clean seed data. db-read.spec.js expects the
-- row with id = 1 to exist, which this guarantees.

DROP TABLE IF EXISTS employees;

CREATE TABLE employees (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100),
    email       VARCHAR(100),
    department  VARCHAR(50),
    salary      NUMERIC(10,2)
);

INSERT INTO employees (name, email, department, salary) VALUES
('Karthik A',    'karthik@example.com', 'QA',          65000.00),
('Mounica K',    'mounica@example.com', 'QA',          62000.00),
('Ravi Kumar',   'ravi@example.com',    'Engineering', 85000.00),
('Priya Sharma', 'priya@example.com',   'Engineering', 90000.00),
('John Smith',   'john@example.com',    'Sales',       55000.00),
('Anita Rao',    'anita@example.com',   'HR',          50000.00),
('David Lee',    'david@example.com',   'Sales',       58000.00),
('Sneha Reddy',  'sneha@example.com',   'Finance',     70000.00);

SELECT * FROM employees ORDER BY id;
