// The end-to-end database, separate from development and integration tests.
export const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5435/satisfy_e2e";
