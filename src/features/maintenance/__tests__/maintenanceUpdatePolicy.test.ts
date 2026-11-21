// CT7-071: a "public" maintenance request may be VIEWED by any vendor, but
// only the request's parties may EDIT it. Guards the latest migration that
// defines the update policy against the public clause coming back.
import { readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';

const dir = resolve(__dirname, '../../../../supabase/migrations');
const POLICY = 'create policy "Request parties can update maintenance requests"';

// the last migration that (re)creates the policy is the live definition
const latest = readdirSync(dir)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => ({ f, code: readFileSync(resolve(dir, f), 'utf8').replace(/--.*$/gm, '') }))
  .filter(({ code }) => code.toLowerCase().includes(POLICY.toLowerCase()))
  .pop()!;

const body = latest.code.slice(latest.code.toLowerCase().indexOf(POLICY.toLowerCase()));
const stmt = body.slice(0, body.indexOf(';'));

describe('maintenance_requests update policy (CT7-071)', () => {
  it('is defined by the CT7-071 migration or later', () => {
    expect(latest.f >= '20261121000001').toBe(true);
  });

  it('does not let any signed-in user edit a public request', () => {
    expect(stmt).not.toMatch(/visibility/i);
    expect(stmt).not.toMatch(/\btrue\b/i);
  });

  it('still lets every party edit (owner, tenant, vendor, selected, invited)', () => {
    for (const clause of [
      /owner_id = auth\.uid\(\)/,
      /tenant_id = auth\.uid\(\)/,
      /\bvendor_id = auth\.uid\(\)/,
      /selected_vendor_id = auth\.uid\(\)/,
      /public\.vendor_invited_to_request\(id\)/,
    ]) {
      expect(stmt.match(new RegExp(clause.source, 'g'))?.length).toBe(2); // USING + WITH CHECK
    }
  });
});
