/**
 * E2E: Dashboard — add, edit, delete subscriptions
 */

const EMAIL = 'test@test.com';
const PASSWORD = 'Subvoy2026!!';

describe('Dashboard', () => {
  beforeEach(() => cy.login(EMAIL, PASSWORD));

  it('shows stat cards and empty state or subscription list', () => {
    cy.contains(/monthly spend/i).should('be.visible');
    cy.contains(/active subs/i).should('be.visible');
  });

  it('adds a subscription and shows it in the list', () => {
    cy.contains('+ Add').click();
    cy.get('input[placeholder*="Netflix"]').type('Cypress Test Sub');
    cy.get('input[type="number"]').type('9.99');
    cy.get('input[type="date"]').type('2026-06-01');
    cy.get('button').contains(/add subscription/i).click();
    cy.contains('Cypress Test Sub').should('be.visible');
    cy.contains('$9.99').should('be.visible');
  });

  it('edits a subscription', () => {
    cy.contains('Cypress Test Sub').parents('article').within(() => {
      cy.contains('Edit').click();
    });
    cy.get('input[placeholder*="Netflix"]').clear().type('Cypress Edited Sub');
    cy.get('button').contains(/save changes/i).click();
    cy.contains('Cypress Edited Sub').should('be.visible');
  });

  it('deletes a subscription', () => {
    cy.contains('Cypress Edited Sub').parents('article').within(() => {
      cy.contains('Delete').click();
    });
    cy.contains('Cypress Edited Sub').should('not.exist');
  });

  it('search filters subscriptions', () => {
    // Add two subs
    cy.contains('+ Add').click();
    cy.get('input[placeholder*="Netflix"]').type('Netflix');
    cy.get('input[type="number"]').type('15.99');
    cy.get('input[type="date"]').type('2026-06-01');
    cy.get('button').contains(/add subscription/i).click();

    cy.contains('+ Add').click();
    cy.get('input[placeholder*="Netflix"]').type('Spotify');
    cy.get('input[type="number"]').type('9.99');
    cy.get('input[type="date"]').type('2026-06-01');
    cy.get('button').contains(/add subscription/i).click();

    cy.get('input[placeholder*="Search"]').type('Netflix');
    cy.contains('Netflix').should('be.visible');
    cy.contains('Spotify').should('not.exist');
  });

  it('mobile hamburger menu shows nav links', () => {
    cy.viewport(375, 812);
    cy.get('button[aria-label="Open navigation menu"]').click();
    cy.contains('Analytics').should('be.visible');
    cy.contains('Import CSV').should('be.visible');
    cy.contains('Settings').should('be.visible');
  });
});
