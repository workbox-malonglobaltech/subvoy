/**
 * PlanUsageMeter — shows used/limit, nudges upgrade near/at cap, hides when
 * unlimited or usage not yet loaded.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { PlanUsageMeter } from '../../components/PlanUsageMeter';
import type { BillingUsageItem } from '../../../../src/shared/types';

const KEY = 'max_payment_obligations';
const usage = (used: number, limit: number): BillingUsageItem[] => [{ key: KEY, used, limit }];

describe('PlanUsageMeter', () => {
  it('renders the used/limit counts', () => {
    render(<PlanUsageMeter usage={usage(3, 10)} limitKey={KEY} label="tracked items" onUpgrade={jest.fn()} />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText(/of 10 tracked items/)).toBeInTheDocument();
  });

  it('hides entirely when the limit is unlimited (-1)', () => {
    const { container } = render(
      <PlanUsageMeter usage={usage(50, -1)} limitKey={KEY} label="tracked items" onUpgrade={jest.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing while usage is still loading (null)', () => {
    const { container } = render(
      <PlanUsageMeter usage={null} limitKey={KEY} label="tracked items" onUpgrade={jest.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('does not show an upgrade nudge well under the cap', () => {
    render(<PlanUsageMeter usage={usage(3, 10)} limitKey={KEY} label="tracked items" onUpgrade={jest.fn()} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows a prominent upgrade CTA at the cap and fires onUpgrade', () => {
    const onUpgrade = jest.fn();
    render(<PlanUsageMeter usage={usage(10, 10)} limitKey={KEY} label="tracked items" onUpgrade={onUpgrade} />);
    const btn = screen.getByRole('button', { name: /upgrade to add more/i });
    fireEvent.click(btn);
    expect(onUpgrade).toHaveBeenCalledTimes(1);
  });
});
