#!/usr/bin/env node
/**
 * Overlay: app routes × Maestro yaml mentions × router.push edges.
 * A route is PROVEN only if a Maestro flow in the full suite taps something on that screen.
 * Everything else is UNPROVEN (code may exist and still be dead).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GEN = path.join(ROOT, 'docs/inventory/generated');

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

function loadJson(name) {
  return JSON.parse(fs.readFileSync(path.join(GEN, name), 'utf8'));
}

function main() {
  const routes = loadJson('01-routes.json').routes.filter((r) => !r.isLayout && !r.isSpecial);
  const testIds = loadJson('07-testids.json').index;
  const suite = fs.readFileSync(path.join(ROOT, 'scripts/run-full-e2e-suite.sh'), 'utf8');
  const suiteFlows = [...suite.matchAll(/"([a-z0-9./-]+)"/gi)]
    .map((m) => m[1])
    .filter((s) => fs.existsSync(path.join(ROOT, '.maestro/flows', `${s}.yaml`)));

  const yamlFiles = walk(path.join(ROOT, '.maestro/flows')).filter((p) => p.endsWith('.yaml'));
  const maestroText = yamlFiles.map((p) => fs.readFileSync(p, 'utf8')).join('\n');
  const maestroIds = new Set([...maestroText.matchAll(/id:\s*"([^"]+)"/g)].map((m) => m[1]));
  const openLinks = [...maestroText.matchAll(/openLink:\s*(\S+)/g)].map((m) => m[1]);

  const inSuite = new Set(suiteFlows);

  const rows = routes.map((r) => {
    const fileIds = Object.entries(testIds)
      .filter(([, files]) => files.some((f) => f === r.file || f.includes(r.reexports || '___')))
      .map(([id]) => id);
    // also match screen file from reexport
    const reex = r.reexports || '';
    const screenIds = Object.entries(testIds)
      .filter(([, files]) => files.some((f) => reex && f.includes(reex.replace('@/', ''))))
      .map(([id]) => id);
    const ids = [...new Set([...fileIds, ...screenIds])];
    const provenIds = ids.filter((id) => maestroIds.has(id));
    const linkHit = openLinks.some((l) => l.includes(r.route.replace('/(tenant)', '').replace('/(owner)', '').replace('/(vendor)', '')));
    let proof = 'UNPROVEN';
    if (provenIds.length > 0 || linkHit) proof = 'MAESTRO_TOUCHES';
    if (ids.length === 0 && !linkHit) proof = 'NO_TESTID';
    return {
      role: r.role,
      route: r.route,
      file: r.file,
      testIds: ids,
      maestroTouchesIds: provenIds,
      deepLinkInMaestro: linkHit,
      proof,
    };
  });

  const summary = {
    routes: rows.length,
    maestroTouches: rows.filter((x) => x.proof === 'MAESTRO_TOUCHES').length,
    noTestId: rows.filter((x) => x.proof === 'NO_TESTID').length,
    unproven: rows.filter((x) => x.proof === 'UNPROVEN').length,
    suiteFlowCount: inSuite.size,
    yamlFlowCount: yamlFiles.length,
  };

  fs.writeFileSync(path.join(GEN, '10-maestro-vs-routes.json'), JSON.stringify({ summary, rows }, null, 2) + '\n');

  const md = [];
  md.push('# Maestro vs screens (generated)');
  md.push('');
  md.push('PROVEN here only means a Maestro yaml **mentions** a testID or deep-link for that route.');
  md.push('It does **not** mean the last run passed. Re-run Maestro to know if the phone works.');
  md.push('');
  md.push(`| Routes | Maestro mentions | No testID | Unproven (has testID, no Maestro) |`);
  md.push(`|--------|------------------|-----------|-----------------------------------|`);
  md.push(`| ${summary.routes} | ${summary.maestroTouches} | ${summary.noTestId} | ${summary.unproven} |`);
  md.push('');
  md.push('## Unproven (testID exists, no Maestro file uses it)');
  md.push('');
  for (const r of rows.filter((x) => x.proof === 'UNPROVEN')) {
    md.push(`- \`${r.route}\` — ids: ${r.testIds.join(', ') || '—'}`);
  }
  md.push('');
  md.push('## No testID (Maestro cannot target the screen)');
  md.push('');
  for (const r of rows.filter((x) => x.proof === 'NO_TESTID' && ['tenant', 'owner', 'vendor'].includes(x.role))) {
    md.push(`- \`${r.route}\``);
  }
  fs.writeFileSync(path.join(GEN, 'MAESTRO-COVERAGE.md'), md.join('\n'));
  console.log(JSON.stringify(summary, null, 2));
  console.log('wrote docs/inventory/generated/10-maestro-vs-routes.json');
  console.log('wrote docs/inventory/generated/MAESTRO-COVERAGE.md');
}

main();
