// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  reporter: 'list',
  projects: [
    // Deterministic tests against a local fake player (npm test).
    { name: 'fixtures', testIgnore: /live\// },
    // Opt-in checks against the real YouTube (npm run test:live). Needs network; can be flaky.
    { name: 'live', testMatch: /live\/.*\.spec\.js/, timeout: 90_000, retries: 1 },
  ],
});
