/**
 * Tests for centralized env configuration — Sentry DSN gating + RELEASE_VERSION.
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

// Use a mutable variable so each test can inject its own extra config
// without calling jest.mock() inside an it() block (which doesn't hoist reliably).
let mockExtra: Record<string, any> = {};

jest.mock('expo-constants', () => {
  const actual = jest.requireActual('expo-constants');
  return {
    __esModule: true,
    ...actual,
    default: {
      expoConfig: {
        extra: mockExtra,
      },
    },
  };
});

beforeEach(() => {
  jest.resetModules();
  delete process.env.EXPO_PUBLIC_SENTRY_DSN;
  mockExtra = {};
});

it('returns empty string when no DSN is configured anywhere', () => {
  // Constants.expoConfig.extra.sentryDsn is undefined (mocked via mockExtra = {})
  // process.env.EXPO_PUBLIC_SENTRY_DSN is deleted in beforeEach
  const { env } = require('../env');
  expect(env.sentry.dsn).toBe('');
});

it('uses process.env.EXPO_PUBLIC_SENTRY_DSN when set', () => {
  process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://key@test.ingest.sentry.io/123';

  const { env } = require('../env');
  expect(env.sentry.dsn).toBe('https://key@test.ingest.sentry.io/123');
});

// ── RELEASE_VERSION ──────────────────────────────────────────────

describe('RELEASE_VERSION', () => {
  it('falls back to "dev" when not configured in extra', () => {
    // mockExtra is reset to {} in beforeEach
    const { RELEASE_VERSION } = require('../env');
    expect(RELEASE_VERSION).toBe('dev');
  });

  it('returns releaseVersion from Constants.extra when set', () => {
    mockExtra = { releaseVersion: '1.0.0-build.5' };

    const { RELEASE_VERSION } = require('../env');
    expect(RELEASE_VERSION).toBe('1.0.0-build.5');
  });
});
