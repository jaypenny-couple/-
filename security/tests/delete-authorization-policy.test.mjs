import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authorizationFromApproval, sha256Json, validateDeleteAuthorizationApproval } from '../delete-authorization-policy.js';

const securityRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const tool = join(securityRoot, 'manage-delete-authorization.mjs');
const approval = (overrides = {}) => ({ approved: true, projectId: 'pre-order-registration', uid: 'synthetic-uid',
  aliceApp: 'preorder', aliceRole: 'staff', deleteAuthorization: true, approvalRef: 'test-approval',
  approvedBy: 'test-owner', approvedAt: '2026-10-21T00:00:00.000Z', ...overrides });

test('授權政策要求逐人、逐專案、staff 角色及逐動作核准', () => {
  const input = { projectId: 'pre-order-registration', uid: 'synthetic-uid', action: 'grant' };
  assert.equal(validateDeleteAuthorizationApproval(approval(), input), 'preorder');
  assert.throws(() => validateDeleteAuthorizationApproval(approval({ uid: 'other-uid' }), input));
  assert.throws(() => validateDeleteAuthorizationApproval(approval({ projectId: 'restocking-list', aliceApp: 'stock' }), input));
  assert.throws(() => validateDeleteAuthorizationApproval(approval({ aliceRole: 'manager' }), input));
  assert.throws(() => validateDeleteAuthorizationApproval(approval({ deleteAuthorization: false }), input));
  assert.throws(() => validateDeleteAuthorizationApproval(approval(), { ...input, projectId: 'new-customer-management-system' }));
  assert.throws(() => validateDeleteAuthorizationApproval(approval(), { ...input, action: 'revoke' }));
});

test('grant/revoke 產生布林授權狀態並分別符合逐人核准', () => {
  const granted = authorizationFromApproval(approval(), { projectId: 'pre-order-registration', uid: 'synthetic-uid', action: 'grant', changedAt: 10 });
  assert.equal(granted, true);
  const revoked = authorizationFromApproval(approval({ deleteAuthorization: false }),
    { projectId: 'pre-order-registration', uid: 'synthetic-uid', action: 'revoke', changedAt: 20 });
  assert.equal(revoked, false);
  assert.equal(sha256Json(granted), sha256Json(true));
});

test('正式寫入被硬性封鎖，未連本機 Emulator 時工具安全停止', () => {
  const apply = spawnSync(process.execPath, [tool, '--project', 'pre-order-registration', '--uid', 'synthetic-uid', '--action', 'grant', '--apply'],
    { encoding: 'utf8', timeout: 10000, env: { ...process.env, FIREBASE_DATABASE_EMULATOR_HOST: '' } });
  assert.notEqual(apply.status, 0);
  assert.match(apply.stderr, /Authorization writes are disabled/);
  const noEmulator = spawnSync(process.execPath, [tool, '--project', 'restocking-list', '--uid', 'synthetic-uid', '--action', 'status'],
    { encoding: 'utf8', timeout: 10000, env: { ...process.env, FIREBASE_DATABASE_EMULATOR_HOST: '' } });
  assert.notEqual(noEmulator.status, 0);
  assert.match(noEmulator.stderr, /only connects to a localhost Realtime Database Emulator/);
  assert.doesNotMatch(noEmulator.stderr, /Could not load the default credentials/);
});

test('授權管理工具可在 Emulator 產生私有 dry-run 稽核，不寫入 RTDB', async () => {
  assert.match(process.env.FIREBASE_DATABASE_EMULATOR_HOST ?? '', /^(127\.0\.0\.1|localhost):\d+$/);
  const local = await mkdtemp(join(tmpdir(), 'alice-delete-auth-'));
  const privateDir = join(local, 'ALICE-P0-PRIVATE-BACKUPS', 'EMPLOYEE-ACCESS-ACCEPTANCE');
  await mkdir(privateDir, { recursive: true });
  const approvalFile = join(privateDir, 'synthetic-approval.json');
  await writeFile(approvalFile, JSON.stringify(approval()), { flag: 'wx' });
  const env = { ...process.env, LOCALAPPDATA: local };
  const baseArgs = [tool, '--project', 'pre-order-registration', '--uid', 'synthetic-uid'];
  try {
    const grant = spawnSync(process.execPath, [...baseArgs, '--action', 'grant', '--approval-file', approvalFile],
      { encoding: 'utf8', timeout: 15000, env });
    assert.equal(grant.status, 0, grant.stderr);
    assert.match(grant.stdout, /DRY_RUN_OK project=pre-order-registration action=grant/);
    assert.match(grant.stdout, /PRIVATE_AUDIT_WRITTEN/);
    const auditDir = join(privateDir, 'DELETE-AUTH-AUDIT');
    const files = await readdir(auditDir);
    assert.equal(files.length, 1);
    const ledger = JSON.parse(await readFile(join(auditDir, files[0]), 'utf8'));
    assert.equal(ledger.mode, 'dry-run-only');
    assert.equal(ledger.before.exists, false);
    assert.equal(ledger.after.value, true);

    const status = spawnSync(process.execPath, [...baseArgs, '--action', 'status'],
      { encoding: 'utf8', timeout: 15000, env });
    assert.equal(status.status, 0, status.stderr);
    assert.match(status.stdout, /state=ABSENT/);
  } finally {
    await rm(local, { recursive: true, force: true });
  }
});
