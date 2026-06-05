/**
 * E2E: Authentication flows
 * Requires: frontend running on :5173, backend running on :3001
 */

const TEST_EMAIL = `e2e-${Date.now()}@test.com`;
const TEST_PASSWORD = 'Subvoy2026!!';

describe('Authentication', () => {
  it('registers a new account and lands on dashboard', () => {
    cy.visit('/register');
    cy.get('input[type="email"]').type(TEST_EMAIL);
    cy.get('input[name="name"], input[placeholder*="name" i]').type('E2E User');
    cy.get('input[type="password"]').first().type(TEST_PASSWORD);
    cy.get('button[type="submit"]').click();
    cy.url().should('eq', Cypress.config('baseUrl') + '/');
    cy.contains('Subvoy').should('be.visible');
  });

  it('logs out and redirects to login', () => {
    cy.login(TEST_EMAIL, TEST_PASSWORD);
    cy.contains('Sign out').click();
    cy.url().should('include', '/login');
  });

  it('shows error for wrong password', () => {
    cy.visit('/login');
    cy.get('input[type="email"]').type(TEST_EMAIL);
    cy.get('input[type="password"]').type('WrongPassword99');
    cy.get('button[type="submit"]').click();
    cy.contains(/invalid|incorrect/i).should('be.visible');
  });

  it('forgot password page renders', () => {
    cy.visit('/forgot-password');
    cy.contains('Forgot your password').should('be.visible');
    cy.get('input[type="email"]').type(TEST_EMAIL);
    cy.get('button[type="submit"]').click();
    cy.contains(/check your email/i).should('be.visible');
  });
});
