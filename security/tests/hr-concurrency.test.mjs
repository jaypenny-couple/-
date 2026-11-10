import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HrConflictError, hrChanges, hrEntryKey, hrFingerprint, mergeHrChanges } from '../hr-concurrency.js';

const base = () => ({
  staff: [{ id: 'a', name: 'A' }],
  entitlements: [{ staffId: 'a', year: 2026, quotaHours: 8 }],
  leaves: [{ id: 'l1', note: 'old' }],
  trainings: []
});

test('HR：兩台裝置修改不同紀錄時保留雙方變更', () => {
  const before = base();
  const desired = structuredClone(before);
  desired.leaves.push({ id: 'l2', note: 'local' });
  const remote = structuredClone(before);
  remote.trainings.push({ id: 't1', courseName: 'remote' });
  const updates = mergeHrChanges(remote, hrChanges(before, desired));
  assert.equal(updates.leaves.length, 2);
  assert.deepEqual({ ...remote, ...updates }.trainings, remote.trainings);
});

test('HR：同一紀錄並行修改或刪除時拒絕覆寫', () => {
  const before = base();
  const desired = structuredClone(before);
  desired.leaves[0].note = 'local';
  const remote = structuredClone(before);
  remote.leaves[0].note = 'remote';
  assert.throws(() => mergeHrChanges(remote, hrChanges(before, desired)), HrConflictError);
  remote.leaves = [];
  assert.throws(() => mergeHrChanges(remote, hrChanges(before, desired)), HrConflictError);
});

test('HR：舊版無 id 配額可辨識、刪除且重試不重複', () => {
  const before = base();
  assert.equal(hrEntryKey('entitlements', before.entitlements[0]), 'legacy:a:2026');
  const desired = structuredClone(before);
  desired.entitlements = [];
  const change = hrChanges(before, desired);
  const once = mergeHrChanges(before, change);
  assert.deepEqual(once.entitlements, []);
  const twice = mergeHrChanges({ ...before, ...once }, change);
  assert.deepEqual(twice.entitlements, []);
});

test('HR：重複識別值或無法辨識的舊列拒絕寫入', () => {
  const before = base();
  const duplicate = structuredClone(before);
  duplicate.staff.push({ id: 'a', name: 'Other' });
  assert.throws(() => hrChanges(before, duplicate), HrConflictError);
  assert.throws(() => hrEntryKey('leaves', { note: 'missing id' }), HrConflictError);
});

test('HR：整份匯入的版本指紋忽略欄位順序並辨識遠端變更', () => {
  const before = base();
  const reordered = { trainings: [], leaves: before.leaves, entitlements: before.entitlements,
    staff: [{ name: 'A', id: 'a' }] };
  assert.equal(hrFingerprint(before), hrFingerprint(reordered));
  const changed = structuredClone(before);
  changed.staff[0].name = 'Other device';
  assert.notEqual(hrFingerprint(before), hrFingerprint(changed));
});
