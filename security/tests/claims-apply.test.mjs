import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { applyClaims, claimsSha256, identityToolkitClient, rollbackClaims, validatePlan } from '../claims-apply.mjs';
import { buildStaffClaimsDryRun } from '../staff-claim-policy.js';

test('Claims 核發：前態核對、先備份、核發、讀回、重複執行、竄改計畫、漂移、讀回不符自動還原與回復', async () => {
  const host = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  assert.ok(host && /^(127\.0\.0\.1|localhost):9099$/.test(host), 'Refusing unless Auth Emulator is on localhost:9099.');
  const projectId = 'restocking-list';
  const admin = initializeApp({ projectId }, `claims-apply-${Date.now()}`);
  const adminAuth = getAuth(admin);
  const email = `claims-apply-${Date.now()}@example.invalid`;
  const user = await adminAuth.createUser({ email, password: 'Synthetic-Claims-91!', emailVerified: true });
  const seenHeaders = [];
  const fetchImpl = (url, init) => { seenHeaders.push(init.headers); return fetch(url, init); };
  const client = identityToolkitClient({ fetchImpl, baseUrl: `http://${host}/identitytoolkit.googleapis.com`, projectId, getToken: async () => 'owner' });
  const rosterRow = { AccountUID: user.uid, AccountStatus: 'ENABLED', EmailVerificationStatus: 'VERIFIED-CLIENT-SDK-2026-10-26', SystemRole: 'staff', ApprovedEmail: email };
  const plan = buildStaffClaimsDryRun({}, { projectId, uid: user.uid, role: 'staff', accountEnabled: true, emailVerified: true });
  try {
    const { uid, before, after } = validatePlan({ plan, projectId, rosterRow });
    assert.deepEqual(after, { aliceApp: 'stock', aliceRole: 'staff' });
    assert.throws(() => validatePlan({ plan: { ...plan, after: { ...plan.after, aliceRole: 'manager' } }, projectId, rosterRow }), e => e.safeReason === 'plan-hash-mismatch');
    assert.throws(() => validatePlan({ plan, projectId, rosterRow: { ...rosterRow, AccountUID: 'OtherUid1234567890' } }), e => e.safeReason === 'plan-uid-does-not-match-roster');
    assert.throws(() => validatePlan({ plan, projectId: 'hr-system-ad937', rosterRow }), e => e.safeReason === 'plan-missing-for-project');
    assert.throws(() => validatePlan({ plan, projectId, rosterRow: { ...rosterRow, EmailVerificationStatus: 'PENDING-EMAIL-LINK' } }), e => e.safeReason === 'roster-account-not-enabled-and-verified');

    await assert.rejects(() => applyClaims({ client, uid, before, after, approvedEmail: 'other@example.invalid', saveBackup: async () => assert.fail('no backup on refusal') }),
      e => e.safeReason === 'account-email-does-not-match-approved-email');

    const backups = [];
    const applied = await applyClaims({ client, uid, before, after, approvedEmail: email, saveBackup: async b => { backups.push(b); } });
    assert.equal(applied.status, 'applied');
    assert.equal(backups.length, 1, 'backup is saved before writing');
    assert.deepEqual(backups[0].before, {});
    assert.deepEqual((await adminAuth.getUser(uid)).customClaims, after);
    assert.ok(seenHeaders.every(h => h['X-Goog-User-Project'] === projectId), 'quota project header is always the target project');
    assert.equal(JSON.stringify(applied).includes(uid), false, 'printable outcome never contains the UID');

    const again = await applyClaims({ client, uid, before, after, approvedEmail: email, saveBackup: async () => assert.fail('no second backup') });
    assert.equal(again.status, 'already-applied');

    await assert.rejects(() => rollbackClaims({ client, uid, backupBefore: {}, expectedLive: { aliceApp: 'stock', aliceRole: 'manager' } }),
      e => e.safeReason === 'live-claims-changed-since-apply-manual-review');
    const rolledBack = await rollbackClaims({ client, uid, backupBefore: backups[0].before, expectedLive: after });
    assert.equal(rolledBack.status, 'rolled-back');
    assert.deepEqual((await adminAuth.getUser(uid)).customClaims ?? {}, {});
    assert.equal(rolledBack.claimsSha256, claimsSha256({}));

    await adminAuth.setCustomUserClaims(uid, { unexpected: true });
    await assert.rejects(() => applyClaims({ client, uid, before, after, approvedEmail: email, saveBackup: async () => assert.fail('no backup on drift') }),
      e => e.safeReason === 'live-claims-differ-from-plan-before-state');
    await adminAuth.setCustomUserClaims(uid, null);

    const faulty = { lookup: client.lookup, setClaims: (id, claims) => client.setClaims(id, canonicalEq(claims, after) ? { ...claims, aliceCanDelete: true } : claims) };
    await assert.rejects(() => applyClaims({ client: faulty, uid, before, after, approvedEmail: email, saveBackup: async () => {} }),
      e => e.safeReason === 'read-back-mismatch-restored-before-state');
    assert.deepEqual((await adminAuth.getUser(uid)).customClaims ?? {}, {}, 'faulty write was restored to the before-state');

    await adminAuth.updateUser(uid, { disabled: true });
    await assert.rejects(() => applyClaims({ client, uid, before, after, approvedEmail: email, saveBackup: async () => assert.fail() }), e => e.safeReason === 'account-disabled');
  } finally {
    await adminAuth.deleteUser(user.uid).catch(() => {});
    await deleteApp(admin);
  }
});

function canonicalEq(a, b) { return claimsSha256(a) === claimsSha256(b); }
