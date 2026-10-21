import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
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

const reservation = (overrides = {}) => ({
  id: 1710000000000, reservationDate: '2026-10-20', customerName: 'Synthetic Customer',
  contactPlatform: 'Synthetic', product: 'Synthetic Product', quantity: 2,
  phone: '00000000', pickupDate: '2026-10-22', createdAt: 1710000000000, ...overrides
});
const stockItem = (overrides = {}) => ({
  vendor: 'Synthetic Vendor', item: 'Synthetic Item', timestamp: 1710000000000,
  date: '2026/10/20 10:00', ...overrides
});

test('預購：staff CRUD 相容；即時授權清單控制刪除並覆蓋舊 token claim', async () => {
  const env = await rtdbEnv('pre-order-registration', 'preorder.database.rules.json');
  try {
    await env.withSecurityRulesDisabled(async context => set(ref(rtdb(context)), {
      reservations: { old: reservation() },
      deletionAuthorizations: { approved: true }
    }));
    const guest = rtdb(env.unauthenticatedContext());
    const staff = rtdb(env.authenticatedContext('staff', { aliceApp: 'preorder', aliceRole: 'staff' }));
    const approved = rtdb(env.authenticatedContext('approved', { aliceApp: 'preorder', aliceRole: 'staff', aliceCanDelete: true }));
    const noRow = rtdb(env.authenticatedContext('no-row', { aliceApp: 'preorder', aliceRole: 'staff', aliceCanDelete: true }));
    const wrongApp = rtdb(env.authenticatedContext('wrong-app', { aliceApp: 'stock', aliceRole: 'staff' }));
    const manager = rtdb(env.authenticatedContext('manager', { aliceApp: 'preorder', aliceRole: 'manager', aliceCanDelete: true }));
    await assertFails(get(ref(guest, 'reservations')));
    await assertFails(set(ref(guest, 'reservations/guest'), reservation()));
    await assertSucceeds(get(ref(staff, 'reservations')));
    await assertSucceeds(set(ref(staff, 'reservations/new'), reservation()));
    await assertSucceeds(update(ref(staff, 'reservations/old'), { pickupDate: '2026-10-23' }));
    await assertFails(remove(ref(staff, 'reservations/old')));
    await assertFails(remove(ref(noRow, 'reservations/old')));
    await assertFails(remove(ref(wrongApp, 'reservations/old')));
    await assertFails(remove(ref(manager, 'reservations/old')));
    await assertFails(get(ref(staff, 'deletionAuthorizations/approved')));
    await assertSucceeds(get(ref(approved, 'deletionAuthorizations/approved')));
    await assertFails(get(ref(approved, 'deletionAuthorizations/staff')));
    await assertFails(set(ref(approved, 'deletionAuthorizations/approved'), true));
    await assertFails(set(ref(staff, 'deletionAuthorizations/approved'), false));
    await assertFails(remove(ref(approved, 'reservations')));
    await assertFails(update(ref(staff), { 'reservations/old': null, 'reservations/new/pickupDate': '2026-10-24' }));
    await assertSucceeds(remove(ref(approved, 'reservations/old')));

    await env.withSecurityRulesDisabled(async context => set(ref(rtdb(context), 'reservations/old'), reservation()));
    await env.withSecurityRulesDisabled(async context => set(ref(rtdb(context), 'deletionAuthorizations/approved'), false));
    await assertFails(remove(ref(approved, 'reservations/old')));
    await env.withSecurityRulesDisabled(async context => {
      await set(ref(rtdb(context), 'reservations/old'), reservation());
      await set(ref(rtdb(context), 'deletionAuthorizations/approved'), { enabled: true });
    });
    await assertFails(remove(ref(approved, 'reservations/old')));
  } finally { await env.cleanup(); }
});

test('缺貨：staff 僅可讀取／新增；授權 UID 可單筆刪除且撤權後舊 token 即拒絕', async () => {
  const env = await rtdbEnv('restocking-list', 'stock.database.rules.json');
  try {
    await env.withSecurityRulesDisabled(async context => set(ref(rtdb(context)), {
      stockItems: { old: stockItem() },
      deletionAuthorizations: { approved: true }
    }));
    const guest = rtdb(env.unauthenticatedContext());
    const staff = rtdb(env.authenticatedContext('staff', { aliceApp: 'stock', aliceRole: 'staff' }));
    const approved = rtdb(env.authenticatedContext('approved', { aliceApp: 'stock', aliceRole: 'staff', aliceCanDelete: true }));
    const noRow = rtdb(env.authenticatedContext('no-row', { aliceApp: 'stock', aliceRole: 'staff', aliceCanDelete: true }));
    const crossProject = rtdb(env.authenticatedContext('cross-project', { aliceApp: 'stock', aliceRole: 'staff' }));
    const wrongApp = rtdb(env.authenticatedContext('wrong-app', { aliceApp: 'preorder', aliceRole: 'staff' }));
    const manager = rtdb(env.authenticatedContext('manager', { aliceApp: 'stock', aliceRole: 'manager', aliceCanDelete: true }));
    await assertFails(get(ref(guest, 'stockItems')));
    await assertFails(set(ref(guest, 'stockItems/guest'), stockItem()));
    await assertSucceeds(get(ref(staff, 'stockItems')));
    await assertSucceeds(set(ref(staff, 'stockItems/new'), stockItem()));
    await assertFails(update(ref(staff, 'stockItems/old'), { item: 'Changed' }));
    await assertFails(remove(ref(staff, 'stockItems/old')));
    await assertFails(remove(ref(noRow, 'stockItems/old')));
    await assertFails(remove(ref(crossProject, 'stockItems/old')));
    await assertFails(remove(ref(wrongApp, 'stockItems/old')));
    await assertFails(remove(ref(manager, 'stockItems/old')));
    await assertFails(get(ref(staff, 'deletionAuthorizations/approved')));
    await assertSucceeds(get(ref(approved, 'deletionAuthorizations/approved')));
    await assertFails(get(ref(approved, 'deletionAuthorizations/staff')));
    await assertFails(set(ref(approved, 'deletionAuthorizations/approved'), true));
    await assertFails(remove(ref(approved, 'stockItems')));
    await assertFails(update(ref(staff), { 'stockItems/old': null, 'stockItems/new': null }));
    await assertSucceeds(remove(ref(approved, 'stockItems/old')));

    await env.withSecurityRulesDisabled(async context => set(ref(rtdb(context), 'stockItems/old'), stockItem()));
    await env.withSecurityRulesDisabled(async context => set(ref(rtdb(context), 'deletionAuthorizations/approved'), false));
    await assertFails(remove(ref(approved, 'stockItems/old')));
  } finally { await env.cleanup(); }
});

test('已知阻擋：RTDB Rules 目前允許已授權 UID 以原子多路徑更新刪除多筆', async () => {
  const env = await rtdbEnv('pre-order-registration', 'preorder.database.rules.json');
  try {
    await env.withSecurityRulesDisabled(async context => set(ref(rtdb(context)), {
      reservations: { one: reservation(), two: reservation({ id: 1710000000001 }) },
      deletionAuthorizations: { approved: true }
    }));
    const approved = rtdb(env.authenticatedContext('approved', { aliceApp: 'preorder', aliceRole: 'staff' }));
    await assertSucceeds(update(ref(approved), { 'reservations/one': null, 'reservations/two': null }));
    const remaining = await assertSucceeds(get(ref(approved, 'reservations')));
    assert.equal(remaining.val(), null);
  } finally { await env.cleanup(); }
});

test('HR：管理者可讀取、建立與更新 salon/main，任何角色均不得刪除整份文件', async () => {
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
    await assertFails(deleteDoc(manager));
    await assertSucceeds(getDoc(manager));
    await assertFails(getDoc(doc(env.authenticatedContext('manager2', { aliceApp: 'hr', aliceRole: 'manager' }).firestore(), 'other', 'secret')));
  } finally { await env.cleanup(); }
});

test('舊版匿名 HR 頁在候選規則下會被拒絕；新版管理員可讀舊格式資料', async () => {
  const projectId = 'demo-alice-legacy-transition';
  const open = await initializeTestEnvironment({
    projectId, firestore: { ...firestore, rules: `rules_version = '2';
      service cloud.firestore { match /databases/{database}/documents {
        match /{document=**} { allow read, write: if true; }
      } }` }
  });
  try {
    const old = doc(open.unauthenticatedContext().firestore(), 'salon', 'main');
    await assertSucceeds(setDoc(old, { staff: [{ id: 'synthetic', name: 'Old format' }],
      entitlements: [], leaves: [], trainings: [] }));
    await assertSucceeds(getDoc(old));
  } finally { await open.cleanup(); }
  const secure = await initializeTestEnvironment({
    projectId, firestore: { ...firestore, rules: rules('hr.firestore.rules') }
  });
  try {
    const old = doc(secure.unauthenticatedContext().firestore(), 'salon', 'main');
    const manager = doc(secure.authenticatedContext('manager',
      { aliceApp: 'hr', aliceRole: 'manager' }).firestore(), 'salon', 'main');
    await assertFails(getDoc(old));
    await assertFails(setDoc(old, { leaves: [] }));
    const snapshot = await assertSucceeds(getDoc(manager));
    if (snapshot.data().staff[0].name !== 'Old format') throw new Error('Legacy data changed during rule transition.');
  } finally { await secure.cleanup(); }
});
