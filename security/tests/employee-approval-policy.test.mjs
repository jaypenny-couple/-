import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  expectedClaims, isApproved, normalizeApprovedEmail, parseCsv, summarizeEmployeeRoster
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
    assert.ok(project.missing.includes('核准登入信箱'));
    assert.ok(project.missing.includes('實際工作職責'));
    assert.ok(project.missing.includes('最低必要角色'));
    assert.ok(project.missing.includes('逐人逐專案帳號建立核准'));
    assert.ok(project.missing.includes('業主核准紀錄'));
    assert.ok(project.missing.includes('該專案 UID（帳號建立後）'));
  }
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
