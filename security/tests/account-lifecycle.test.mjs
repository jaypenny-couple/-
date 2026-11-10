import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deleteApp as deleteClientApp, initializeApp as initializeClientApp } from 'firebase/app';
import {
  applyActionCode, confirmPasswordReset, connectAuthEmulator, getAuth as getClientAuth,
  signInWithEmailAndPassword, verifyPasswordResetCode
} from 'firebase/auth';
import { initializeApp as initializeAdminApp, deleteApp as deleteAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';

test('Auth Emulator 合成帳號建立、Email 驗證、重設密碼、停用、重複及專案隔離流程', async () => {
  const emulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  assert.ok(emulatorHost && /^(127\.0\.0\.1|localhost):9099$/.test(emulatorHost),
    'Refusing account lifecycle test unless Firebase Auth Emulator is on localhost:9099.');

  const projectOne = 'demo-alice-p0';
  const projectTwo = 'demo-alice-p0-cross-project';
  const name = `account-lifecycle-${Date.now()}`;
  const adminAppOne = initializeAdminApp({ projectId: projectOne }, `${name}-admin-one`);
  const adminAppTwo = initializeAdminApp({ projectId: projectTwo }, `${name}-admin-two`);
  const clientAppOne = initializeClientApp({ projectId: projectOne, apiKey: 'emulator-only' }, `${name}-client-one`);
  const clientAuth = getClientAuth(clientAppOne);
  connectAuthEmulator(clientAuth, `http://${emulatorHost}`, { disableWarnings: true });
  const adminOne = getAdminAuth(adminAppOne);
  const adminTwo = getAdminAuth(adminAppTwo);
  const email = `alice-p0-${Date.now()}@example.invalid`;
  const initialPassword = 'Synthetic-Initial-Only-45!';
  const replacementPassword = 'Synthetic-Replaced-Only-67!';
  let uid;

  try {
    assert.equal(await adminOne.getUserByEmail(email).catch(error => error.code), 'auth/user-not-found');
    const created = await adminOne.createUser({ email, password: initialPassword, emailVerified: false, disabled: false });
    uid = created.uid;
    assert.equal(created.emailVerified, false);
    assert.equal(created.disabled, false);

    await assert.rejects(() => adminOne.createUser({ email, password: initialPassword }), { code: 'auth/email-already-exists' });
    await assert.rejects(() => signInWithEmailAndPassword(clientAuth, email, 'Synthetic-Wrong-Only-89!'), error =>
      ['auth/wrong-password', 'auth/invalid-credential'].includes(error.code));

    const verificationLink = await adminOne.generateEmailVerificationLink(email);
    const verificationCode = new URL(verificationLink).searchParams.get('oobCode');
    assert.ok(verificationCode);
    await applyActionCode(clientAuth, verificationCode);
    assert.equal((await adminOne.getUser(uid)).emailVerified, true);

    const resetLink = await adminOne.generatePasswordResetLink(email);
    const resetCode = new URL(resetLink).searchParams.get('oobCode');
    assert.ok(resetCode);
    assert.equal(await verifyPasswordResetCode(clientAuth, resetCode), email);
    await confirmPasswordReset(clientAuth, resetCode, replacementPassword);
    await signInWithEmailAndPassword(clientAuth, email, replacementPassword);

    await adminOne.setCustomUserClaims(uid, { aliceApp: 'stock', aliceRole: 'staff' });
    assert.deepEqual((await adminOne.getUser(uid)).customClaims, { aliceApp: 'stock', aliceRole: 'staff' });
    assert.equal(await adminTwo.getUserByEmail(email).catch(error => error.code), 'auth/user-not-found');

    await adminOne.updateUser(uid, { disabled: true });
    await assert.rejects(() => signInWithEmailAndPassword(clientAuth, email, replacementPassword), { code: 'auth/user-disabled' });
    assert.equal((await adminOne.getUser(uid)).disabled, true);
  } finally {
    if (uid) await adminOne.deleteUser(uid).catch(() => {});
    await clientAuth.signOut().catch(() => {});
    await deleteClientApp(clientAppOne);
    await deleteAdminApp(adminAppOne);
    await deleteAdminApp(adminAppTwo);
  }
});
