// CT7-066: the database must enforce the same "lease in effect" rule as the
// app's Report Issue gate. This guards the migration against drifting from
// LEASE_IN_EFFECT_STATUSES and against being weakened to a permissive policy.
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { LEASE_IN_EFFECT_STATUSES } from '../utils/leaseInEffect';

const sql = readFileSync(
  resolve(
    __dirname,
    '../../../../supabase/migrations/20261120000001_ct7_066_maintenance_insert_requires_lease.sql'
  ),
  'utf8'
);
// strip comments so the rollback text and notes can't satisfy the checks
const code = sql.replace(/--.*$/gm, '');

describe('maintenance_requests insert policy (CT7-066)', () => {
  it('uses exactly the app lease-in-effect statuses', () => {
    const m = code.match(/l\.status in \(([^)]*)\)/);
    expect(m).not.toBeNull();
    const statuses = m![1].split(',').map((s) => s.trim().replace(/^'|'$/g, ''));
    expect(statuses.sort()).toEqual([...LEASE_IN_EFFECT_STATUSES].sort());
  });

  it('is a RESTRICTIVE insert policy (a permissive one would be OR-ed away)', () => {
    expect(code).toMatch(
      /create policy mr_insert_reporter_must_have_standing\s+on public\.maintenance_requests\s+as restrictive\s+for insert\s+to authenticated\s+with check \(public\.may_report_maintenance\(property_id, owner_id, tenant_id\)\)/
    );
  });

  it('tenant branch: own lease, same property, that property owner', () => {
    expect(code).toMatch(/p_tenant_id = auth\.uid\(\)/);
    expect(code).toMatch(/l\.tenant_id = auth\.uid\(\)/);
    expect(code).toMatch(/l\.property_id = p_property_id/);
    expect(code).toMatch(/p\.owner_id = p_owner_id/);
  });

  it('owner branch: only on a property they own', () => {
    expect(code).toMatch(
      /p_owner_id = auth\.uid\(\)\s+and exists \(\s+select 1 from properties p\s+where p\.id = p_property_id and p\.owner_id = auth\.uid\(\)/
    );
  });

  it('helper is security definer with a fixed search_path and not executable by anon', () => {
    expect(code).toMatch(/security definer\s+set search_path = public/);
    expect(code).toMatch(
      /revoke all on function public\.may_report_maintenance\(uuid, uuid, uuid\) from public/
    );
  });
});
