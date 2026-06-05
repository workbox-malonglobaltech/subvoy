/**
 * E2E: Analytics page
 */

describe('Analytics', () => {
  beforeEach(() => cy.login('test@test.com', 'Subvoy2026!!'));

  it('renders stat cards, chart, and calendar', () => {
    cy.visit('/analytics');
    cy.contains(/ytd spend/i).should('be.visible');
    cy.contains(/monthly avg/i).should('be.visible');
    cy.contains(/top category/i).should('be.visible');
    cy.contains(/monthly spend/i).should('be.visible');
    cy.contains(/by category/i).should('be.visible');
    cy.contains(/upcoming payments/i).should('be.visible');
  });

  it('calendar shows current month and today highlighted', () => {
    cy.visit('/analytics');
    const monthYear = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
    cy.contains(monthYear).should('be.visible');
  });

  it('export CSV link is present', () => {
    cy.visit('/analytics');
    cy.contains(/export csv/i).should('be.visible');
    cy.contains(/export csv/i).should('have.attr', 'href').and('include', '/analytics/export');
  });
});
