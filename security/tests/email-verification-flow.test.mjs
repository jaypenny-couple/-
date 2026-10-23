import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp as initializeClientApp, deleteApp as deleteClientApp } from 'firebase/app';
import {
  connectAuthEmulator, inMemoryPersistence, initializeAuth, reload,
  sendEmailVerification, signInWithEmailAndPassword, signOut
} from 'firebase/auth';
import { initializeApp as initializeAdminApp, deleteApp as deleteAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { checkEmailVerification, requestEmailVerification } from '../email-verification-flow.mjs';

test('本機 Email 驗證流程只對既有 Emulator 帳號登入、寄送、reload 並登出', async () => {
  const emulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  assert.ok(emulatorHost && /^(127\.0\.0\.1|localhost):9099$/.test(emulatorHost),
    'Refusing unless Firebase Auth Emulator is on localhost:9099.');

  const projectId = 'demo-alice-p0';
  const run = `email-verification-${Date.now()}`;
  const adminApp = initializeAdminApp({ projectId }, `${run}-admin`);
  const clientApp = initializeClientApp({ projectId, apiKey: 'emulator-only' }, `${run}-client`);
  const adminAuth = getAdminAuth(adminApp);
  const auth = initializeAuth(clientApp, { persistence: inMemoryPersistence });
  connectAuthEmulator(auth, `http://${emulatorHost}`, { disableWarnings: true });
  const email = `alice-p0-verification-${Date.now()}@example.invalid`;
  const password = 'Synthetic-Only-Email-Verify-51!';
  const sdk = { signInWithEmailAndPassword, sendEmailVerification, reload, signOut };
  let uid;

  try {
    const created = await adminAuth.createUser({ email, password, emailVerified: false, disabled: false });
    uid = created.uid;
    const sent = await requestEmailVerification({ auth, projectId, email, password, sdk });
    assert.deepEqual(sent, { emailVerified: false, verificationRequested: true });
    assert.equal(auth.currentUser, null, 'flow signs out after sending');

    await adminAuth.updateUser(uid, { emailVerified: true });
    const checked = await checkEmailVerification({ auth, projectId, email, password, sdk });
    assert.deepEqual(checked, { emailVerified: true, verificationRequested: false });
    assert.equal(auth.currentUser, null, 'flow signs out after checking');

    await assert.rejects(() => requestEmailVerification({ auth, projectId, email, password: 'wrong synthetic password', sdk }));
    assert.equal(auth.currentUser, null, 'failed sign-in does not leave an Auth session');

    await assert.rejects(() => requestEmailVerification({
      auth, projectId: 'restocking-list', email, password, sdk
    }), /Unsupported Firebase project/);
  } finally {
    if (uid) await adminAuth.deleteUser(uid).catch(() => {});
    await signOut(auth).catch(() => {});
    await deleteClientApp(clientApp);
    await deleteAdminApp(adminApp);
  }
});
