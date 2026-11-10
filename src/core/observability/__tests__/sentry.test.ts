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

    it('emits only the code for unknown Postgres codes — drops message', () => {
      const err = { code: 'P0001', message: 'tenant email tenant@example.com already registered' };
      const result = sanitizeForSentry(err);
      expect(result.message).toBe('P0001');
      expect(result.message).not.toContain('tenant@example.com');
    });

    it('emits only the code for unknown codes — no colon-space bypass', () => {
      const err = { code: '00000', message: 'Request failed for user@example.com' };
      const result = sanitizeForSentry(err);
      expect(result.message).toBe('00000');
      expect(result.message).not.toContain('user@example.com');
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

    it('preserves stack frames while replacing the message line', () => {
      const original = new Error('sensitive: SELECT * FROM users WHERE id = user@example.com');
      const result = sanitizeForSentry(original);
      // Stack first line should use the sanitized message.
      expect(result.stack?.split('\n')[0]).toContain('API error');
      // Frames from the original error are preserved.
      const originalFrames = original.stack?.split('\n').slice(1).join('\n') ?? '';
      const resultFrames = result.stack?.split('\n').slice(1).join('\n') ?? '';
      expect(resultFrames).toBe(originalFrames);
    });

    it('preserves the error name for Sentry grouping', () => {
      class CustomError extends Error {
        name = 'CustomError';
      }
      const original = new CustomError('sensitive data here');
      const result = sanitizeForSentry(original);
      expect(result.name).toBe('CustomError');
      expect(result.message).toBe('API error');
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

    it('handles Error with unknown .code — emits code-only, no original message in stack', () => {
      const original = new Error('denied for tenant@example.com') as Error & { code: string };
      original.code = 'CUSTOM01';
      const result = sanitizeForSentry(original);
      expect(result.message).toBe('CUSTOM01');
      expect(result.stack).not.toContain('tenant@example.com');
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
