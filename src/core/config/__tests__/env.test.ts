/**
 * Tests for centralized env configuration — Sentry DSN gating.
 *
 * The core gating mechanism (app/_layout.tsx) is:
 *   if (env.sentry.dsn) { Sentry.init({ dsn: env.sentry.dsn }) }
 *
 * These tests verify that env.sentry.dsn correctly returns the configured value
 * or an empty string based on available environment sources.
 */
import Constants from 'expo-constants';

// Constants.expoConfig?.extra may be unavailable in Jest, but we test the
// remaining value sources independently.

jest.mock('expo-constants', () => {
  const actual = jest.requireActual('expo-constants');
  return {
    __esModule: true,
    ...actual,
    default: {
      expoConfig: {
        extra: {},
      },
    },
  };
});

beforeEach(() => {
  jest.resetModules();
  delete process.env.EXPO_PUBLIC_SENTRY_DSN;
});

it('returns empty string when no DSN is configured anywhere', () => {
  // Constants.expoConfig.extra.sentryDsn is undefined (mocked above)
  // process.env.EXPO_PUBLIC_SENTRY_DSN is deleted in beforeEach
  const { env } = require('../env');
  expect(env.sentry.dsn).toBe('');
});

it('uses process.env.EXPO_PUBLIC_SENTRY_DSN when set', () => {
  process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://key@test.ingest.sentry.io/123';

  const { env } = require('../env');
  expect(env.sentry.dsn).toBe('https://key@test.ingest.sentry.io/123');
});
