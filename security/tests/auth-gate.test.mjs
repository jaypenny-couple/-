import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createAuthGate } from '../auth-gate.js';

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

function setup(initialUser = null, claims = { aliceApp: 'stock', aliceRole: 'staff' }) {
  const dom = new JSDOM('<!doctype html><body class="auth-pending"><main id="app"></main></body>');
  globalThis.document = dom.window.document;
  let user = initialUser;
  let observer;
  let loginError = null;
  let tokenError = null;
  const sdk = {
    getAuth: () => ({}),
    onAuthStateChanged(_auth, callback) { observer = callback; queueMicrotask(() => callback(user)); },
    async signInWithEmailAndPassword() {
      if (loginError) throw loginError;
      user = { uid: 'synthetic-staff' };
      await observer(user);
    },
    async getIdTokenResult() {
      if (tokenError) throw tokenError;
      return { claims };
    },
    async signOut() { user = null; await observer(null); }
  };
  let ready = 0;
  let stopped = 0;
  const gate = createAuthGate({}, sdk, {
    access: 'stock', roles: ['staff', 'manager'],
    onReady() { ready++; }, onStop() { stopped++; }
  });
  return {
    dom, gate, sdk, get ready() { return ready; }, get stopped() { return stopped; },
    setLoginError(error) { loginError = error; },
    setTokenError(error) { tokenError = error; }
  };
}

async function submit(dom) {
  const form = dom.window.document.querySelector('#aliceAuthForm');
  form.elements.email.value = 'staff@example.invalid';
  form.elements.password.value = 'synthetic-password';
  form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  await tick();
}

test('登入、登出與重新整理後的既有登入狀態', async () => {
  const first = setup();
  await tick();
  assert.equal(first.gate.isAuthorized(), false);
  await submit(first.dom);
  assert.equal(first.gate.isAuthorized(), true);
  assert.equal(first.ready, 1);
  assert.equal(first.dom.window.document.body.classList.contains('auth-pending'), false);
  first.dom.window.document.querySelector('#aliceAuthBar button').click();
  await tick();
  assert.equal(first.gate.isAuthorized(), false);
  assert.ok(first.stopped >= 2);
  const refreshed = setup({ uid: 'synthetic-staff' });
  await tick();
  assert.equal(refreshed.gate.isAuthorized(), true);
  assert.equal(refreshed.ready, 1);
});

test('錯誤角色與網路失敗時不顯示資料頁', async () => {
  const wrong = setup(null, { aliceApp: 'customer', aliceRole: 'staff' });
  await tick();
  await submit(wrong.dom);
  assert.equal(wrong.gate.isAuthorized(), false);
  assert.match(wrong.dom.window.document.querySelector('#aliceAuthMessage').textContent, /沒有本系統/);
  const network = setup();
  network.setLoginError({ code: 'auth/network-request-failed' });
  await tick();
  await submit(network.dom);
  assert.equal(network.gate.isAuthorized(), false);
  assert.match(network.dom.window.document.querySelector('#aliceAuthMessage').textContent, /網路中斷/);
  network.setLoginError(null);
  await submit(network.dom);
  assert.equal(network.gate.isAuthorized(), true);
  Object.defineProperty(network.dom.window.navigator, 'onLine', { configurable: true, value: false });
  network.dom.window.dispatchEvent(new network.dom.window.Event('offline'));
  assert.equal(network.dom.window.document.body.classList.contains('alice-offline'), true);
  Object.defineProperty(network.dom.window.navigator, 'onLine', { configurable: true, value: true });
  network.dom.window.dispatchEvent(new network.dom.window.Event('online'));
  assert.equal(network.dom.window.document.body.classList.contains('alice-offline'), false);
  network.setTokenError(new Error('offline'));
  await network.sdk.signOut();
  const refreshedOffline = setup({ uid: 'synthetic-staff' });
  refreshedOffline.setTokenError(new Error('offline'));
  await tick();
  assert.equal(refreshedOffline.gate.isAuthorized(), false);
});
