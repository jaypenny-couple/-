import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const securityRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const siteRoot = resolve(securityRoot, '..');
const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ports = { host: '127.0.0.1', port: 9000 };

test('新客、預訂、HR 頁面於本機 Emulator 的員工工作流程', async () => {
  for (const key of ['FIREBASE_AUTH_EMULATOR_HOST', 'FIREBASE_DATABASE_EMULATOR_HOST', 'FIRESTORE_EMULATOR_HOST']) {
    assert.ok(process.env[key]?.startsWith('127.0.0.1:'), `Missing safe local emulator: ${key}`);
  }
  const environments = [];
  const admin = initializeApp({ projectId: 'demo-alice-p0' }, 'other-browser-test');
  const server = createServer(async (req, res) => {
    const path = resolve(siteRoot, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (!path.startsWith(siteRoot + sep)) { res.writeHead(403).end(); return; }
    try {
      const body = await readFile(path);
      res.setHeader('Content-Type', { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' }[extname(path)] ?? 'application/octet-stream');
      res.end(body);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(8766, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: edge, headless: true });
  const password = 'Synthetic-password-123!';
  async function addAccount(claims) {
    const email = `synthetic-${claims.aliceApp}-${Date.now()}@example.invalid`;
    const user = await getAuth(admin).createUser({ email, password, emailVerified: true });
    await getAuth(admin).setCustomUserClaims(user.uid, claims);
    return email;
  }
  async function openAndLogin(path, email) {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on('dialog', dialog => dialog.accept());
    await page.goto(`http://127.0.0.1:8766/${encodeURIComponent(path)}`);
    await page.locator('#aliceAuthForm input[name="email"]').fill(email);
    await page.locator('#aliceAuthForm input[name="password"]').fill(password);
    await page.locator('#aliceAuthForm button').click();
    await page.locator('#aliceAuthBar').waitFor({ state: 'visible', timeout: 30000 });
    await context.setOffline(true);
    await page.waitForFunction(() => document.body.classList.contains('alice-offline'));
    assert.equal(await page.locator('#aliceNetworkStatus').isVisible(), true);
    await context.setOffline(false);
    await page.waitForFunction(() => !document.body.classList.contains('alice-offline'));
    return { context, page };
  }
  try {
    const customerRules = await readFile(join(securityRoot, 'rules/customer.database.rules.json'), 'utf8');
    environments.push(await initializeTestEnvironment({ projectId: 'new-customer-management-system', database: { ...ports, rules: customerRules } }));
    const noClaimsEmail = await addAccount({});
    const authFailure = await browser.newContext();
    const authFailurePage = await authFailure.newPage();
    await authFailurePage.goto(`http://127.0.0.1:8766/${encodeURIComponent('新客管理.html')}`);
    await authFailurePage.locator('#aliceAuthForm input[name="email"]').fill(noClaimsEmail);
    await authFailurePage.locator('#aliceAuthForm input[name="password"]').fill('Wrong-synthetic-password!');
    await authFailurePage.locator('#aliceAuthForm button').click();
    await authFailurePage.locator('#aliceAuthMessage').filter({ hasText: '登入失敗' }).waitFor({ timeout: 15000 });
    assert.equal(await authFailurePage.locator('#aliceAuthBar').isVisible(), false);
    await authFailurePage.locator('#aliceAuthForm input[name="password"]').fill(password);
    await authFailurePage.locator('#aliceAuthForm button').click();
    await authFailurePage.locator('#aliceAuthMessage').filter({ hasText: '沒有本系統的使用權限' }).waitFor({ timeout: 15000 });
    assert.equal(await authFailurePage.locator('#aliceAuthBar').isVisible(), false);
    await authFailure.close();
    const customerEmail = await addAccount({ aliceApp: 'customer', aliceRole: 'designer', aliceDesigner: 'JAY' });
    const customer = await openAndLogin('新客管理.html', customerEmail);
    await customer.page.waitForFunction(() => document.querySelector('#currentDesigner')?.value === 'JAY');
    await customer.page.locator('#name').fill('Synthetic Customer');
    await customer.page.locator('#addBtn').click();
    await customer.page.locator('#tableBody').getByText('Synthetic Customer').waitFor({ timeout: 15000 });
    await customer.page.locator('#tableBody input[data-field="result"]').fill('Synthetic follow up');
    await customer.page.locator('#tableBody input[data-field="result"]').dispatchEvent('change');
    await customer.page.reload();
    await customer.page.locator('#tableBody').getByText('Synthetic Customer').waitFor({ timeout: 15000 });
    await customer.page.locator('#tableBody .del-btn').click();
    await customer.page.locator('#tableBody').getByText('Synthetic Customer').waitFor({ state: 'detached', timeout: 15000 });
    await customer.page.locator('#aliceAuthBar button').click();
    await customer.page.locator('#aliceAuthForm').waitFor({ state: 'visible' });
    await customer.context.close();

    const customerManagerEmail = await addAccount({ aliceApp: 'customer', aliceRole: 'manager' });
    const customerManager = await openAndLogin('新客管理.html', customerManagerEmail);
    await customerManager.page.locator('#currentDesigner').selectOption('IRIS');
    await customerManager.page.locator('#name').fill('Synthetic Manager Customer');
    await customerManager.page.locator('#addBtn').click();
    await customerManager.page.locator('#tableBody').getByText('Synthetic Manager Customer').waitFor({ timeout: 15000 });
    const jayAgain = await openAndLogin('新客管理.html', customerEmail);
    await jayAgain.page.waitForFunction(() => document.querySelector('#currentDesigner')?.value === 'JAY');
    await jayAgain.page.locator('#tableBody .empty-state').waitFor({ timeout: 15000 });
    assert.equal(await jayAgain.page.locator('#tableBody').getByText('Synthetic Manager Customer').count(), 0);
    await jayAgain.context.close();
    await customerManager.page.reload();
    await customerManager.page.locator('#aliceAuthBar').waitFor({ state: 'visible', timeout: 15000 });
    await customerManager.page.locator('#currentDesigner').selectOption('IRIS');
    await customerManager.page.locator('#tableBody').getByText('Synthetic Manager Customer').waitFor({ timeout: 15000 });
    await customerManager.page.locator('#tableBody .del-btn').click();
    await customerManager.page.locator('#tableBody').getByText('Synthetic Manager Customer').waitFor({ state: 'detached', timeout: 15000 });
    await customerManager.context.close();

    const preorderRules = await readFile(join(securityRoot, 'rules/preorder.database.rules.json'), 'utf8');
    environments.push(await initializeTestEnvironment({ projectId: 'pre-order-registration', database: { ...ports, rules: preorderRules } }));
    const preorderEmail = await addAccount({ aliceApp: 'preorder', aliceRole: 'staff' });
    const preorder = await openAndLogin('Product Pre-Order.html', preorderEmail);
    await preorder.page.locator('#submitBtn').waitFor({ state: 'visible' });
    await preorder.page.waitForFunction(() => !document.querySelector('#submitBtn')?.disabled);
    await preorder.page.locator('#customerName').fill('Synthetic Customer');
    await preorder.page.locator('#contactPlatform').selectOption('電話');
    await preorder.page.locator('#product').fill('Synthetic product');
    await preorder.page.locator('#phone').fill('0000000000');
    await preorder.page.locator('#submitBtn').click();
    await preorder.page.locator('#reservationList').getByText('Synthetic Customer').waitFor({ timeout: 15000 });
    await preorder.page.reload();
    await preorder.page.locator('#reservationList').getByText('Synthetic Customer').waitFor({ timeout: 15000 });
    assert.equal(await preorder.page.locator('#reservationList .delete-btn').count(), 0, '一般預購 staff 不應看到刪除按鈕');
    await preorder.page.locator('#aliceAuthBar button').click();
    await preorder.page.locator('#aliceAuthForm').waitFor({ state: 'visible' });
    const preorderSupervisorEmail = await addAccount({ aliceApp: 'preorder', aliceRole: 'staff', aliceCanDelete: true });
    await preorder.page.locator('#aliceAuthForm input[name="email"]').fill(preorderSupervisorEmail);
    await preorder.page.locator('#aliceAuthForm input[name="password"]').fill(password);
    await preorder.page.locator('#aliceAuthForm button').click();
    await preorder.page.locator('#aliceAuthBar').waitFor({ state: 'visible', timeout: 30000 });
    assert.equal(await preorder.page.locator('#reservationList .delete-btn').count(), 0, '含舊刪除 claim 的主管也不應看到刪除按鈕');
    await preorder.page.locator('#aliceAuthBar button').click();
    await preorder.page.locator('#aliceAuthForm').waitFor({ state: 'visible' });
    await preorder.context.close();

    const hrRules = await readFile(join(securityRoot, 'rules/hr.firestore.rules'), 'utf8');
    const hrEnv = await initializeTestEnvironment({ projectId: 'hr-system-ad937',
      firestore: { host: '127.0.0.1', port: 8080, rules: hrRules } });
    environments.push(hrEnv);
    await hrEnv.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'salon', 'main'), {
        staff: [{ id: 'synthetic-staff', name: 'JAY', active: true, createdAt: 1 }],
        entitlements: [{ staffId: 'synthetic-staff', year: new Date().getFullYear(), quotaHours: 56, carryHours: 0 }],
        leaves: [], trainings: [], legacyExtra: { keep: 'yes' }
      });
    });
    const hrEmail = await addAccount({ aliceApp: 'hr', aliceRole: 'manager' });
    const hr = await openAndLogin('休假進修管理.html', hrEmail);
    await hr.page.locator('#lAdd').waitFor({ state: 'visible', timeout: 15000 });
    await hr.page.locator('#lNote').fill('Synthetic leave');
    await hr.page.locator('#lAdd').click();
    await hr.page.locator('#lTableWrap').getByText('Synthetic leave').waitFor({ timeout: 15000 });
    await hr.page.locator('#hrWriteMessage').filter({ hasText: '已儲存至雲端並重新讀取確認。' }).waitFor({ timeout: 15000 });
    await hr.page.reload();
    await hr.page.locator('#lTableWrap').getByText('Synthetic leave').waitFor({ timeout: 15000 });
    await hr.page.locator('#lTableWrap .del').click();
    await hr.page.locator('#lTableWrap').getByText('Synthetic leave').waitFor({ state: 'detached', timeout: 15000 });
    await hr.page.locator('#hrWriteMessage').filter({ hasText: '已儲存至雲端並重新讀取確認。' }).waitFor({ timeout: 15000 });

    const secondHrEmail = await addAccount({ aliceApp: 'hr', aliceRole: 'manager' });
    const secondHr = await openAndLogin('休假進修管理.html', secondHrEmail);
    await secondHr.page.locator('#lAdd').waitFor({ state: 'visible', timeout: 15000 });
    await hr.page.locator('#lNote').fill('Device A leave');
    await secondHr.page.locator('#lNote').fill('Device B leave');
    await Promise.all([hr.page.locator('#lAdd').click(), secondHr.page.locator('#lAdd').click()]);
    await Promise.all([
      hr.page.locator('#hrWriteMessage').filter({ hasText: '已儲存至雲端並重新讀取確認。' }).waitFor({ timeout: 15000 }),
      secondHr.page.locator('#hrWriteMessage').filter({ hasText: '已儲存至雲端並重新讀取確認。' }).waitFor({ timeout: 15000 })
    ]);
    await hr.page.locator('#lTableWrap').getByText('Device A leave').waitFor();
    await hr.page.locator('#lTableWrap').getByText('Device B leave').waitFor();
    await secondHr.context.close();

    await hr.page.locator('.nav-btn[data-tab="staff"]').click();
    await hr.page.locator('#sName').fill('Synthetic Staff');
    await hr.page.locator('#sAdd').click();
    await hr.page.locator('#hrWriteMessage').filter({ hasText: '已儲存至雲端並重新讀取確認。' }).waitFor({ timeout: 15000 });
    await hr.page.locator('#sTbody input[value="Synthetic Staff"]').waitFor();
    await hr.page.locator('.nav-btn[data-tab="entitlement"]').click();
    await hr.page.locator('#eTblWrap .e-del').click();
    await hr.page.locator('#hrWriteMessage').filter({ hasText: '已儲存至雲端並重新讀取確認。' }).waitFor({ timeout: 15000 });
    await hr.page.locator('#eStaff').selectOption({ label: 'Synthetic Staff' });
    await hr.page.locator('#eQuota').fill('72');
    await hr.page.locator('#eUpsert').click();
    await hr.page.locator('#hrWriteMessage').filter({ hasText: '已儲存至雲端並重新讀取確認。' }).waitFor({ timeout: 15000 });
    await hr.page.locator('#eTblWrap').getByText('Synthetic Staff').waitFor();
    await hr.page.locator('.nav-btn[data-tab="training"]').click();
    await hr.page.locator('#tStaff').selectOption({ label: 'Synthetic Staff' });
    await hr.page.locator('#tCourse').fill('Synthetic course');
    await hr.page.locator('#tAdd').click();
    await hr.page.locator('#hrWriteMessage').filter({ hasText: '已儲存至雲端並重新讀取確認。' }).waitFor({ timeout: 15000 });
    await hr.page.locator('#tTblWrap').getByText('Synthetic course').waitFor();

    const conflictHr = await openAndLogin('休假進修管理.html', secondHrEmail);
    await conflictHr.page.locator('.nav-btn[data-tab="staff"]').click();
    await hr.page.locator('.nav-btn[data-tab="staff"]').click();
    const staleName = conflictHr.page.locator('#sTbody input[value="Synthetic Staff"]');
    await staleName.fill('Device B name');
    const firstName = hr.page.locator('#sTbody input[value="Synthetic Staff"]');
    await firstName.fill('Device A name');
    await firstName.press('Enter');
    await hr.page.locator('#hrWriteMessage').filter({ hasText: '已儲存至雲端並重新讀取確認。' }).waitFor({ timeout: 15000 });
    assert.equal(await staleName.inputValue(), 'Device B name');
    await staleName.press('Enter');
    await conflictHr.page.locator('#hrWriteMessage').filter({ hasText: '其他裝置已修改相同資料' }).waitFor({ timeout: 15000 });
    await conflictHr.page.locator('#aliceAuthBar button').click();
    assert.equal(await conflictHr.page.locator('#aliceAuthBar').isVisible(), true);
    await conflictHr.page.locator('#hrDiscardDraft').click();
    await conflictHr.page.locator('#sTbody input[value="Device A name"]').waitFor({ timeout: 15000 });
    await conflictHr.context.close();

    const denyHrRules = `rules_version = '2';
      service cloud.firestore { match /databases/{database}/documents {
        match /salon/main { allow read: if request.auth != null; allow create, update, delete: if false; }
      } }`;
    environments.push(await initializeTestEnvironment({ projectId: 'hr-system-ad937',
      firestore: { host: '127.0.0.1', port: 8080, rules: denyHrRules } }));
    await hr.page.locator('.nav-btn[data-tab="leave"]').click();
    await hr.page.locator('#lNote').fill('Synthetic denied write');
    await hr.page.locator('#lAdd').click();
    await hr.page.locator('#hrWriteMessage').filter({ hasText: '權限不足' }).waitFor({ timeout: 15000 });
    assert.equal(await hr.page.evaluate(() => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    }), true);
    await hr.context.setOffline(true);
    await hr.page.waitForFunction(() => document.body.classList.contains('alice-offline'));
    await hr.context.setOffline(false);
    await hr.page.waitForFunction(() => !document.body.classList.contains('alice-offline'));
    assert.equal(await hr.page.locator('#page').evaluate(element => element.inert), true);
    await hr.page.locator('#aliceAuthBar button').click();
    assert.equal(await hr.page.locator('#aliceAuthBar').isVisible(), true);
    await hr.page.evaluate(async () => {
      const sdk = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
      await sdk.signOut(sdk.getAuth());
    });
    await hr.page.locator('#aliceAuthForm').waitFor({ state: 'visible' });
    await hr.page.locator('#aliceAuthForm input[name="email"]').fill(secondHrEmail);
    await hr.page.locator('#aliceAuthForm input[name="password"]').fill(password);
    await hr.page.locator('#aliceAuthForm button').click();
    await hr.page.locator('#aliceAuthMessage').filter({ hasText: '請使用原帳號重新登入並處理' })
      .waitFor({ timeout: 15000 });
    assert.equal(await hr.page.locator('#aliceAuthBar').isVisible(), false);
    await hr.page.locator('#aliceAuthForm input[name="email"]').fill(hrEmail);
    await hr.page.locator('#aliceAuthForm input[name="password"]').fill(password);
    await hr.page.locator('#aliceAuthForm button').click();
    await hr.page.locator('#aliceAuthBar').waitFor({ state: 'visible', timeout: 15000 });
    environments.push(await initializeTestEnvironment({ projectId: 'hr-system-ad937',
      firestore: { host: '127.0.0.1', port: 8080, rules: hrRules } }));
    await hr.page.locator('#hrRetryWrite').click();
    await hr.page.locator('#hrWriteMessage').filter({ hasText: '已儲存至雲端並重新讀取確認。' }).waitFor({ timeout: 15000 });
    assert.equal(await hr.page.evaluate(() => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    }), false);

    await hr.page.locator('.nav-btn[data-tab="leave"]').click();
    await hr.page.locator('#lNote').fill('Synthetic unsent form switch');
    await hr.page.evaluate(async () => {
      const sdk = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
      await sdk.signOut(sdk.getAuth());
    });
    await hr.page.locator('#aliceAuthForm').waitFor({ state: 'visible' });
    await hr.page.locator('#aliceAuthForm input[name="email"]').fill(secondHrEmail);
    await hr.page.locator('#aliceAuthForm input[name="password"]').fill(password);
    await hr.page.locator('#aliceAuthForm button').click();
    await hr.page.locator('#aliceAuthMessage').filter({ hasText: '請使用原帳號重新登入並處理' })
      .waitFor({ timeout: 15000 });
    assert.equal(await hr.page.locator('#page').evaluate(element => element.inert), true);
    await hr.page.locator('#aliceAuthForm input[name="email"]').fill(hrEmail);
    await hr.page.locator('#aliceAuthForm input[name="password"]').fill(password);
    await hr.page.locator('#aliceAuthForm button').click();
    await hr.page.locator('#aliceAuthBar').waitFor({ state: 'visible', timeout: 15000 });
    assert.equal(await hr.page.locator('#lNote').inputValue(), 'Synthetic unsent form switch');
    await hr.page.waitForFunction(() => !document.querySelector('#loadingOverlay'), { timeout: 15000 });
    await hr.page.locator('#aliceAuthBar button').click();
    await hr.page.locator('#aliceAuthForm').waitFor({ state: 'visible' });
    await hr.page.locator('#aliceAuthForm input[name="email"]').fill(hrEmail);
    await hr.page.locator('#aliceAuthForm input[name="password"]').fill(password);
    await hr.page.locator('#aliceAuthForm button').click();
    await hr.page.locator('#aliceAuthBar').waitFor({ state: 'visible', timeout: 15000 });
    assert.equal(await hr.page.locator('#lNote').inputValue(), '');

    await hr.page.locator('.nav-btn[data-tab="backup"]').click();
    await hr.page.locator('#bkFile').setInputFiles({
      name: 'synthetic-hr.json', mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({
        staff: [{ id: 'imported-staff', name: 'Imported staff', active: true }],
        entitlements: [], leaves: [], trainings: []
      }))
    });
    await hr.page.locator('#bkMsg').filter({ hasText: '匯入已送出' }).waitFor({ timeout: 15000 });
    await hr.page.locator('#hrWriteMessage').filter({ hasText: '已儲存至雲端並重新讀取確認。' }).waitFor({ timeout: 15000 });
    await hr.page.locator('#bkResetBtn').click();
    await hr.page.locator('#hrWriteMessage').filter({ hasText: '已儲存至雲端並重新讀取確認。' }).waitFor({ timeout: 15000 });
    await hrEnv.withSecurityRulesDisabled(async context => {
      const snapshot = await getDoc(doc(context.firestore(), 'salon', 'main'));
      assert.deepEqual(snapshot.data().legacyExtra, { keep: 'yes' });
      assert.equal(snapshot.data().entitlements.some(row => !row.id), false);
      assert.equal(snapshot.data().leaves.length, 0);
      assert.equal(snapshot.data().trainings.length, 0);
    });
    await hr.page.locator('#aliceAuthBar button').click();
    await hr.page.locator('#aliceAuthForm').waitFor({ state: 'visible' });
    await hr.context.close();
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
    for (const env of environments) await env.cleanup();
    await deleteApp(admin);
  }
});
