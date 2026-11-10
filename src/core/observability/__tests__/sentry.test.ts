import { sanitizeForSentry } from '../sentry';

jest.mock('@sentry/react-native', () => ({
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
}));
jest.mock('@/src/core/config/env', () => ({ env: { sentry: { dsn: '' } } }));

describe('sanitizeForSentry', () => {
  describe('Supabase/Postgres plain structured errors (not Error instances)', () => {
    it('emits code + fixed description for known codes — never the original message', () => {
      const err = {
        code: '23505',
        message: 'duplicate key value violates unique constraint "profiles_email_key"',
      };
      const result = sanitizeForSentry(err);
      expect(result.message).toBe('23505: unique violation');
      // Original message (which may contain column values) must not appear.
      expect(result.message).not.toContain('profiles_email_key');
    });

    it('allowlisted code with sensitive custom message — uses fixed description', () => {
      // A custom DB exception can use an allowlisted SQLSTATE with arbitrary text.
      const err = { code: '42501', message: 'denied for user: tenant@example.com' };
      const result = sanitizeForSentry(err);
      expect(result.message).toBe('42501: insufficient privilege');
      expect(result.message).not.toContain('tenant@example.com');
    });

    it('unknown Postgres code — returns fixed fallback, never the code or message', () => {
      const err = { code: 'P0001', message: 'tenant email tenant@example.com already registered' };
      const result = sanitizeForSentry(err);
      expect(result.message).toBe('unknown database error');
      expect(result.message).not.toContain('P0001');
      expect(result.message).not.toContain('tenant@example.com');
    });

    it('PII value as code — returns fixed fallback, never forwards the code', () => {
      // Adversarial: caller passes email address as the code field.
      const err = { code: 'tenant@example.com', message: 'hidden' };
      const result = sanitizeForSentry(err);
      expect(result.message).toBe('unknown database error');
      expect(result.message).not.toContain('tenant@example.com');
    });

    it('emits fixed descriptions for all known SQLSTATE codes', () => {
      const knownCodes: Record<string, string> = {
        '08006': 'connection failure',
        '28000': 'invalid authorization',
        '42501': 'insufficient privilege',
        '23502': 'not null violation',
        '23503': 'foreign key violation',
        '23505': 'unique violation',
        '23514': 'check violation',
        '53100': 'disk full',
        '57014': 'query canceled',
      };
      for (const [code, expectedDesc] of Object.entries(knownCodes)) {
        // Even with a custom message containing PII, only fixed description is emitted.
        const result = sanitizeForSentry({ code, message: `sensitive: user@example.com` });
        expect(result.message).toBe(`${code}: ${expectedDesc}`);
        expect(result.message).not.toContain('user@example.com');
      }
    });
  });

  describe('JS Error objects (instanceof Error)', () => {
    it('replaces the message and sanitizes the stack message line', () => {
      const original = new Error('SELECT failed for id=user@example.com');
      const result = sanitizeForSentry(original);
      expect(result.message).toBe('API error');
      expect(result.message).not.toContain('user@example.com');
      // The original message must not leak through the stack either.
      expect(result.stack).not.toContain('user@example.com');
      // But stack frames must be preserved for Sentry grouping.
      expect(result.stack).toContain('at ');
    });

    it('preserves stack frames while replacing all message lines', () => {
      const original = new Error('sensitive: SELECT * FROM users WHERE id = user@example.com');
      const result = sanitizeForSentry(original);
      // Stack first line must use the sanitized message.
      expect(result.stack?.split('\n')[0]).toContain('API error');
      // All "  at " frame lines from the original must be present in the result.
      const originalFrames = (original.stack ?? '').split('\n').filter((l) => /^\s+at\s/.test(l));
      const resultFrames = (result.stack ?? '').split('\n').filter((l) => /^\s+at\s/.test(l));
      expect(resultFrames).toEqual(originalFrames);
    });

    it('normalizes PII in error.name to "Error"', () => {
      const original = new Error('API call failed');
      original.name = 'tenant@example.com';
      const result = sanitizeForSentry(original);
      expect(result.name).toBe('Error');
      expect(result.name).not.toContain('@');
    });

    it('preserves allowlisted error names (e.g. TypeError)', () => {
      const original = new TypeError('some internal error');
      const result = sanitizeForSentry(original);
      expect(result.name).toBe('TypeError');
    });

    it('normalizes custom subclass name not in allowlist to "Error"', () => {
      class DatabaseConnectionError extends Error {
        name = 'DatabaseConnectionError';
      }
      const original = new DatabaseConnectionError('host=192.168.1.1 failed');
      const result = sanitizeForSentry(original);
      expect(result.name).toBe('Error');
      expect(result.message).toBe('API error');
    });

    it('multiline message — second line stripped, frames preserved', () => {
      const original = new Error('query failed\nuser@example.com\nmore PII here');
      const result = sanitizeForSentry(original);
      expect(result.message).toBe('API error');
      expect(result.stack).not.toContain('user@example.com');
      expect(result.stack).not.toContain('more PII here');
    });

    it('handles Error with a .code property — keeps stack, uses fixed description', () => {
      const original = new Error('SELECT failed for user@example.com') as Error & { code: string };
      original.code = '23505';
      const result = sanitizeForSentry(original);
      expect(result.message).toBe('23505: unique violation');
      expect(result.message).not.toContain('user@example.com');
      // Stack must not contain the sensitive original message.
      expect(result.stack).not.toContain('user@example.com');
      // Stack frames preserved.
      expect(result.stack).toContain('at ');
    });

    it('Error with unknown .code — returns fixed fallback, never forwards code value', () => {
      const original = new Error('denied for tenant@example.com') as Error & { code: string };
      original.code = 'CUSTOM01';
      const result = sanitizeForSentry(original);
      expect(result.message).toBe('unknown database error');
      expect(result.message).not.toContain('CUSTOM01');
      expect(result.stack).not.toContain('tenant@example.com');
    });

    it('Error with PII as .code value — returns fixed fallback', () => {
      const original = new Error('internal') as Error & { code: string };
      original.code = 'tenant@example.com';
      const result = sanitizeForSentry(original);
      expect(result.message).toBe('unknown database error');
      expect(result.message).not.toContain('tenant@example.com');
    });
  });

  describe('non-Error unknowns', () => {
    it('returns a generic Error for string throws', () => {
      const result = sanitizeForSentry('something went wrong');
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('unknown API error');
    });

    it('returns a generic Error for null', () => {
      const result = sanitizeForSentry(null);
      expect(result.message).toBe('unknown API error');
    });

    it('returns a generic Error for plain object without code', () => {
      const result = sanitizeForSentry({ foo: 'bar' });
      expect(result.message).toBe('unknown API error');
    });
  });
});
