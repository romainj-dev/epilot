import { defineConfig } from 'cypress'

// Cypress E2E configuration - see cypress/README.md
export default defineConfig({
  defaultBrowser: 'chrome',
  e2e: {
    baseUrl: 'http://localhost:3000',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 10000,
    retries: {
      runMode: 2,
      openMode: 0,
    },
  },
  env: {
    TEST_USER_EMAIL: 'romainj.contact+test-dev-account@gmail.com',
    TEST_USER_PASSWORD: '@Test123!',
  },
})
