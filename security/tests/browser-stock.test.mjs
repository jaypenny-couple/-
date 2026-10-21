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

const securityRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const siteRoot = resolve(securityRoot, '..');
const rules = await readFile(join(securityRoot, 'rules/stock.database.rules.json'), 'utf8');
const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

test('缺貨頁：本機 Auth/RTDB 登入、CRUD、重新整理、斷線恢復與登出', async () => {
  for (const key of ['FIREBASE_AUTH_EMULATOR_HOST', 'FIREBASE_DATABASE_EMULATOR_HOST']) {
    assert.ok(process.env[key]?.startsWith('127.0.0.1:'), `Missing safe local emulator: ${key}`);
  }
  const env = await initializeTestEnvironment({
    projectId: 'restocking-list', database: { host: '127.0.0.1', port: 9000, rules }
  });
  // The Auth emulator maps unregistered production API keys to its demo project.
  const admin = initializeApp({ projectId: 'demo-alice-p0' }, 'stock-browser-test');
  const email = `synthetic-${Date.now()}@example.invalid`;
  const password = 'Synthetic-password-123!';
  const user = await getAuth(admin).createUser({ email, password, emailVerified: true });
  await getAuth(admin).setCustomUserClaims(user.uid, { aliceApp: 'stock', aliceRole: 'staff' });
  const supervisorEmail = `synthetic-supervisor-${Date.now()}@example.invalid`;
  const supervisor = await getAuth(admin).createUser({ email: supervisorEmail, password, emailVerified: true });
  await getAuth(admin).setCustomUserClaims(supervisor.uid, { aliceApp: 'stock', aliceRole: 'staff', aliceCanDelete: true });
  const server = createServer(async (req, res) => {
    const path = resolve(siteRoot, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (!path.startsWith(siteRoot + sep)) { res.writeHead(403).end(); return; }
    try {
      const body = await readFile(path);
      res.setHeader('Content-Type', { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' }[extname(path)] ?? 'application/octet-stream');
      res.end(body);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(8765, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: edge, headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const warnings = [];
    page.on('console', entry => { if (entry.type() === 'warning' || entry.type() === 'error') warnings.push(entry.text()); });
    page.on('pageerror', error => warnings.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    await page.goto('http://127.0.0.1:8765/shortlist.html');
    await page.locator('#aliceAuthForm input[name="email"]').fill(email);
    await page.locator('#aliceAuthForm input[name="password"]').fill(password);
    await page.locator('#aliceAuthForm button').click();
    await page.waitForTimeout(1500);
    assert.equal(await page.locator('#aliceAuthMessage').textContent(), '', `登入錯誤或權限不足: ${warnings.join(' | ')}`);
    await page.locator('#aliceAuthBar').waitFor({ state: 'visible', timeout: 30000 });
    await page.locator('#vendor').selectOption('肯邦');
    await page.locator('#item').fill('Synthetic item');
    await page.locator('#submitBtn').click();
    await page.locator('#result .result-item').waitFor({ timeout: 15000 });
    assert.match(await page.locator('#result').textContent(), /Synthetic item/);
    assert.equal(await page.locator('#result .delete-btn').count(), 0, '一般 staff 不應看到刪除按鈕');
    await page.reload();
    await page.locator('#aliceAuthBar').waitFor({ state: 'visible', timeout: 30000 });
    await context.setOffline(true);
    await page.waitForFunction(() => document.body.classList.contains('alice-offline'));
    assert.equal(await page.locator('#aliceNetworkStatus').isVisible(), true);
    await context.setOffline(false);
    await page.waitForFunction(() => !document.body.classList.contains('alice-offline'));
    await page.waitForFunction(() => document.querySelector('#status')?.textContent?.includes('已連接'), null, { timeout: 15000 });
    await page.locator('#aliceAuthBar button').click();
    await page.locator('#aliceAuthForm').waitFor({ state: 'visible' });
    await page.locator('#aliceAuthForm input[name="email"]').fill(supervisorEmail);
    await page.locator('#aliceAuthForm input[name="password"]').fill(password);
    await page.locator('#aliceAuthForm button').click();
    await page.locator('#aliceAuthBar').waitFor({ state: 'visible', timeout: 30000 });
    await page.locator('#result .delete-btn').first().click();
    await page.locator('#result .result-item').waitFor({ state: 'detached', timeout: 15000 });
    await page.locator('#aliceAuthBar button').click();
    await page.locator('#aliceAuthForm').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#aliceAuthBar').isVisible(), false);
    await context.close();
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
    await env.cleanup();
    await deleteApp(admin);
  }
});
