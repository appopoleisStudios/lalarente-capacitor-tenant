#!/usr/bin/env node
/**
 * Release-gate database check, run by run-lifecycle-e2e.sh right after
 * lifecycle-03a (application submitted, holding deposit requested, not paid).
 * CT7-019: as the owner, through RLS, approve_application must be refused
 * while the deposit is unpaid (trigger trg_guard_rental_applications_approved).
 * The app only hides the button; this proves the database enforces it.
 * The refused call rolls back, so nothing is stored.
 */
import { login, call, get, expectRefused } from './fixture-api.mjs';

const PROPERTY = process.env.LC_PROPERTY_ID;
if (!PROPERTY) throw new Error('LC_PROPERTY_ID is required');

const owner = await login('OWNER');
const tenant = await login('TENANT');
const apps = await get(
  owner,
  `rental_applications?select=id,status&property_id=eq.${PROPERTY}&tenant_id=eq.${tenant.id}&status=in.(submitted,under_review)&order=created_at.desc&limit=1`
);
if (apps.length !== 1) throw new Error('setup: no submitted application from the fixture tenant');
const deposits = await get(
  owner,
  `holding_deposits?select=status&application_id=eq.${apps[0].id}&order=created_at.desc&limit=1`
);
if (deposits[0]?.status !== 'pending')
  throw new Error(`setup: expected a pending holding deposit, found ${deposits[0]?.status ?? 'none'}`);

const res = await call(owner, 'POST', 'rpc/approve_application', { app_uuid: apps[0].id });
try {
  expectRefused('CT7-019 approve with an unpaid holding deposit', res, {
    code: 'P0001',
    message: /cannot approve: holding deposit is pending/,
  });
} catch (e) {
  console.error(`✗ ${e.message}`);
  process.exit(1);
}
