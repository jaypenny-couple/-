import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import {
  assertApprovedLocalOperator, canonicalJson, parseSingleDeleteArgs, performSingleRecordDelete, sha256, validateDeleteTarget
} from '../single-record-delete.js';

const urls = {
  'pre-order-registration': 'https://pre-order-registration-default-rtdb.asia-southeast1.firebasedatabase.app',
  'restocking-list': 'https://restocking-list-default-rtdb.firebaseio.com'
};
const syntheticPreorder = { id: 1, reservationDate: '2026-10-21', customerName: 'synthetic', product: 'item', pickupDate: '2026-10-22' };
const syntheticStock = { vendor: 'synthetic', item: 'item', timestamp: 1, date: '2026-10-21' };

function memory({ rows, beforeDelete, afterDelete } = {}) {
  const state = structuredClone(rows ?? {});
  return {
    state,
    async readCollection(path) { return structuredClone(state[path] ?? {}); },
    async readRecord(path, id) { return structuredClone(state[path]?.[id] ?? null); },
    async deleteIfUnchanged(path, id, expectedHash) {
      beforeDelete?.(state, path, id);
      const value = state[path]?.[id];
      if (!value) return { committed: false, reason: 'missing' };
      if (sha256(canonicalJson(value)) !== expectedHash) return { committed: false, reason: 'changed' };
      delete state[path][id];
      afterDelete?.(state, path, id);
      return { committed: true };
    }
  };
}

function store({ failBackup = false, corruptBackup = false } = {}) {
  const backups = new Map();
  const audits = [];
  return {
    backups, audits,
    async writeBackup(bytes, info) {
      if (failBackup) throw new Error('BACKUP_WRITE_FAILED');
      const fileName = 'private-record.json';
      backups.set(fileName, corruptBackup ? Buffer.from('corrupt') : Buffer.from(bytes));
      return { fileName, info };
    },
    async readBackup(fileName) { return backups.get(fileName); },
    async writeAudit(bytes) { audits.push(Buffer.from(bytes)); }
  };
}

test('單筆工具只解析固定專案與單一紀錄 ID，拒絕根節點及批次參數', () => {
  assert.deepEqual(parseSingleDeleteArgs(['--project', 'pre-order-registration', '--id', 'pushKey_1']).path, 'reservations/pushKey_1');
  assert.deepEqual(parseSingleDeleteArgs(['--project', 'restocking-list', '--id', '-Abc_123']).path, 'stockItems/-Abc_123');
  for (const args of [
    ['--project', 'other-project', '--id', 'one'],
    ['--project', 'pre-order-registration', '--id', 'reservations'],
    ['--project', 'pre-order-registration', '--id', '../one'],
    ['--project', 'pre-order-registration', '--id', 'one', '--id', 'two'],
    ['--project', 'pre-order-registration', '--ids', 'one,two'],
    ['--project', 'pre-order-registration', '--id', 'one', '--apply']
  ]) assert.throws(() => parseSingleDeleteArgs(args));
  assert.throws(() => validateDeleteTarget('pre-order-registration', '*'));
});

test('本機操作者必須有私下核准、職務及逐專案授權紀錄', () => {
  const approval = { format: 'alice-local-delete-operators-v1', operators: [{
    windowsIdentity: 'ALICE\\manager', role: 'store-manager', projects: ['pre-order-registration'],
    approvedBy: 'owner', approvedAt: '2026-10-21T00:00:00Z', approvalRef: 'private-approval-1'
  }] };
  assert.equal(assertApprovedLocalOperator(approval, { actor: 'alice\\MANAGER', projectId: 'pre-order-registration' }).role, 'store-manager');
  assert.throws(() => assertApprovedLocalOperator(approval, { actor: 'alice\\manager', projectId: 'restocking-list' }), /LOCAL_OPERATOR_NOT_APPROVED/);
  assert.throws(() => assertApprovedLocalOperator({ ...approval, operators: [] }, { actor: 'alice\\manager', projectId: 'pre-order-registration' }), /LOCAL_OPERATOR_NOT_APPROVED/);
  assert.throws(() => assertApprovedLocalOperator({ format: 'wrong', operators: [] }, { actor: 'alice\\manager', projectId: 'pre-order-registration' }), /OPERATOR_APPROVAL_FILE_INVALID/);
});

test('本機管理流程先備份並核雜湊，再交易式刪除單筆且核對其他紀錄未變', async () => {
  const adapter = memory({ rows: { reservations: { target: syntheticPreorder, other: syntheticStock } } });
  const persistence = store();
  const result = await performSingleRecordDelete({
    projectId: 'pre-order-registration', recordId: 'target', actor: 'local-operator', confirmed: true,
    store: persistence, adapter
  });
  assert.equal(result.result, 'DELETED_AND_VERIFIED');
  assert.equal(result.affectedRecordCount, 1);
  assert.equal(adapter.state.reservations.target, undefined);
  assert.deepEqual(adapter.state.reservations.other, syntheticStock);
  assert.equal(persistence.backups.get(result.backup.fileName).toString(), `${JSON.stringify(syntheticPreorder, null, 2)}\n`);
  assert.equal(persistence.audits.length, 1);
  const audit = JSON.parse(persistence.audits[0].toString());
  assert.equal(audit.projectId, 'pre-order-registration');
  assert.equal(audit.recordId, 'target');
  assert.equal(audit.result, 'DELETED_AND_VERIFIED');
  assert.match(result.backup.recordSha256, /^[a-f0-9]{64}$/);
});

test('拒絕未確認、紀錄不存在、刪除前變更、備份失敗及備份雜湊不符', async () => {
  const cases = [
    { name: 'confirmation', confirmed: false, rows: { stockItems: { one: syntheticStock } }, expected: 'CONFIRMATION_REQUIRED' },
    { name: 'missing', confirmed: true, rows: { stockItems: {} }, expected: 'RECORD_NOT_FOUND', absent: true },
    { name: 'changed', confirmed: true, rows: { stockItems: { one: syntheticStock } }, expected: 'RECORD_CHANGED',
      beforeDelete: state => { state.stockItems.one = { ...syntheticStock, item: 'changed' }; } },
    { name: 'backup-write', confirmed: true, rows: { stockItems: { one: syntheticStock } }, expected: 'BACKUP_WRITE_FAILED', failBackup: true },
    { name: 'backup-hash', confirmed: true, rows: { stockItems: { one: syntheticStock } }, expected: 'BACKUP_HASH_MISMATCH', corruptBackup: true }
  ];
  for (const item of cases) {
    const adapter = memory({ rows: item.rows, beforeDelete: item.beforeDelete });
    const persistence = store(item);
    await assert.rejects(performSingleRecordDelete({
      projectId: 'restocking-list', recordId: 'one', actor: 'local-operator', confirmed: item.confirmed,
      store: persistence, adapter
    }), error => error.message === item.expected);
    assert.equal(adapter.state.stockItems.one === undefined, !!item.absent, `${item.name} must preserve initial state`);
    assert.equal(persistence.audits.length, 1, `${item.name} should leave a private failure audit`);
    assert.equal(JSON.parse(persistence.audits[0].toString()).result, 'STOPPED');
  }
});

test('刪除後核對異常會明確停止並保留先前備份', async () => {
  const adapter = memory({
    rows: { stockItems: { one: syntheticStock, other: { ...syntheticStock, item: 'other' } } },
    afterDelete(state) { state.stockItems.other.item = 'concurrent-change'; }
  });
  const persistence = store();
  await assert.rejects(performSingleRecordDelete({
    projectId: 'restocking-list', recordId: 'one', actor: 'local-operator', confirmed: true,
    store: persistence, adapter
  }), error => error.message === 'POST_DELETE_COLLECTION_MISMATCH');
  assert.equal(adapter.state.stockItems.one, undefined);
  assert.equal(persistence.backups.size, 1);
  assert.equal(JSON.parse(persistence.audits[0].toString()).result, 'STOPPED');
});

test('資料庫讀取或交易刪除失敗時停止且留下私人稽核', async () => {
  const readStore = store();
  const readAdapter = memory({ rows: { stockItems: { one: syntheticStock } } });
  readAdapter.readCollection = async () => { throw new Error('NETWORK_READ_FAILED'); };
  await assert.rejects(performSingleRecordDelete({
    projectId: 'restocking-list', recordId: 'one', actor: 'local-operator', confirmed: true,
    store: readStore, adapter: readAdapter
  }), error => error.message === 'NETWORK_READ_FAILED');
  assert.equal(readStore.backups.size, 0);
  assert.equal(JSON.parse(readStore.audits[0].toString()).result, 'STOPPED');

  const transactionStore = store();
  const transactionAdapter = memory({ rows: { stockItems: { one: syntheticStock } } });
  transactionAdapter.deleteIfUnchanged = async () => { throw new Error('NETWORK_DELETE_FAILED'); };
  await assert.rejects(performSingleRecordDelete({
    projectId: 'restocking-list', recordId: 'one', actor: 'local-operator', confirmed: true,
    store: transactionStore, adapter: transactionAdapter
  }), error => error.message === 'NETWORK_DELETE_FAILED');
  assert.notEqual(transactionAdapter.state.stockItems.one, undefined);
  assert.equal(transactionStore.backups.size, 1);
  assert.equal(JSON.parse(transactionStore.audits[0].toString()).result, 'STOPPED');
});

test('本機 RTDB Emulator 可逐筆刪除兩套系統；重複執行遭拒', async t => {
  const emulatorHost = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(emulatorHost ?? '')) return t.skip('Requires localhost RTDB Emulator');
  for (const [projectId, collection, record] of [
    ['pre-order-registration', 'reservations', syntheticPreorder],
    ['restocking-list', 'stockItems', syntheticStock]
  ]) {
    const app = initializeApp({ projectId, databaseURL: urls[projectId] }, `single-delete-test-${projectId}`);
    try {
      const db = getDatabase(app);
      const [host, port] = emulatorHost.split(':');
      db.useEmulator(host, Number(port));
      const id = `synthetic-${projectId}`;
      await db.ref(collection).set({ [id]: record, keep: { ...record } });
      const adapter = {
        async readCollection(path) { const snap = await db.ref(path).get(); return snap.val() ?? {}; },
        async readRecord(path, key) { const snap = await db.ref(`${path}/${key}`).get(); return snap.val(); },
        async deleteIfUnchanged(path, key, expectedHash) {
          let changed = false;
          let matchedVersion = false;
          const result = await db.ref(`${path}/${key}`).transaction(current => {
            if (current === null) return null;
            if (sha256(canonicalJson(current)) !== expectedHash) { changed = true; return; }
            matchedVersion = true;
            return null;
          }, undefined, false);
          return { committed: result.committed && matchedVersion, reason: changed ? 'changed' : 'not-committed' };
        }
      };
      const persistence = store();
      const result = await performSingleRecordDelete({ projectId, recordId: id, actor: 'synthetic-test', confirmed: true, store: persistence, adapter });
      assert.equal(result.result, 'DELETED_AND_VERIFIED');
      assert.deepEqual(await adapter.readRecord(collection, 'keep'), record);
      await assert.rejects(performSingleRecordDelete({ projectId, recordId: id, actor: 'synthetic-test', confirmed: true, store: store(), adapter }), error => error.message === 'RECORD_NOT_FOUND');
    } finally { await deleteApp(app); }
  }
});
