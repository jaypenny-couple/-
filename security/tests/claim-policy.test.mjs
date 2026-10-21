import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStaffClaims } from '../staff-claim-policy.js';

const securityRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const claimScript = join(securityRoot, 'assign-staff-claim.mjs');

test('預購與缺貨的身份 Claims 工具拒絕 manager，且不處理刪除授權', () => {
  for (const project of ['pre-order-registration', 'restocking-list']) {
    const result = spawnSync(process.execPath, [claimScript,
      '--project', project, '--uid', 'synthetic-uid', '--role', 'manager'],
    { encoding: 'utf8', timeout: 10000 });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Role is not allowed for this project/);
    assert.doesNotMatch(result.stderr, /Could not load the default credentials/);
  }
  const oldFlag = spawnSync(process.execPath, [claimScript,
    '--project', 'pre-order-registration', '--uid', 'synthetic-uid', '--role', 'staff', '--can-delete', 'true'],
  { encoding: 'utf8', timeout: 10000 });
  assert.notEqual(oldFlag.status, 0);
  assert.match(oldFlag.stderr, /--can-delete has been retired/);
});

test('身份 claims 套用仍停用，更新身份時清除舊 aliceCanDelete', () => {
  const blockedApply = spawnSync(process.execPath, [claimScript,
    '--project', 'new-customer-management-system', '--uid', 'synthetic-uid', '--role', 'manager', '--apply'],
  { encoding: 'utf8', timeout: 10000 });
  assert.notEqual(blockedApply.status, 0);
  assert.match(blockedApply.stderr, /Formal Custom Claims application is disabled/);
  assert.doesNotMatch(blockedApply.stderr, /Could not load the default credentials/);

  const { next } = buildStaffClaims({ aliceApp: 'stock', aliceRole: 'staff', aliceCanDelete: true, unrelated: 'keep' },
    { projectId: 'restocking-list', role: 'staff' });
  assert.deepEqual(next, { unrelated: 'keep', aliceApp: 'stock', aliceRole: 'staff' });
});
