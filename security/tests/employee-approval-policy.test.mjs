import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  expectedClaims, isApproved, normalizeApprovedEmail, overlayOwnerPilotEntries, parseCsv, summarizeEmployeeRoster
} from '../employee-approval-policy.js';

test('私人名單 CSV 解析支援引號、逗號、換行及重複標頭拒絕', () => {
  const rows = parseCsv('InternalRef,JobDuties\r\n"staff-1","預購,盤點\n交班"\r\n');
  assert.equal(rows[0].InternalRef, 'staff-1');
  assert.equal(rows[0].JobDuties, '預購,盤點\n交班');
  assert.throws(() => parseCsv('a,a\n1,2'), /non-empty and unique/);
  assert.throws(() => parseCsv('a\n"unterminated'), /unterminated/);
});

test('Email 格式與核准字串採嚴格檢查', () => {
  assert.equal(normalizeApprovedEmail('  PERSON@example.com '), 'person@example.com');
  assert.equal(normalizeApprovedEmail('not-an-email'), null);
  assert.equal(isApproved('approved'), true);
  assert.equal(isApproved('APPROVED by owner'), false);
  assert.equal(isApproved('PENDING'), false);
});

test('Claims 依 Firebase 專案白名單產生並要求設計師代碼', () => {
  assert.deepEqual(expectedClaims('new-customer-management-system', 'designer', 'JAY'), {
    aliceApp: 'customer', aliceRole: 'designer', aliceDesigner: 'JAY'
  });
  assert.deepEqual(expectedClaims('pre-order-registration', 'staff'), { aliceApp: 'preorder', aliceRole: 'staff' });
  assert.throws(() => expectedClaims('pre-order-registration', 'manager'), /does not match/);
  assert.throws(() => expectedClaims('new-customer-management-system', 'designer'), /approved designer code/);
  assert.throws(() => expectedClaims('hr-system-ad937', 'manager', 'JAY'), /only valid/);
  assert.throws(() => expectedClaims('unknown-project', 'staff'), /Unsupported/);
});

test('業主試點欄位留白時列出待補項目，不推定角色或核准', () => {
  const projects = ['new-customer-management-system', 'pre-order-registration', 'restocking-list', 'hr-system-ad937'];
  const rows = projects.map(FirebaseProject => ({ InternalRef: 'OWNER-PILOT-TBD', FirebaseProject }));
  const result = summarizeEmployeeRoster(rows);
  assert.equal(result.ownerPilotRows, 4);
  assert.equal(result.candidateRows, 0);
  assert.equal(result.rowsWithValidApprovedEmail, 0);
  for (const project of result.projects) {
    assert.equal(project.present, true);
    assert.ok(project.missingBeforeAccount.includes('核准登入信箱'));
    assert.ok(project.missingBeforeAccount.includes('實際工作職責'));
    assert.ok(project.missingBeforeAccount.includes('最低必要角色'));
    assert.ok(project.pendingAuthorization.includes('逐人逐專案帳號建立核准'));
    assert.ok(project.pendingAuthorization.includes('業主核准紀錄'));
    assert.ok(project.missingAfterAccount.includes('該專案 UID'));
    assert.ok(project.missingAfterAccount.includes('Email 驗證狀態'));
  }
});

test('業主識別已填後仍以穩定記錄類型辨識試點列', () => {
  const rows = [{
    RecordType: 'OWNER-PILOT', InternalRef: 'synthetic-employee-id', ApprovedEmail: 'pilot@example.invalid',
    FirebaseProject: 'pre-order-registration', SystemRole: 'staff', JobDuties: 'synthetic duty',
    MinimumAccess: 'preorder/staff', AccountDisableOwner: 'synthetic owner'
  }];
  const result = summarizeEmployeeRoster(rows);
  assert.equal(result.ownerPilotRows, 1);
  assert.equal(result.candidateRows, 1);
  assert.equal(result.projects.find(project => project.projectId === 'pre-order-registration').role, 'staff');
});

test('私人輸入表按專案覆蓋試點列供稽核、拒絕重複或錯誤專案', () => {
  const roster = [
    { InternalRef: 'OWNER-PILOT-TBD', FirebaseProject: 'pre-order-registration', SystemRole: '' },
    { InternalRef: 'OWNER-PILOT-TBD', FirebaseProject: 'restocking-list', SystemRole: '' },
    { InternalRef: 'OWNER-PILOT-TBD', FirebaseProject: 'new-customer-management-system', SystemRole: '' },
    { InternalRef: 'OWNER-PILOT-TBD', FirebaseProject: 'hr-system-ad937', SystemRole: '' }
  ];
  const entries = [
    { InternalRef: 'synthetic-staff', ApprovedEmail: 'pilot@example.invalid', FirebaseProject: 'pre-order-registration', SystemRole: 'staff' },
    { InternalRef: '', ApprovedEmail: '', FirebaseProject: 'restocking-list', SystemRole: '' }
  ];
  const completeEntries = [
    ...entries,
    { InternalRef: '', ApprovedEmail: '', FirebaseProject: 'new-customer-management-system', SystemRole: '' },
    { InternalRef: '', ApprovedEmail: '', FirebaseProject: 'hr-system-ad937', SystemRole: '' }
  ];
  const result = overlayOwnerPilotEntries(roster, completeEntries);
  assert.equal(result[0].RecordType, 'OWNER-PILOT');
  assert.equal(result[0].InternalRef, 'synthetic-staff');
  assert.equal(result[0].ApprovedEmail, 'pilot@example.invalid');
  assert.equal(result[1].RecordType, 'OWNER-PILOT');
  assert.throws(() => overlayOwnerPilotEntries([...roster], [...completeEntries, entries[0]]), /one valid row per Firebase project/);
  assert.throws(() => overlayOwnerPilotEntries([...roster], [{ ...completeEntries[0], FirebaseProject: 'unknown' }]), /one valid row per Firebase project/);
});

test('同專案重複信箱、角色不符、設計師代碼及主管理由會進入稽核', () => {
  const result = summarizeEmployeeRoster([
    { InternalRef: 'staff-a', ApprovedEmail: 'a@example.com', FirebaseProject: 'pre-order-registration', SystemRole: 'manager' },
    { InternalRef: 'staff-b', ApprovedEmail: 'A@example.com', FirebaseProject: 'pre-order-registration', SystemRole: 'staff' }
  ]);
  assert.equal(result.candidateRows, 2);
  assert.equal(result.duplicateEmailProjectCount, 1);
  assert.equal(result.roleConflictCount, 1);
});
