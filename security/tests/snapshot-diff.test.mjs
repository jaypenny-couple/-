import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareRtdb, compareFirestore } from '../snapshot-diff.js';

test('最後備份比較：RTDB 新增、修改、刪除與未知根節點分開記錄', () => {
  const before = { records: { a: { x: 1 }, b: { x: 2 }, c: { x: 3 } } };
  const after = { records: { a: { x: 1 }, b: { x: 9 }, d: { x: 4 } }, settings: { feature: true } };
  const diff = compareRtdb(before, after, 'records');
  assert.deepEqual(diff.records.counts, { added: 1, modified: 1, deleted: 1, unchanged: 1 });
  assert.deepEqual(diff.unexpectedRoots, ['settings']);
  assert.equal(diff.rootChanges.counts.added, 1);
});

test('棄用授權清單會被標示為未知根節點並保留供人工核對', () => {
  const before = { reservations: { a: { x: 1 } }, deletionAuthorizations: { uidA: { enabled: true } } };
  const after = { reservations: { a: { x: 1 } }, deletionAuthorizations: { uidA: { enabled: false }, uidB: { enabled: true } } };
  const diff = compareRtdb(before, after, 'reservations');
  assert.deepEqual(diff.unexpectedRoots, ['deletionAuthorizations']);
  assert.deepEqual(diff.rootChanges.counts, { added: 0, modified: 1, deleted: 0, unchanged: 1 });
  assert.deepEqual(diff.records.counts, { added: 0, modified: 0, deleted: 0, unchanged: 1 });
});

test('最後備份比較：Firestore 文件與 HR 陣列逐項辨識變更', () => {
  const root = 'projects/hr-system-ad937/databases/(default)/documents';
  const str = value => ({ stringValue: value });
  const row = (id, note) => ({ mapValue: { fields: { id: str(id), note: str(note) } } });
  const data = leaves => ({
    format: 'alice-firestore-rest-v1', sourceProject: 'hr-system-ad937', database: '(default)',
    collections: [`${root}/salon`],
    documents: [{ name: `${root}/salon/main`, exists: true,
      fields: { leaves: { arrayValue: { values: leaves } }, staff: { arrayValue: { values: [] } },
        entitlements: { arrayValue: { values: [] } }, trainings: { arrayValue: { values: [] } } } }]
  });
  const before = data([row('a', 'old'), row('b', 'remove')]);
  const after = data([row('a', 'new'), row('c', 'add')]);
  const diff = compareFirestore(before, after);
  assert.deepEqual(diff.documents.counts, { added: 0, modified: 1, deleted: 0, unchanged: 0 });
  assert.deepEqual(diff.salonMainSections.leaves.counts,
    { added: 1, modified: 1, deleted: 1, unchanged: 0 });
  assert.equal(diff.collections.counts.unchanged, 1);
});
