import React from 'react';
import { render } from '@testing-library/react-native';
import { StatusBadge } from '../StatusBadge';

describe('StatusBadge', () => {
  describe('rendering predefined statuses', () => {
    const statuses = [
      { status: 'open', expectedLabel: 'Open' },
      { status: 'assigned', expectedLabel: 'Assigned' },
      { status: 'in_progress', expectedLabel: 'In Progress' },
      { status: 'completed', expectedLabel: 'Completed' },
      { status: 'closed', expectedLabel: 'Closed' },
      { status: 'approved', expectedLabel: 'Approved' },
      { status: 'rejected', expectedLabel: 'Rejected' },
      { status: 'pending', expectedLabel: 'Pending' },
      { status: 'active', expectedLabel: 'Active' },
      { status: 'draft', expectedLabel: 'Draft' },
    ] as const;

    it.each(statuses)('renders $status with label "$expectedLabel"', ({ status, expectedLabel }) => {
      const { getByText } = render(<StatusBadge status={status} />);
      expect(getByText(expectedLabel)).toBeTruthy();
    });
  });

  describe('size variants', () => {
    it('renders medium size by default', () => {
      const { getByText } = render(<StatusBadge status="open" />);
      const badge = getByText('Open');
      expect(badge.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ fontSize: 13, fontWeight: '600' }),
        ])
      );
    });

    it('renders small size', () => {
      const { getByText } = render(<StatusBadge status="open" size="small" />);
      const badge = getByText('Open');
      expect(badge.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ fontSize: 11 }),
        ])
      );
    });
  });

  describe('custom label', () => {
    it('overrides the default label when label prop is provided', () => {
      const { getByText, queryByText } = render(
        <StatusBadge status="open" label="Custom Open" />
      );
      expect(getByText('Custom Open')).toBeTruthy();
      expect(queryByText('Open')).toBeNull();
    });
  });

  describe('custom config', () => {
    it('uses customConfig when provided', () => {
      const customConfig = { bg: '#FF0000', text: '#FFFFFF', label: 'Custom' };
      const { getByText } = render(
        <StatusBadge status="open" customConfig={customConfig} />
      );
      expect(getByText('Custom')).toBeTruthy();
    });
  });

  describe('unknown status', () => {
    it('renders the status value as label for unknown statuses', () => {
      const { getByText } = render(<StatusBadge status="unknown_value" />);
      expect(getByText('unknown_value')).toBeTruthy();
    });
  });
});
