/**
 * SubscriptionList (compact list view) — renders rows and fires the right
 * action callbacks (edit, delete, mark-paid).
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { SubscriptionList } from '../../components/SubscriptionList';
import type { Subscription } from '../../../../src/shared/types';

function makeSub(over: Partial<Subscription> = {}): Subscription {
  return {
    id: 'sub-1', name: 'Netflix', amount: 15.99, currency: 'USD',
    billingCycle: 'monthly', nextBillingDate: '2099-01-01', isActive: true,
    category: 'Entertainment',
    ...over,
  } as unknown as Subscription;
}

describe('SubscriptionList', () => {
  it('renders a row per subscription', () => {
    render(
      <SubscriptionList
        subs={[makeSub(), makeSub({ id: 'sub-2', name: 'Spotify' })]}
        onEdit={jest.fn()} onDelete={jest.fn()}
      />,
    );
    expect(screen.getByText('Netflix')).toBeInTheDocument();
    expect(screen.getByText('Spotify')).toBeInTheDocument();
  });

  it('fires onMarkPaid / onEdit / onDelete with the right id', () => {
    const onEdit = jest.fn();
    const onDelete = jest.fn();
    const onMarkPaid = jest.fn();
    render(
      <SubscriptionList
        subs={[makeSub()]}
        onEdit={onEdit} onDelete={onDelete} onMarkPaid={onMarkPaid}
      />,
    );

    fireEvent.click(screen.getByLabelText('Mark Netflix paid'));
    expect(onMarkPaid).toHaveBeenCalledWith('sub-1');

    fireEvent.click(screen.getByLabelText('Edit Netflix'));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'sub-1' }));

    fireEvent.click(screen.getByLabelText('Delete Netflix'));
    expect(onDelete).toHaveBeenCalledWith('sub-1');
  });

  it('shows a Paused badge and no mark-paid action for inactive subs', () => {
    render(
      <SubscriptionList
        subs={[makeSub({ isActive: false })]}
        onEdit={jest.fn()} onDelete={jest.fn()} onMarkPaid={jest.fn()}
      />,
    );
    expect(screen.getByText('Paused')).toBeInTheDocument();
    expect(screen.queryByLabelText('Mark Netflix paid')).toBeNull();
  });
});
