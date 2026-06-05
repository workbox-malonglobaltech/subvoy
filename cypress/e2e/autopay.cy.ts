/**
 * E2E: Autopay — enable "Pay automatically" on a subscription and see the badge.
 *
 * Runs against the full stack (frontend + backend + DB), like the other specs.
 */

const EMAIL = 'test@test.com';
const PASSWORD = 'Subvoy2026!!';

describe('Autopay', () => {
  beforeEach(() => cy.login(EMAIL, PASSWORD));

  it('enables autopay with a spend cap and shows the Auto badge', () => {
    cy.contains('+ Add').click();
    cy.get('input[placeholder*="Netflix"]').type('Autopay Test Sub');
    cy.get('input[type="number"]').first().type('12.50');
    cy.get('input[type="date"]').type('2026-06-01');

    // Toggle "Pay automatically" and set a cap
    cy.get('#sub-autopay').check();
    cy.get('#sub-autopay-max').type('20');

    cy.get('button').contains(/add subscription/i).click();

    cy.contains('Autopay Test Sub')
      .parents('article')
      .within(() => {
        cy.contains('Auto').should('be.visible');
      });
  });

  it('persists the autopay state when editing', () => {
    cy.contains('Autopay Test Sub').parents('article').within(() => {
      cy.contains('Edit').click();
    });
    cy.get('#sub-autopay').should('be.checked');
    cy.get('#sub-autopay-max').should('have.value', '20');

    // Turn autopay off and save
    cy.get('#sub-autopay').uncheck();
    cy.get('button').contains(/save changes/i).click();

    cy.contains('Autopay Test Sub').parents('article').within(() => {
      cy.contains('Auto').should('not.exist');
    });
  });

  it('cleans up the test subscription', () => {
    cy.contains('Autopay Test Sub').parents('article').within(() => {
      cy.contains('Delete').click();
    });
    cy.contains('Autopay Test Sub').should('not.exist');
  });
});
