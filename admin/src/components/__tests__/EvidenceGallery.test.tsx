import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EvidenceGallery from '../EvidenceGallery';
import type { VendorEvidence } from '../../types/admin';

const evidence: VendorEvidence = {
  photos: [
    { url: 'https://example.com/p1.jpg', stage: 'completion', at: '2026-08-01T10:00:00Z' },
    { url: 'https://example.com/p2.jpg', stage: 'tenant_rejection', at: '2026-08-02T09:00:00Z' },
  ],
  timeline: [
    { event: 'closure_requested', note: 'Work done', at: '2026-08-01T09:00:00Z' },
    { event: 'tenant_rejected', note: 'Leak still present', at: '2026-08-02T09:00:00Z' },
  ],
};

describe('EvidenceGallery', () => {
  it('shows empty message when there is no evidence', () => {
    render(<EvidenceGallery evidence={null} />);
    expect(screen.getByText(/No photo evidence or event history/i)).toBeInTheDocument();
  });

  it('shows a collapsible summary with counts', () => {
    render(<EvidenceGallery evidence={evidence} />);
    expect(screen.getByText(/📷 2 photos · 2 events/)).toBeInTheDocument();
  });

  it('reveals photos and timeline when opened', () => {
    render(<EvidenceGallery evidence={evidence} />);
    fireEvent.click(screen.getByRole('button', { name: /Show evidence/i }));
    expect(screen.getByText('Photos')).toBeInTheDocument();
    expect(screen.getByText('Event history')).toBeInTheDocument();
    expect(screen.getByText('Completion photos')).toBeInTheDocument();
    expect(screen.getByText('Tenant rejection')).toBeInTheDocument();
    expect(screen.getByText('Closure requested')).toBeInTheDocument();
    expect(screen.getByText('Leak still present')).toBeInTheDocument();
  });

  it('collapses when clicked again', () => {
    render(<EvidenceGallery evidence={evidence} />);
    fireEvent.click(screen.getByRole('button', { name: /Show evidence/i }));
    expect(screen.getByText('Event history')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Hide evidence/i }));
    expect(screen.queryByText('Event history')).not.toBeInTheDocument();
  });
});
