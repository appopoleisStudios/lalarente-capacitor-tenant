jest.mock('../../../../lib/supabase', () => ({ supabase: {} }));

// eslint-disable-next-line import/first
import { isPaymentClaimed } from '../holdingDeposit.api';

describe('isPaymentClaimed', () => {
  it('is false for a pending deposit the tenant has not reported as paid', () => {
    expect(isPaymentClaimed({ status: 'pending', payment_method: null })).toBe(false);
    expect(isPaymentClaimed({ status: 'pending' })).toBe(false);
  });

  it('is true once the tenant reports payment and the owner has not confirmed', () => {
    expect(isPaymentClaimed({ status: 'pending', payment_method: 'eft' })).toBe(true);
  });

  it('is false after the owner confirms or the deposit moves on', () => {
    for (const status of ['paid', 'applied', 'refunded', 'forfeited', 'expired']) {
      expect(isPaymentClaimed({ status, payment_method: 'eft' })).toBe(false);
    }
  });
});
