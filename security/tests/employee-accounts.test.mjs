import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyAccountRecord, buildEmployeeRows, parseCsv, parseCsvDocument, selectAccountRow, serializeCsv, summarizeEmployeeRoster
} from '../employee-approval-policy.js';
import { mergeEmployeeRows } from '../employee-rows.mjs';
import { recordAccount } from '../email-verification-record.mjs';
import { validatePlan } from '../claims-apply.mjs';

const securityDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const projects = ['new-customer-management-system', 'pre-order-registration', 'restocking-list', 'hr-system-ad937'];
const headers = ['RecordType', 'InternalRef', 'FirebaseProject', 'SystemRole', 'DesignerCode', 'ApprovedEmail', 'JobDuties',
  'MinimumAccess', 'AccountDisableOwner', 'AccountCreationApproval', 'OwnerApproval', 'ManagerDutiesJustification',
  'AccountUID', 'AccountStatus', 'EmailVerificationStatus', 'Notes'];
const ownerEmail = 'owner.synthetic@gmail.com';

function ownerRoster() {
  const rows = [{ RecordType: 'ROLE-TEMPLATE', FirebaseProject: 'restocking-list', SystemRole: 'staff', Notes: '範本' }];
  projects.forEach((projectId, i) => rows.push({
    RecordType: 'OWNER-PILOT', InternalRef: 'OWNER', FirebaseProject: projectId, SystemRole: i === 0 || i === 3 ? 'manager' : 'staff',
    ApprovedEmail: ownerEmail, JobDuties: 'owner', MinimumAccess: 'x', AccountDisableOwner: 'JAY', AccountCreationApproval: 'APPROVED',
    OwnerApproval: 'APPROVED', ManagerDutiesJustification: 'owner duties', AccountUID: `OwnerUid00000000${i}`, AccountStatus: 'ENABLED',
    EmailVerificationStatus: 'VERIFIED-CLIENT-SDK-2026-10-26', Notes: '"含引號",逗號'
  }));
  return rows;
}

test('員工帳號列：Gmail +別名、角色與設計師代碼正確；拒絕非 Gmail 與未核准代碼', () => {
  const built = buildEmployeeRows({ ownerEmail, persons: ['iris', 'CINDY', 'SHERRY'], approvedOn: '2026-10-27' });
  assert.equal(built.length, 9);
  assert.deepEqual([...new Set(built.map(r => r.ApprovedEmail))],
    ['owner.synthetic+iris@gmail.com', 'owner.synthetic+cindy@gmail.com', 'owner.synthetic+sherry@gmail.com']);
  const iris = built.filter(r => r.InternalRef === 'IRIS');
  assert.deepEqual(iris.map(r => [r.FirebaseProject, r.SystemRole, r.DesignerCode]), [
    ['new-customer-management-system', 'designer', 'IRIS'], ['pre-order-registration', 'staff', ''], ['restocking-list', 'staff', '']]);
  assert.ok(built.every(r => r.FirebaseProject !== 'hr-system-ad937'), 'HR stays owner-only');
  assert.throws(() => buildEmployeeRows({ ownerEmail: 'owner@example.com', persons: ['IRIS'], approvedOn: '2026-10-27' }), /Gmail/);
  assert.throws(() => buildEmployeeRows({ ownerEmail, persons: ['MALLORY'], approvedOn: '2026-10-27' }), /designer code/);
});

test('名單合併：缺欄位拒絕、新增 9 列、重跑不變、資料不同或信箱衝突即停止', () => {
  const built = buildEmployeeRows({ ownerEmail, persons: ['IRIS', 'CINDY', 'SHERRY'], approvedOn: '2026-10-27' });
  assert.throws(() => mergeEmployeeRows(headers.filter(h => h !== 'DesignerCode'), ownerRoster(), built), e => e.missingColumns?.includes('DesignerCode'));
  const first = mergeEmployeeRows(headers, ownerRoster(), built);
  assert.equal(first.added, 9);
  assert.deepEqual(first.rows.slice(0, 5), ownerRoster(), 'existing rows unchanged');
  const again = mergeEmployeeRows(headers, first.rows, built);
  assert.equal(again.added, 0);
  assert.equal(again.unchanged, 9);
  const changed = first.rows.map(r => r.InternalRef === 'IRIS' && r.FirebaseProject === 'restocking-list' ? { ...r, SystemRole: 'manager' } : r);
  assert.throws(() => mergeEmployeeRows(headers, changed, built), /different approval data/);
  const collide = ownerRoster().map(r => r.FirebaseProject === 'restocking-list' ? { ...r, ApprovedEmail: 'owner.synthetic+iris@gmail.com' } : r);
  assert.throws(() => mergeEmployeeRows(headers, collide, built), /already used/);

  const summary = summarizeEmployeeRoster(first.rows);
  assert.equal(summary.duplicateEmailProjectCount, 0);
  assert.equal(summary.roleConflictCount, 0);
  assert.equal(summary.designerCodeIssueCount, 0);
  assert.equal(summary.employees.length, 9);
  assert.ok(summary.employees.every(e => e.missingBeforeAccount.length === 0 && e.pendingAuthorization.length === 0));
  assert.ok(summary.employees.every(e => e.missingAfterAccount.includes('AccountUID')));
});

test('員工列選取與 UID 寫回只動該員工該專案一列；Claims 前態檔記錄 UID', async () => {
  const rows = mergeEmployeeRows(headers, ownerRoster(), buildEmployeeRows({ ownerEmail, persons: ['IRIS', 'CINDY'], approvedOn: '2026-10-27' })).rows;
  assert.equal(selectAccountRow(rows, 'restocking-list').RecordType, 'OWNER-PILOT');
  assert.equal(selectAccountRow(rows, 'restocking-list', 'iris').InternalRef, 'IRIS');
  assert.throws(() => selectAccountRow(rows, 'hr-system-ad937', 'IRIS'), /employee row/);

  const dir = await mkdtemp(join(tmpdir(), 'alice-employee-'));
  try {
    const mainCsvPath = join(dir, 'main.csv');
    const text = serializeCsv(headers, rows, { bom: true, quoteAll: true });
    await writeFile(mainCsvPath, text);
    const mergedRow = selectAccountRow(parseCsv(text), 'new-customer-management-system', 'IRIS');
    const account = { uid: 'IrisUid1234567890', signedInEmail: 'OWNER.SYNTHETIC+IRIS@gmail.com', emailVerified: true, customClaims: {} };
    assert.throws(() => applyAccountRecord(parseCsv(text), { projectId: 'new-customer-management-system', person: 'CINDY', mergedRow,
      signedInEmail: account.signedInEmail, uid: account.uid, emailVerified: true, checkedOn: '2026-10-27' }), /does not match the row being updated/);
    const outcome = await recordAccount({ privateFolder: dir, mainCsvPath, mainCsvBuffer: Buffer.from(text), projectId: 'new-customer-management-system',
      person: 'IRIS', mergedRow, account, checkedOn: '2026-10-27' });
    assert.equal(outcome.status, 'recorded');
    const after = parseCsvDocument(await readFile(mainCsvPath, 'utf8'));
    const before = parseCsvDocument(text);
    const changed = after.rows.flatMap((row, i) => headers.filter(h => row[h] !== before.rows[i][h]).map(h => `${row.InternalRef}/${row.FirebaseProject}/${h}`));
    assert.deepEqual(changed.sort(), ['IRIS/new-customer-management-system/AccountStatus', 'IRIS/new-customer-management-system/AccountUID',
      'IRIS/new-customer-management-system/EmailVerificationStatus']);
    const beforeFile = (await readdir(dir)).find(f => f.startsWith('CLAIMS-BEFORE-new-customer-management-system-IRIS-'));
    assert.equal(JSON.parse(await readFile(join(dir, beforeFile), 'utf8')).uid, account.uid);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('本機工具端對端：新增員工列（備份、確認字串）→ 員工範圍 dry run → 計畫可通過核發前檢查', async () => {
  const root = await mkdtemp(join(tmpdir(), 'alice-local-'));
  const folder = join(root, 'ALICE-P0-PRIVATE-BACKUPS', 'EMPLOYEE-ACCESS-ACCEPTANCE');
  try {
    await mkdir(folder, { recursive: true });
    const mainPath = join(folder, 'ALICE-P0-EMPLOYEE-ACCESS-PRIVATE.csv');
    const original = serializeCsv(headers, ownerRoster(), { bom: true, quoteAll: true });
    await writeFile(mainPath, original);
    await writeFile(join(folder, 'OWNER-PILOT-LOCAL-ENTRY-PRIVATE.csv'), 'FirebaseProject\n' + projects.join('\n') + '\n');
    const env = { ...process.env, LOCALAPPDATA: root };
    const run = (args, input) => spawnSync(process.execPath, args, { cwd: securityDir, env, input, encoding: 'utf8' });

    const cancelled = run(['add-employee-rows-local.mjs', '--persons', 'IRIS,CINDY,SHERRY', '--approved-on', '2026-10-27'], 'no\n');
    assert.match(cancelled.stdout, /"reason":"cancelled"/);
    assert.equal(await readFile(mainPath, 'utf8'), original, 'cancel leaves the roster untouched');

    const added = run(['add-employee-rows-local.mjs', '--persons', 'IRIS,CINDY,SHERRY', '--approved-on', '2026-10-27'], 'ADD EMPLOYEES\n');
    assert.match(added.stdout, /"status":"added","added":9/);
    const files = await readdir(folder);
    assert.equal(await readFile(join(folder, files.find(f => f.includes('.pre-add-employees-'))), 'utf8'), original);
    assert.ok(files.some(f => f.startsWith('EMPLOYEE-ACCOUNT-CREATION-APPROVAL-')));
    const rerun = run(['add-employee-rows-local.mjs', '--persons', 'IRIS,CINDY,SHERRY', '--approved-on', '2026-10-27'], '');
    assert.match(rerun.stdout, /"status":"unchanged"/);

    // Simulate the owner's later `record` runs for IRIS's customer account, then plan employee claims.
    const doc = parseCsvDocument(await readFile(mainPath, 'utf8'));
    const iris = doc.rows.find(r => r.InternalRef === 'IRIS' && r.FirebaseProject === 'new-customer-management-system');
    Object.assign(iris, { AccountUID: 'IrisUid1234567890', AccountStatus: 'ENABLED', EmailVerificationStatus: 'VERIFIED-CLIENT-SDK-2026-10-27' });
    await writeFile(mainPath, serializeCsv(doc.headers, doc.rows, { bom: doc.bom, quoteAll: doc.quoteAll }));
    await writeFile(join(folder, 'CLAIMS-BEFORE-new-customer-management-system-IRIS-20261027-PRIVATE.json'),
      JSON.stringify({ projectId: 'new-customer-management-system', person: 'IRIS', uid: 'IrisUid1234567890', customClaims: {} }));
    const dry = run(['claims-dry-run-local.mjs', '--scope', 'employees'], '');
    const report = JSON.parse(dry.stdout);
    assert.equal(report.claimsChanged, 0);
    assert.equal(report.plannedAccounts, 1);
    assert.equal(report.projects.filter(p => p.planned === false && p.reason === 'uid-not-recorded').length, 8);
    const planFile = (await readdir(folder)).find(f => f.startsWith('CLAIMS-DRY-RUN-EMPLOYEES-'));
    const plan = JSON.parse(await readFile(join(folder, planFile), 'utf8')).plans[0];
    const checked = validatePlan({ plan, projectId: 'new-customer-management-system', rosterRow: iris });
    assert.deepEqual(checked.after, { aliceApp: 'customer', aliceRole: 'designer', aliceDesigner: 'IRIS' });
  } finally { await rm(root, { recursive: true, force: true }); }
});
