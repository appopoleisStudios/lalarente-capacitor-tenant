// Shared .env loader for dev/diagnostic scripts.
//
// Reads a key from process.env first, then falls back to the project .env
// file (gitignored — never commit real credentials). Returns '' if unset.
//
// Usage:
//   import { env } from './lib/load-env.mjs';
//   const pass = env('EXPO_PUBLIC_PAYFAST_PASSPHRASE');

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.join(__dirname, '..', '..', '.env');

/** Parse .env into a plain object (simple key=value, # comments skipped). */
function parseEnvFile() {
  try {
    const text = fs.readFileSync(ENV_PATH, 'utf8');
    const out = {};
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      // Strip surrounding quotes (double or single) if present.
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

const fileEnv = parseEnvFile();
const MAESTRO_ENV_PATH = path.join(__dirname, '..', '..', '.maestro', '.env');

/** Resolve a value: process.env wins, then .env file, else ''. */
export function env(key) {
  const fromProcess = process.env[key];
  if (fromProcess !== undefined && fromProcess !== '') return fromProcess;
  const fromFile = fileEnv[key];
  if (fromFile !== undefined && fromFile !== '') return fromFile;
  return '';
}

/** Read a single key from an arbitrary env file (e.g. .maestro/.env). */
export function envFromFile(filePath, key) {
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    const m = text.match(new RegExp(`^${key}=(.*)$`, 'm'));
    if (!m) return '';
    let value = m[1].trim();
    // Strip surrounding quotes (double or single) — same as parseEnvFile.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    return value;
  } catch {
    return '';
  }
}

/** E2E login credentials live in the gitignored .maestro/.env. */
export function maestroEnv(key) {
  return envFromFile(MAESTRO_ENV_PATH, key);
}
