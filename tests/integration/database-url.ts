// The integration test database. Defaults to a `satisfy_test` database on the
// docker compose Postgres; CI points TEST_DATABASE_URL at its service.
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5435/satisfy_test";
