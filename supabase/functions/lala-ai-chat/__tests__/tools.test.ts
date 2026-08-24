import { filterContextByTopics, howThisAppWorks } from '../tools';

describe('Lala product guidance', () => {
  it.each(['tenant', 'owner'])(
    'keeps %s invoice communication in-app without exposing vendor contact channels',
    (role) => {
      const guidance = howThisAppWorks(role, 'invoices');

      expect(guidance).toContain('in-app maintenance chat');
      expect(guidance).toContain('do not call, email, or use WhatsApp');
      expect(guidance).not.toMatch(/Chat\/Call|phone number/i);
    }
  );

  it('tells vendors to use the in-app maintenance chat with the payer', () => {
    const guidance = howThisAppWorks('vendor', 'invoices');

    expect(guidance).toContain('in-app maintenance chat');
    expect(guidance).not.toMatch(/Chat\/Call|call the payer/i);
  });

  it('preserves the five canonical tenant tabs in payment guidance', () => {
    const guidance = howThisAppWorks('tenant', 'pay_vendor');

    expect(guidance).toContain('Home, Search, Payments, Profile, Lala AI');
    expect(guidance).toContain('There is no Vendor Payments tab');
  });

  it('returns only requested live-context sections', () => {
    const context = [
      'LEASES:\nLease: active',
      'MAINTENANCE INVOICES:\n[submitted] INV-1 R 500',
      'ARREARS: none open',
    ].join('\n\n');

    expect(filterContextByTopics(context, ['invoices'])).toBe(
      'MAINTENANCE INVOICES:\n[submitted] INV-1 R 500'
    );
  });
});
