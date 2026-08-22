#!/usr/bin/env node
/**
 * Regenerable product inventory. Writes docs/inventory/generated/* phase by phase.
 * Run: node scripts/generate-product-inventory.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs/inventory/generated');

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (['node_modules', '.git', 'dist', 'ios', 'android', '.expo'].includes(ent.name)) continue;
      walk(p, acc);
    } else acc.push(p);
  }
  return acc;
}

function rel(p) {
  return path.relative(ROOT, p).split(path.sep).join('/');
}

function writePhase(name, data) {
  fs.mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, name);
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  process.stdout.write(`wrote ${rel(file)}\n`);
  return data;
}

function read(p) {
  return fs.readFileSync(p, 'utf8');
}

function roleOfAppFile(relPath) {
  const m = relPath.match(/^app\/\((tenant|owner|vendor)\)\//);
  if (m) return m[1];
  if (relPath.startsWith('app/auth/')) return 'auth';
  if (relPath.startsWith('admin/')) return 'admin';
  return 'root';
}

function routeFromAppFile(relPath) {
  return relPath
    .replace(/^app\//, '/')
    .replace(/\/index\.tsx$/, '/')
    .replace(/\.tsx$/, '');
}

// ─── Phase 1: routes ────────────────────────────────────────────────────────
function phaseRoutes() {
  const files = walk(path.join(ROOT, 'app')).filter((p) => p.endsWith('.tsx'));
  const routes = files.map((p) => {
    const r = rel(p);
    const src = read(p);
    const reexport = src.match(/from ['"]([^'"]+)['"]/);
    return {
      file: r,
      route: routeFromAppFile(r),
      role: roleOfAppFile(r),
      isLayout: r.endsWith('_layout.tsx'),
      isSpecial: r.includes('+') || r.endsWith('modal.tsx'),
      reexports: reexport ? reexport[1] : null,
      bytes: src.length,
      lines: src.split('\n').length,
    };
  });
  const admin = walk(path.join(ROOT, 'admin/src/pages'))
    .filter((p) => p.endsWith('.tsx'))
    .map((p) => ({
      file: rel(p),
      route: '/admin/' + path.basename(p, '.tsx'),
      role: 'admin',
      isLayout: false,
      isSpecial: false,
      reexports: null,
      bytes: fs.statSync(p).size,
      lines: read(p).split('\n').length,
    }));
  return writePhase('01-routes.json', {
    generatedAt: new Date().toISOString(),
    counts: {
      appTsx: files.length,
      byRole: [...routes, ...admin].reduce((acc, x) => {
        acc[x.role] = (acc[x.role] || 0) + 1;
        return acc;
      }, {}),
    },
    routes: [...routes, ...admin].sort((a, b) => a.route.localeCompare(b.route)),
  });
}

// ─── Phase 2: screens ───────────────────────────────────────────────────────
function phaseScreens() {
  const files = walk(path.join(ROOT, 'src/features'))
    .filter((p) => /\/screens\/[^/]+\.tsx$/.test(p))
    .sort();
  const screens = files.map((p) => {
    const r = rel(p);
    const feat = r.split('/')[2];
    const src = read(p);
    return {
      file: r,
      feature: feat,
      name: path.basename(p, '.tsx'),
      lines: src.split('\n').length,
      defaultExport: /export default/.test(src),
    };
  });
  return writePhase('02-screens.json', {
    count: screens.length,
    byFeature: screens.reduce((acc, s) => {
      acc[s.feature] = (acc[s.feature] || 0) + 1;
      return acc;
    }, {}),
    screens,
  });
}

// ─── Phase 3: taps + nav edges ──────────────────────────────────────────────
function extractFromSource(src, file) {
  const testIds = [...src.matchAll(/testID=["']([^"']+)["']/g)].map((m) => m[1]);
  const pushes = [
    ...src.matchAll(/router\.(push|replace|back|navigate)\(([^)]*)\)/g),
  ].map((m) => ({ op: m[1], raw: m[2].slice(0, 180).replace(/\s+/g, ' ') }));
  const hrefs = [...src.matchAll(/href:\s*(null|['"`][^'"`]+['"`])/g)].map((m) => m[1]);
  const textInputs = [...src.matchAll(/<TextInput\b/g)].length;
  const switches = [...src.matchAll(/<Switch\b/g)].length;
  const pressables = [...src.matchAll(/<(TouchableOpacity|Pressable|AnimatedButton)\b/g)].length;
  const onPress = [...src.matchAll(/onPress=/g)].length;
  const emptyOnPress = [...src.matchAll(/onPress=\{\s*\(\)\s*=>\s*\{\s*\}\s*\}/g)].length;
  const alerts = [...src.matchAll(/Alert\.alert\(/g)].length;
  return {
    file,
    testIds,
    testIdCount: testIds.length,
    nav: pushes,
    hrefs,
    textInputs,
    switches,
    pressables,
    onPress,
    emptyOnPress,
    alerts,
  };
}

function phaseTaps() {
  const scanDirs = [
    path.join(ROOT, 'app'),
    path.join(ROOT, 'src/features'),
    path.join(ROOT, 'src/shared'),
  ];
  const files = scanDirs.flatMap((d) => walk(d).filter((p) => p.endsWith('.tsx')));
  const taps = files.map((p) => extractFromSource(read(p), rel(p)));
  const totals = taps.reduce(
    (a, t) => ({
      textInputs: a.textInputs + t.textInputs,
      switches: a.switches + t.switches,
      pressables: a.pressables + t.pressables,
      onPress: a.onPress + t.onPress,
      emptyOnPress: a.emptyOnPress + t.emptyOnPress,
      testIds: a.testIds + t.testIdCount,
      navOps: a.navOps + t.nav.length,
      alerts: a.alerts + t.alerts,
    }),
    {
      textInputs: 0,
      switches: 0,
      pressables: 0,
      onPress: 0,
      emptyOnPress: 0,
      testIds: 0,
      navOps: 0,
      alerts: 0,
    }
  );
  writePhase('03-taps.json', { totals, files: taps.filter((t) => t.onPress + t.textInputs + t.nav.length > 0) });

  const edges = [];
  for (const t of taps) {
    for (const n of t.nav) {
      edges.push({ from: t.file, op: n.op, toRaw: n.raw });
    }
  }
  writePhase('04-nav-edges.json', { count: edges.length, edges });

  const testIdIndex = {};
  for (const t of taps) {
    for (const id of t.testIds) {
      (testIdIndex[id] ||= []).push(t.file);
    }
  }
  writePhase('07-testids.json', {
    unique: Object.keys(testIdIndex).length,
    duplicates: Object.entries(testIdIndex)
      .filter(([, files]) => files.length > 1)
      .map(([id, files]) => ({ id, files })),
    index: testIdIndex,
  });
  return taps;
}

// ─── Phase 4: APIs ──────────────────────────────────────────────────────────
function phaseApis() {
  const files = walk(path.join(ROOT, 'src/features')).filter((p) => p.endsWith('.api.ts') || p.endsWith('Api.ts'));
  const allSrc = walk(path.join(ROOT, 'src'))
    .filter((p) => p.endsWith('.ts') || p.endsWith('.tsx'))
    .map((p) => ({ file: rel(p), src: read(p) }));

  const apis = [];
  for (const p of files) {
    const src = read(p);
    const names = new Set();
    for (const m of src.matchAll(/^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)/gm)) names.add(m[1]);
    for (const m of src.matchAll(/^\s*(?:export\s+)?(?:async\s+)?(\w+)\s*\(/gm)) {
      if (!['if', 'for', 'while', 'switch', 'catch', 'function'].includes(m[1])) names.add(m[1]);
    }
    for (const m of src.matchAll(/async\s+(\w+)\s*\(/g)) names.add(m[1]);
    const fileRel = rel(p);
    const methods = [...names].sort().map((name) => {
      let callers = 0;
      const callerFiles = [];
      const re = new RegExp(`\\b${name}\\b`);
      for (const other of allSrc) {
        if (other.file === fileRel) continue;
        if (re.test(other.src)) {
          callers += 1;
          callerFiles.push(other.file);
        }
      }
      return { name, callers, callerFiles: callerFiles.slice(0, 20) };
    });
    apis.push({ file: fileRel, methodCount: methods.length, methods });
  }

  const orphans = apis.flatMap((a) =>
    a.methods
      .filter((m) => m.callers === 0 && !['default'].includes(m.name))
      .map((m) => ({ file: a.file, method: m.name }))
  );

  const edgeFns = walk(path.join(ROOT, 'supabase/functions'))
    .filter((p) => p.endsWith('index.ts'))
    .map((p) => rel(path.dirname(p)));

  return writePhase('05-apis.json', {
    apiFiles: apis.length,
    edgeFunctions: edgeFns,
    orphanMethods: orphans,
    apis,
  });
}

// ─── Phase 5: stubs / sleepers ──────────────────────────────────────────────
const SLEEPER_PATTERNS = [
  { id: 'todo-integrate', re: /TODO:.*Integrat/gi },
  { id: 'coming-soon', re: /coming soon/gi },
  { id: 'not-implemented', re: /not implemented/gi },
  { id: 'tpn', re: /\bTPN\b/g },
  { id: 'transunion', re: /TransUnion/gi },
  { id: 'onfido', re: /Onfido/gi },
  { id: 'smile-identity', re: /Smile Identity/gi },
  { id: 'signiflow', re: /SigniFlow/gi },
  { id: 'payprop', re: /PayProp/gi },
  { id: 'entegral', re: /Entegral/gi },
  { id: 'background-check', re: /background_check|initiateBackgroundCheck|Background Check/g },
  { id: 'credit-check', re: /credit_check|initiateCreditCheck|Credit Check/g },
  { id: 'identity-verify', re: /identity_verification|verifyIdentity/g },
];

function phaseSleepers() {
  const files = walk(path.join(ROOT, 'src'))
    .concat(walk(path.join(ROOT, 'docs')))
    .concat(walk(path.join(ROOT, 'supabase')))
    .filter((p) => /\.(ts|tsx|js|mjs|md|sql)$/.test(p));
  const hits = [];
  for (const p of files) {
    const src = read(p);
    const r = rel(p);
    for (const pat of SLEEPER_PATTERNS) {
      const matches = src.match(pat.re);
      if (matches) hits.push({ file: r, signal: pat.id, count: matches.length });
    }
  }
  return writePhase('06-stubs-todos.json', { hitCount: hits.length, hits });
}

// ─── Phase 6: loop multipliers (known generated UIs) ────────────────────────
function phaseLoops() {
  const inspectionTypes = path.join(ROOT, 'src/features/inspections/types/index.ts');
  let roomItemCount = 0;
  let rooms = [];
  if (fs.existsSync(inspectionTypes)) {
    const src = read(inspectionTypes);
    const block = src.match(/export const ROOM_ITEMS[\s\S]*?\n\};/);
    rooms = [...src.matchAll(/'([^']+)'/g)]
      .map((m) => m[1])
      .filter((s) =>
        [
          'Living Room',
          'Kitchen',
          'Main Bedroom',
          'Bedroom 2',
          'Bedroom 3',
          'Bathroom 1',
          'Bathroom 2',
          'Garage',
          'Garden/Yard',
          'Entrance/Hallway',
        ].includes(s)
      );
    const uniqueRooms = [...new Set(rooms)];
    if (block) {
      const items = [...block[0].matchAll(/'([^']+)'/g)].map((m) => m[1]);
      roomItemCount = items.length - uniqueRooms.length;
    }
    rooms = uniqueRooms;
  }
  const complianceKeys = ['eoc', 'gas', 'rates', 'insurance', 'fica', 'popia'];
  return writePhase('09-loop-multipliers.json', {
    note: 'Static JSX under-counts these. Multiply per entity (property, tenant, job).',
    inspection: {
      rooms: rooms.length,
      checklistItems: roomItemCount,
      conditionChipsPerItem: 5,
      photoRequiredPerRoom: true,
      types: ['move_in', 'periodic', 'move_out'],
      conservativeTapsPerConduct:
        roomItemCount * 1 + rooms.length * 6 + 15,
    },
    complianceCertsPerProperty: complianceKeys,
    ficaModulesPerTenant: ['identity', 'credit', 'background'],
    applicationWizardSteps: ['Personal', 'Employment', 'Documents', 'Review'],
  });
}

// ─── Phase 7: parity matrix from routes ─────────────────────────────────────
function phaseParity(routeData) {
  const families = [
    { family: 'dashboard', t: 'dashboard', o: 'dashboard', v: 'dashboard' },
    { family: 'profile', t: 'profile', o: 'profile', v: 'profile/index' },
    { family: 'ai-chat', t: 'ai-chat', o: 'ai-chat', v: 'ai-chat' },
    { family: 'messages', t: 'messages', o: 'messages', v: 'messages' },
    { family: 'notifications', t: 'notifications', o: 'notifications', v: 'notifications' },
    { family: 'privacy', t: 'privacy', o: 'privacy', v: 'privacy' },
    { family: 'dsar', t: 'privacy/data-rights', o: 'privacy/data-rights', v: 'privacy/data-rights' },
    { family: 'maintenance-list', t: 'maintenance', o: 'maintenance', v: 'maintenance' },
    { family: 'maintenance-detail', t: 'maintenance/[id]', o: 'maintenance/[id]', v: 'maintenance/[id]' },
    { family: 'quote-new', t: null, o: null, v: 'maintenance/[id]/quote/new' },
    { family: 'quote-detail', t: null, o: 'maintenance/[id]/quote/[quoteId]', v: 'maintenance/[id]/quote/[quoteId]' },
    { family: 'po', t: null, o: 'maintenance/[id]/po/[poId]', v: 'maintenance/[id]/po/[poId]' },
    { family: 'inspections', t: 'inspections/[id]', o: 'inspections', v: null },
    { family: 'reports', t: 'reports', o: 'tax-reports', v: null },
    { family: 'documents', t: 'documents', o: 'documents', v: 'profile/documents' },
    { family: 'payments-rent', t: 'payments', o: 'rent-roll', v: null },
    { family: 'vendor-pay-earnings', t: 'vendor-payments/index', o: 'invoices', v: 'earnings/index' },
    { family: 'lease', t: 'lease', o: 'leases/[id]', v: null },
    { family: 'applications', t: 'apply/[propertyId]', o: 'applications', v: null },
    { family: 'viewings', t: 'viewings', o: 'viewings', v: null },
    { family: 'arrears', t: 'arrears', o: 'arrears', v: null },
    { family: 'disputes', t: 'payment-disputes', o: 'payment-disputes', v: null },
    { family: 'early-termination', t: 'early-termination', o: 'early-termination', v: null },
    { family: 'holding-deposit', t: 'holding-deposit', o: 'holding-deposit', v: null },
    { family: 'deposit', t: 'deposit', o: 'deposits', v: null },
    { family: 'renewals', t: 'lease-renewal', o: 'renewals', v: null },
    { family: 'compliance', t: null, o: 'compliance', v: null },
    { family: 'insurance', t: null, o: 'insurance', v: null },
    { family: 'contracts', t: null, o: null, v: 'contracts/index' },
    { family: 'jobs', t: null, o: null, v: 'jobs/index' },
    { family: 'search-listings', t: 'search', o: 'properties', v: null },
    { family: '3d-tour', t: 'properties/[id]/view3d', o: 'properties/[id]/view3d', v: null },
    { family: 'fica-kyc-display', t: 'documents', o: 'compliance', v: null },
  ];
  const fileHas = (role, rest) => {
    if (!rest) return '—';
    return routeData.routes.some(
      (r) =>
        r.role === role &&
        (r.file === `app/(${role})/${rest}.tsx` || r.file === `app/(${role})/${rest}/index.tsx`)
    )
      ? 'yes'
      : 'no';
  };
  const rows = families.map((f) => ({
    family: f.family,
    tenant: fileHas('tenant', f.t),
    owner: fileHas('owner', f.o),
    vendor: fileHas('vendor', f.v),
  }));
  return writePhase('08-parity.json', { rows });
}

// ─── Phase 8: markdown index (from JSON only) ───────────────────────────────
function phaseIndex(routeData, apiData, loopData, sleeperData) {
  const byRole = {};
  for (const r of routeData.routes) {
    if (r.isLayout || r.isSpecial) continue;
    (byRole[r.role] ||= []).push(r.route);
  }
  const sleeperTop = {};
  for (const h of sleeperData.hits) {
    sleeperTop[h.signal] = (sleeperTop[h.signal] || 0) + h.count;
  }
  const md = [];
  md.push('# Generated inventory index');
  md.push('');
  md.push(`Generated: ${routeData.generatedAt}`);
  md.push('');
  md.push('Do not edit by hand. Re-run `node scripts/generate-product-inventory.mjs`.');
  md.push('');
  md.push('## Route counts');
  md.push('');
  md.push('| Role | Leaf routes |');
  md.push('|------|-------------|');
  for (const [k, v] of Object.entries(byRole)) {
    md.push(`| ${k} | ${v.length} |`);
  }
  md.push('');
  md.push('## Full route tree');
  md.push('');
  for (const [k, v] of Object.entries(byRole)) {
    md.push(`### ${k}`);
    md.push('');
    for (const route of v.sort()) md.push(`- \`${route}\``);
    md.push('');
  }
  md.push('## API orphans (defined, zero callers outside file)');
  md.push('');
  for (const o of apiData.orphanMethods.slice(0, 80)) {
    md.push(`- \`${o.method}\` — ${o.file}`);
  }
  if (apiData.orphanMethods.length > 80) md.push(`- … +${apiData.orphanMethods.length - 80} more`);
  md.push('');
  md.push('## Sleeper signal totals');
  md.push('');
  for (const [k, n] of Object.entries(sleeperTop).sort((a, b) => b[1] - a[1])) {
    md.push(`- **${k}**: ${n}`);
  }
  md.push('');
  md.push('## Loop multipliers');
  md.push('');
  md.push('```json');
  md.push(JSON.stringify(loopData, null, 2));
  md.push('```');
  md.push('');
  const indexPath = path.join(OUT, 'INDEX.md');
  fs.writeFileSync(indexPath, md.join('\n'));
  process.stdout.write(`wrote ${rel(indexPath)}\n`);
}

function main() {
  const routeData = phaseRoutes();
  phaseScreens();
  phaseTaps();
  const apiData = phaseApis();
  const sleeperData = phaseSleepers();
  const loopData = phaseLoops();
  phaseParity(routeData);
  phaseIndex(routeData, apiData, loopData, sleeperData);
}

main();
