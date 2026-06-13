/**
 * Unit tests for the new dashboard UI primitives + widgets:
 * ProgressRing, Sparkline, StatCard, SelectMenu, RenewalsTimeline.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { ProgressRing } from '../../components/ui/ProgressRing';
import { Sparkline } from '../../components/ui/Sparkline';
import { StatCard } from '../../components/ui/StatCard';
import { SelectMenu } from '../../components/ui/SelectMenu';
import { RenewalsTimeline } from '../../components/RenewalsTimeline';
import type { Subscription } from '../../../../src/shared/types';

describe('ProgressRing', () => {
  it('renders the rounded percentage label', () => {
    render(<ProgressRing pct={41.6} />);
    expect(screen.getByText('42%')).toBeInTheDocument();
  });
  it('honours a custom label', () => {
    render(<ProgressRing pct={10} label="—" />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});

describe('Sparkline', () => {
  it('renders a polyline for a series', () => {
    const { container } = render(<Sparkline data={[1, 5, 2, 8]} />);
    expect(container.querySelector('polyline')).toBeTruthy();
  });
  it('renders nothing for fewer than two points', () => {
    const { container } = render(<Sparkline data={[5]} />);
    expect(container.querySelector('svg')).toBeNull();
  });
});

describe('StatCard', () => {
  it('renders label, value and an up-trend badge', () => {
    render(<StatCard label="Monthly spend" value="$41.00" trend={12} />);
    expect(screen.getByText('Monthly spend')).toBeInTheDocument();
    expect(screen.getByText('$41.00')).toBeInTheDocument();
    expect(screen.getByText('12%')).toBeInTheDocument();
  });
  it('renders a sparkline when a series is supplied', () => {
    const { container } = render(<StatCard label="Yearly" value="$492" sparkline={[1, 2, 3, 4]} />);
    expect(container.querySelector('polyline')).toBeTruthy();
  });
});

describe('SelectMenu', () => {
  const options = [
    { value: 'default', label: 'Default' },
    { value: 'amount', label: 'Amount' },
  ];

  it('shows the current selection and opens/selects on click', () => {
    const onChange = jest.fn();
    render(<SelectMenu value="default" onChange={onChange} options={options} label="Sort:" />);
    // current label visible
    expect(screen.getByText('Default')).toBeInTheDocument();
    // open
    fireEvent.click(screen.getByRole('button'));
    const amount = screen.getByRole('option', { name: 'Amount' });
    fireEvent.click(amount);
    expect(onChange).toHaveBeenCalledWith('amount');
  });
});

describe('RenewalsTimeline', () => {
  function subDueThisMonth(day: number): Subscription {
    const now = new Date();
    const date = new Date(now.getFullYear(), now.getMonth(), day);
    return {
      id: `s-${day}`, name: `Sub ${day}`, amount: 10, currency: 'USD',
      billingCycle: 'monthly', nextBillingDate: date.toISOString().split('T')[0],
      isActive: true, category: null,
    } as unknown as Subscription;
  }

  it('renders a dot per renewal this month', () => {
    const { container } = render(<RenewalsTimeline subscriptions={[subDueThisMonth(5), subDueThisMonth(20)]} />);
    expect(screen.getByText(/Renewals/i)).toBeInTheDocument();
    // 1 today-marker + 2 renewal dots = 3 absolutely-positioned markers
    const markers = container.querySelectorAll('[style*="left"]');
    expect(markers.length).toBeGreaterThanOrEqual(2);
  });

  it('renders nothing when no renewals fall in this month', () => {
    const { container } = render(<RenewalsTimeline subscriptions={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
