import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { ref, get, set, update, remove, query, orderByChild, equalTo } from 'firebase/database';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rules = (name) => readFileSync(join(root, 'rules', name), 'utf8');
const database = { host: '127.0.0.1', port: 9000 };
const firestore = { host: '127.0.0.1', port: 8080 };

async function rtdbEnv(projectId, rulesFile) {
  return initializeTestEnvironment({ projectId, database: { ...database, rules: rules(rulesFile) } });
}
const rtdb = (context) => context.database();

test('新客：匿名與一般登入者拒絕；設計師只能查詢和修改自己的舊格式紀錄', async () => {
  const env = await rtdbEnv('demo-alice-customer', 'customer.database.rules.json');
  try {
    await env.withSecurityRulesDisabled(async (context) => {
      await set(ref(rtdb(context), 'records'), {
        one: { name: 'Synthetic A', designer: 'JAY' },
        two: { name: 'Synthetic B', designer: 'IRIS' }
      });
    });
    const guest = rtdb(env.unauthenticatedContext());
    const plain = rtdb(env.authenticatedContext('plain'));
    const jay = rtdb(env.authenticatedContext('jay', { aliceApp: 'customer', aliceRole: 'designer', aliceDesigner: 'JAY' }));
    const manager = rtdb(env.authenticatedContext('manager', { aliceApp: 'customer', aliceRole: 'manager' }));
    await assertFails(get(ref(guest, 'records')));
    await assertFails(set(ref(guest, 'records/evil'), { designer: 'JAY' }));
    await assertFails(get(ref(plain, 'records')));
    await assertFails(get(ref(jay, 'records')));
    await assertFails(get(query(ref(jay, 'records'), orderByChild('designer'), equalTo('IRIS'))));
    const own = await assertSucceeds(get(query(ref(jay, 'records'), orderByChild('designer'), equalTo('JAY'))));
    if (Object.keys(own.val()).length !== 1 || !own.val().one) throw new Error('設計師查詢結果不正確');
    await assertFails(get(ref(jay, 'records/two')));
    await assertSucceeds(get(ref(jay, 'records/one')));
    await assertSucceeds(set(ref(jay, 'records/three'), { name: 'Synthetic C', designer: 'JAY' }));
    await assertSucceeds(update(ref(jay, 'records/one'), { name: 'Synthetic A updated' }));
    await assertFails(update(ref(jay, 'records/one'), { designer: 'IRIS' }));
    await assertFails(remove(ref(jay, 'records/two')));
    await assertSucceeds(remove(ref(jay, 'records/three')));
    await assertFails(remove(ref(jay, 'records')));
    await assertSucceeds(get(ref(manager, 'records')));
    await assertSucceeds(remove(ref(manager, 'records/two')));
    await assertFails(remove(ref(manager, 'records')));
  } finally { await env.cleanup(); }
});

for (const [projectId, rulesFile, path, app] of [
  ['demo-alice-preorder', 'preorder.database.rules.json', 'reservations', 'preorder'],
  ['demo-alice-stock', 'stock.database.rules.json', 'stockItems', 'stock']
]) {
  test(`${app}：員工 CRUD 正常；匿名和錯誤角色拒絕`, async () => {
    const env = await rtdbEnv(projectId, rulesFile);
    try {
      const guest = rtdb(env.unauthenticatedContext());
      const wrong = rtdb(env.authenticatedContext('wrong', { aliceApp: 'customer', aliceRole: 'staff' }));
      const staff = rtdb(env.authenticatedContext('staff', { aliceApp: app, aliceRole: 'staff' }));
      await assertFails(get(ref(guest, path)));
      await assertFails(set(ref(guest, `${path}/one`), { value: 1 }));
      await assertFails(get(ref(wrong, path)));
      await assertFails(set(ref(wrong, `${path}/one`), { value: 1 }));
      await assertSucceeds(set(ref(staff, `${path}/one`), { value: 1 }));
      await assertSucceeds(get(ref(staff, path)));
      await assertSucceeds(update(ref(staff, `${path}/one`), { value: 2 }));
      await assertSucceeds(remove(ref(staff, `${path}/one`)));
      await assertFails(remove(ref(staff, path)));
    } finally { await env.cleanup(); }
  });
}

test('HR：僅 HR 管理者可讀寫 salon/main，匿名與其他角色拒絕', async () => {
  const env = await initializeTestEnvironment({
    projectId: 'demo-alice-hr', firestore: { ...firestore, rules: rules('hr.firestore.rules') }
  });
  try {
    const guest = doc(env.unauthenticatedContext().firestore(), 'salon', 'main');
    const staff = doc(env.authenticatedContext('staff', { aliceApp: 'hr', aliceRole: 'staff' }).firestore(), 'salon', 'main');
    const wrong = doc(env.authenticatedContext('wrong', { aliceApp: 'stock', aliceRole: 'manager' }).firestore(), 'salon', 'main');
    const manager = doc(env.authenticatedContext('manager', { aliceApp: 'hr', aliceRole: 'manager' }).firestore(), 'salon', 'main');
    await assertFails(getDoc(guest));
    await assertFails(setDoc(guest, { staff: [] }));
    await assertFails(getDoc(staff));
    await assertFails(setDoc(wrong, { staff: [] }));
    await assertSucceeds(setDoc(manager, { staff: [], leaves: [] }));
    await assertSucceeds(getDoc(manager));
    await assertSucceeds(setDoc(manager, { staff: [], leaves: [{ id: 'synthetic' }] }));
    await assertSucceeds(deleteDoc(manager));
    await assertFails(getDoc(doc(env.authenticatedContext('manager2', { aliceApp: 'hr', aliceRole: 'manager' }).firestore(), 'other', 'secret')));
  } finally { await env.cleanup(); }
});
