import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyOwnerPilotAccountRecord, overlayOwnerPilotEntries, parseCsv, parseCsvDocument, serializeCsv } from '../employee-approval-policy.js';
import { recordAccount } from '../email-verification-record.mjs';
import { buildStaffClaimsDryRun } from '../staff-claim-policy.js';

const projects = ['new-customer-management-system', 'pre-order-registration', 'restocking-list', 'hr-system-ad937'];
const headers = ['RecordType', 'InternalRef', 'FirebaseProject', 'SystemRole', 'ApprovedEmail', 'AccountCreationApproval',
  'OwnerApproval', 'ManagerDutiesJustification', 'AccountUID', 'AccountStatus', 'EmailVerificationStatus', 'Notes'];
function syntheticMain({ withEmail = false } = {}) {
  const rows = [{ RecordType: 'ROLE-TEMPLATE', InternalRef: '', FirebaseProject: 'restocking-list', SystemRole: 'staff', Notes: '範本,含逗號' }];
  for (const projectId of projects) rows.push({
    RecordType: 'OWNER-PILOT', InternalRef: 'OWNER-1', FirebaseProject: projectId,
    SystemRole: projectId.startsWith('new') || projectId.startsWith('hr') ? 'manager' : 'staff',
    ApprovedEmail: withEmail ? 'owner@example.invalid' : '', AccountCreationApproval: 'APPROVED', OwnerApproval: 'APPROVED',
    ManagerDutiesJustification: 'synthetic duty', AccountUID: '', AccountStatus: '', EmailVerificationStatus: '', Notes: '"引號"'
  });
  return serializeCsv(headers, rows, { bom: true, quoteAll: true });
}
const entrySheet = 'FirebaseProject,ApprovedEmail\n' + projects.map(p => `${p},owner@example.invalid`).join('\n') + '\n';
const merged = (text, projectId) => {
  const rows = parseCsv(text);
  overlayOwnerPilotEntries(rows, parseCsv(entrySheet));
  return rows.find(r => r.FirebaseProject === projectId && r.RecordType === 'OWNER-PILOT');
};

test('CSV 文件解析與重寫保留 BOM、全欄引號、欄位順序與特殊字元', () => {
  const text = syntheticMain();
  const doc = parseCsvDocument(text);
  assert.equal(doc.bom, true);
  assert.equal(doc.quoteAll, true);
  assert.deepEqual(doc.headers, headers);
  assert.equal(serializeCsv(doc.headers, doc.rows, { bom: doc.bom, quoteAll: doc.quoteAll }), text);
  assert.equal(doc.rows[0].Notes, '範本,含逗號');
});

test('UID 寫回只改該專案試點列三個帳號欄位，拒絕信箱不符、未核准及覆蓋不同 UID', () => {
  const text = syntheticMain();
  const rows = parseCsv(text);
  const base = { projectId: 'restocking-list', mergedRow: merged(text, 'restocking-list'), signedInEmail: 'OWNER@example.invalid',
    uid: 'SyntheticUid1234567890', emailVerified: true, checkedOn: '2026-10-26' };
  const result = applyOwnerPilotAccountRecord(rows, base);
  assert.deepEqual(result.changedFields, ['AccountUID', 'AccountStatus', 'EmailVerificationStatus']);
  const original = parseCsv(text);
  rows.forEach((row, i) => headers.forEach(h => {
    if (i !== result.rowIndex || !result.changedFields.includes(h)) assert.equal(row[h], original[i][h]);
  }));
  assert.equal(rows[result.rowIndex].EmailVerificationStatus, 'VERIFIED-CLIENT-SDK-2026-10-26');
  assert.throws(() => applyOwnerPilotAccountRecord(rows, { ...base, uid: 'DifferentUid1234567890' }), /different UID/);
  assert.throws(() => applyOwnerPilotAccountRecord(parseCsv(text), { ...base, signedInEmail: 'other@example.invalid' }), /does not match/);
  assert.throws(() => applyOwnerPilotAccountRecord(parseCsv(text), { ...base, mergedRow: { ...base.mergedRow, OwnerApproval: 'PENDING' } }), /not approved/);
  assert.throws(() => applyOwnerPilotAccountRecord(parseCsv(text), { ...base, uid: 'bad uid' }), /UID format/);
  const pending = applyOwnerPilotAccountRecord(parseCsv(text), { ...base, emailVerified: false });
  assert.equal(pending.changed, true);
});

test('本機寫回先備份並核雜湊、保存 Claims 前態、重複執行不改檔，檔案中途變更即拒絕', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'alice-record-'));
  try {
    const mainCsvPath = join(dir, 'ALICE-P0-EMPLOYEE-ACCESS-PRIVATE.csv');
    const text = syntheticMain();
    await writeFile(mainCsvPath, text);
    const account = { uid: 'SyntheticUid1234567890', signedInEmail: 'owner@example.invalid', emailVerified: true, customClaims: {} };
    const args = { privateFolder: dir, mainCsvPath, projectId: 'hr-system-ad937', mergedRow: merged(text, 'hr-system-ad937'), account, checkedOn: '2026-10-26' };
    const first = await recordAccount({ ...args, mainCsvBuffer: Buffer.from(text) });
    assert.equal(first.status, 'recorded');
    assert.equal(JSON.stringify(first).includes(account.uid), false, 'UID never appears in printable outcome');
    const files = await readdir(dir);
    const backup = files.find(f => f.includes('.pre-record-hr-system-ad937-'));
    assert.equal(await readFile(join(dir, backup), 'utf8'), text);
    assert.ok(files.some(f => f.startsWith('CLAIMS-BEFORE-hr-system-ad937-')));
    const after = await readFile(mainCsvPath);
    const second = await recordAccount({ ...args, mainCsvBuffer: after });
    assert.equal(second.status, 'unchanged');
    assert.deepEqual(await readFile(mainCsvPath), after);
    await assert.rejects(() => recordAccount({ ...args, mainCsvBuffer: Buffer.from(text) }), e => e.safeReason === 'private-csv-changed-during-run');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('Claims dry run 只產生計畫：完整前態、差異、回復值，未驗證或缺主管理由列為阻擋', () => {
  const before = { legacyFlag: true, aliceCanDelete: true };
  const plan = buildStaffClaimsDryRun(before, { projectId: 'hr-system-ad937', uid: 'SyntheticUid1234567890', role: 'manager',
    accountEnabled: true, emailVerified: true, managerDutiesJustification: 'duty' });
  assert.equal(plan.mode, 'DRY-RUN-NOT-APPLIED');
  assert.equal(plan.ownerUidApproval, 'PENDING');
  assert.deepEqual(plan.after, { legacyFlag: true, aliceApp: 'hr', aliceRole: 'manager' });
  assert.deepEqual(plan.rollbackClaims, before);
  assert.equal(plan.containsAliceCanDelete, false);
  assert.deepEqual(plan.blockers, []);
  const blocked = buildStaffClaimsDryRun({}, { projectId: 'new-customer-management-system', uid: 'SyntheticUid1234567890',
    role: 'manager', accountEnabled: true, emailVerified: false });
  assert.deepEqual(blocked.blockers, ['email-not-verified', 'manager-justification-missing']);
  assert.throws(() => buildStaffClaimsDryRun({}, { projectId: 'pre-order-registration', uid: 'SyntheticUid1234567890', role: 'manager' }), /not allowed/);
});
