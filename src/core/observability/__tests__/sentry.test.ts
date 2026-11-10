import { sanitizeForSentry } from '../sentry';

jest.mock('@sentry/react-native', () => ({
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
}));
jest.mock('@/src/core/config/env', () => ({ env: { sentry: { dsn: '' } } }));

describe('sanitizeForSentry', () => {
  describe('Supabase/Postgres structured errors', () => {
    it('emits code + message for allowlisted codes', () => {
      const err = {
        code: '23505',
        message: 'duplicate key value violates constraint "profiles_pkey"',
      };
      const result = sanitizeForSentry(err);
      expect(result.message).toBe('23505: duplicate key value violates constraint "profiles_pkey"');
    });

    it('emits only the code for unknown Postgres codes — drops potentially sensitive message', () => {
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

    it('handles all SAFE_PG_CODES without dropping message', () => {
      const safeCodes = [
        '08006',
        '28000',
        '42501',
        '23502',
        '23503',
        '23505',
        '23514',
        '53100',
        '57014',
      ];
      for (const code of safeCodes) {
        const result = sanitizeForSentry({ code, message: 'constraint "foo"' });
        expect(result.message).toContain(code);
        expect(result.message).toContain('constraint "foo"');
      }
    });
  });

  describe('plain Error objects', () => {
    it('replaces the message but preserves the stack', () => {
      const original = new Error('SELECT failed for id=user@example.com');
      const result = sanitizeForSentry(original);
      expect(result.message).toBe('API error');
      expect(result.message).not.toContain('user@example.com');
      expect(result.stack).toBe(original.stack);
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
