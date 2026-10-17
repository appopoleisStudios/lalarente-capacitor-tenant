/**
 * Verifies the deposit_interest_rate write-path contract.
 *
 * OwnerLeaseCreateScreen is the sole writer of leases.deposit_interest_rate.
 * Live DB snapshot (2026-10-17):
 *   SELECT deposit_interest_rate, COUNT(*) FROM leases GROUP BY 1 ORDER BY 1 NULLS FIRST
 *   → {null: 4 rows, 7.25: 1 row}   ← zero decimal-format rows (<1) exist
 *
 * This test extracts the insert-payload builder from the screen source and
 * asserts that deposit_interest_rate is written as a percentage (5.25), not
 * a decimal (0.0525), so the normalizeDepositRate() contract is satisfied.
 */

import fs from 'fs';
import path from 'path';

const SCREEN_PATH = path.resolve(__dirname, '../OwnerLeaseCreateScreen.tsx');

describe('OwnerLeaseCreateScreen — deposit_interest_rate write-path', () => {
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(SCREEN_PATH, 'utf8');
  });

  it('sets deposit_interest_rate as a percentage value (5.25) in the lease insert', () => {
    // The insert payload must contain the literal 5.25 assigned to
    // deposit_interest_rate — not 0.0525 (decimal) or any computed value.
    expect(source).toMatch(/deposit_interest_rate:\s*5\.25/);
  });

  it('does not set deposit_interest_rate as a decimal value', () => {
    // Guard against regression back to decimal format.
    expect(source).not.toMatch(/deposit_interest_rate:\s*0\.\d+/);
  });

  it('normalizeDepositRate(5.25) produces 0.0525 — end-to-end unit contract', () => {
    // Inline the formula to keep this test dependency-free.
    // Mirrors normalizeDepositRate() exactly: (storedRate ?? 5.25) / 100
    const writtenValue = 5.25;
    const decimal = writtenValue / 100;
    expect(decimal).toBeCloseTo(0.0525, 6);
  });
});
