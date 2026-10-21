import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStaffClaims, validateDeletionApproval } from '../staff-claim-policy.js';

const securityRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const claimScript = join(securityRoot, 'assign-staff-claim.mjs');

test('預購與缺貨的 Custom Claims 核發工具拒絕不必要的 manager claim', () => {
  for (const project of ['pre-order-registration', 'restocking-list']) {
    const result = spawnSync(process.execPath, [claimScript,
      '--project', project, '--uid', 'synthetic-uid', '--role', 'manager'],
    { encoding: 'utf8', timeout: 10000 });
    assert.notEqual(result.status, 0, `${project} must reject manager`);
    assert.match(result.stderr, /Role is not allowed for this project/);
    assert.doesNotMatch(result.stderr, /Could not load the default credentials/);
  }
});

test('預購／缺貨需明確刪除旗標；本階段任何正式 Claims 套用均停用', () => {
  const missingFlag = spawnSync(process.execPath, [claimScript,
    '--project', 'restocking-list', '--uid', 'synthetic-uid', '--role', 'staff'],
  { encoding: 'utf8', timeout: 10000 });
  assert.notEqual(missingFlag.status, 0);
  assert.match(missingFlag.stderr, /explicit --can-delete/);
  const blockedApply = spawnSync(process.execPath, [claimScript,
    '--project', 'new-customer-management-system', '--uid', 'synthetic-uid', '--role', 'manager', '--apply'],
  { encoding: 'utf8', timeout: 10000 });
  assert.notEqual(blockedApply.status, 0);
  assert.match(blockedApply.stderr, /Formal Custom Claims application is disabled/);
  assert.doesNotMatch(blockedApply.stderr, /Could not load the default credentials/);
});

test('刪除 claim 僅依專案逐人核准；撤銷時清除舊值且不跨專案沿用', () => {
  const projectId = 'pre-order-registration';
  const uid = 'synthetic-preorder-uid';
  const request = { projectId, role: 'staff', canDelete: true };
  const approval = {
    approved: true, projectId, uid, aliceApp: 'preorder', aliceRole: 'staff', aliceCanDelete: true,
    approvalRef: 'synthetic-owner-approval', approvedBy: 'synthetic-owner', approvedAt: '2026-10-21T00:00:00Z'
  };
  assert.doesNotThrow(() => validateDeletionApproval(approval, { ...request, uid, app: 'preorder' }));
  assert.throws(() => validateDeletionApproval(approval, { ...request, uid: 'another-uid', app: 'preorder' }), /individually approved/);
  assert.throws(() => validateDeletionApproval(approval, { ...request, projectId: 'restocking-list', uid, app: 'stock' }), /individually approved/);
  const active = buildStaffClaims({ aliceApp: 'preorder', aliceRole: 'staff', aliceCanDelete: false, unrelated: 'keep' }, request);
  assert.deepEqual(active.next, { unrelated: 'keep', aliceApp: 'preorder', aliceRole: 'staff', aliceCanDelete: true });
  const revoked = buildStaffClaims({ aliceApp: 'preorder', aliceRole: 'staff', aliceCanDelete: true }, { projectId, role: 'staff', canDelete: false });
  assert.deepEqual(revoked.next, { aliceApp: 'preorder', aliceRole: 'staff' });
  assert.throws(() => buildStaffClaims({ aliceCanDelete: true }, { projectId: 'new-customer-management-system', role: 'manager', canDelete: true }), /only valid for preorder and stock/);
  assert.throws(() => buildStaffClaims({}, { projectId: 'restocking-list', role: 'staff' }), /explicit --can-delete/);
});
