#!/usr/bin/env node
/**
 * Syntax-check Deno edge functions with TypeScript's transpileModule.
 * URL imports (https://deno.land/... https://esm.sh/...) are not resolvable by
 * the local TS toolchain, so this validates syntax only (no type-check).
 *
 * Usage: node scripts/check-deno-functions.mjs [file...]
 * Default: all dirs under supabase/functions/ with an index.ts
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

const args = process.argv.slice(2);
const root = 'supabase/functions';

function discover() {
  const out = [];
  for (const name of readdirSync(root)) {
    const entry = join(root, name, 'index.ts');
    try {
      if (statSync(entry).isFile()) out.push(entry);
    } catch {
      /* not a function dir */
    }
  }
  return out;
}

const files = args.length > 0 ? args : discover();
let bad = 0;

for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const result = ts.transpileModule(src, {
    reportDiagnostics: true,
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const diags = result.diagnostics || [];
  if (diags.length > 0) {
    console.log(`SYNTAX ERR in ${f}`);
    for (const d of diags) console.log(' ', d.code, d.messageText);
    bad++;
  }
}

console.log(bad === 0 ? `ALL ${files.length} DENO FUNCTIONS SYNTAX OK` : `${bad} file(s) with errors`);
process.exit(bad ? 1 : 0);
