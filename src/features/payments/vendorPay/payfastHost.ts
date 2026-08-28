/** PayFast hosted checkout host (edge returns sandbox or live URL). */

export function isPayFastHost(rawUrl: string | undefined | null): boolean {
  if (!rawUrl) return false;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return host === 'payfast.co.za' || host.endsWith('.payfast.co.za');
  } catch {
    return false;
  }
}

export function isPayFastSandboxHost(rawUrl: string | undefined | null): boolean {
  if (!rawUrl) return false;
  try {
    return new URL(rawUrl).hostname.toLowerCase() === 'sandbox.payfast.co.za';
  } catch {
    return false;
  }
}
