import { isPayFastHost, isPayFastSandboxHost } from '../payfastHost';

describe('payfastHost', () => {
  it('accepts sandbox and live PayFast https hosts', () => {
    expect(isPayFastHost('https://sandbox.payfast.co.za/eng/process')).toBe(true);
    expect(isPayFastHost('https://www.payfast.co.za/eng/process')).toBe(true);
    expect(isPayFastHost('https://evil.example/payfast.co.za')).toBe(false);
  });

  it('detects sandbox for production testing sign-off (LAL-119)', () => {
    expect(isPayFastSandboxHost('https://sandbox.payfast.co.za/eng/process?x=1')).toBe(true);
    expect(isPayFastSandboxHost('https://www.payfast.co.za/eng/process')).toBe(false);
  });
});
