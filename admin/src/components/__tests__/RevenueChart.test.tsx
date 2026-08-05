import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RevenueChart from '../RevenueChart';
import type { RevenuePoint } from '../../types/admin';

const sampleData: RevenuePoint[] = [
  { day: '2026-08-01', gross: 1000, net: 800 },
  { day: '2026-08-02', gross: 2000, net: 1600 },
  { day: '2026-08-03', gross: 0, net: 0 },
];

describe('RevenueChart', () => {
  it('renders the chart title', () => {
    render(<RevenueChart data={sampleData} />);
    expect(screen.getByText('Revenue Over Time')).toBeInTheDocument();
  });

  it('renders one bar per data point plus axis labels', () => {
    render(<RevenueChart data={sampleData} />);
    // Each bar is rendered as a div with role img on container; bars themselves have titles
    expect(screen.getByTitle('2026-08-01 net R800')).toBeInTheDocument();
    expect(screen.getByTitle('2026-08-02 net R1,600')).toBeInTheDocument();
  });

  it('shows empty state when no data', () => {
    render(<RevenueChart data={[]} />);
    expect(screen.getByText(/No revenue data in this window yet/i)).toBeInTheDocument();
  });

  it('shows hover tooltip with day info', () => {
    render(<RevenueChart data={sampleData} />);
    fireEvent.mouseEnter(screen.getByTitle('2026-08-02 net R1,600'));
    // The day appears in both the axis labels and the tooltip — assert the tooltip-unique line.
    expect(screen.getAllByText('2026-08-02').length).toBeGreaterThan(0);
    expect(screen.getByText(/Net R1,600 · Gross R2,000/)).toBeInTheDocument();
  });

  it('handles all-zero data without crashing', () => {
    render(<RevenueChart data={[{ day: '2026-08-01', gross: 0, net: 0 }]} />);
    expect(screen.getByText('Revenue Over Time')).toBeInTheDocument();
  });
});
