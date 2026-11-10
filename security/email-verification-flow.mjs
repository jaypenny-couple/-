export const EMAIL_VERIFICATION_PROJECTS = Object.freeze([
  'new-customer-management-system',
  'pre-order-registration',
  'restocking-list',
  'hr-system-ad937'
]);

function assertProject(auth, projectId) {
  const localEmulatorProject = projectId === 'demo-alice-p0' &&
    /^(127\.0\.0\.1|localhost):9099$/.test(process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '');
  if ((!EMAIL_VERIFICATION_PROJECTS.includes(projectId) && !localEmulatorProject) || auth?.app?.options?.projectId !== projectId) {
    throw new Error('Unsupported Firebase project.');
  }
}

async function withSignedInUser({ auth, projectId, email, password, sdk }, action) {
  assertProject(auth, projectId);
  if (!String(email ?? '').trim() || !String(password ?? '')) throw new Error('Email and password are required.');
  if (!sdk || typeof sdk.signInWithEmailAndPassword !== 'function' ||
      typeof sdk.signOut !== 'function' || typeof sdk.reload !== 'function') {
    throw new Error('Required Firebase Auth client methods are unavailable.');
  }

  let result;
  let failure;
  try {
    const credential = await sdk.signInWithEmailAndPassword(auth, String(email).trim(), password);
    await sdk.reload(credential.user);
    result = await action(credential.user);
  } catch (error) {
    const code = typeof error?.code === 'string' && /^auth\/[a-z-]+$/.test(error.code) ? error.code : '';
    failure = new Error(`Authentication or verification operation failed${code ? ` (${code})` : ''}. Check the local status and try again.`);
    if (code) failure.code = code;
  } finally {
    try { await sdk.signOut(auth); } catch { failure ??= new Error('Sign-out could not be confirmed. Close this process and sign in again only after checking Auth status.'); }
  }
  if (failure) throw failure;
  return result;
}

export function requestEmailVerification({ auth, projectId, email, password, sdk }) {
  if (!sdk || typeof sdk.sendEmailVerification !== 'function') throw new Error('Firebase email verification is unavailable.');
  return withSignedInUser({ auth, projectId, email, password, sdk }, async user => {
    if (!user.emailVerified) await sdk.sendEmailVerification(user);
    await sdk.reload(user);
    return Object.freeze({ emailVerified: Boolean(user.emailVerified), verificationRequested: !user.emailVerified });
  });
}

export function checkEmailVerification({ auth, projectId, email, password, sdk }) {
  return withSignedInUser({ auth, projectId, email, password, sdk }, async user => {
    await sdk.reload(user);
    return Object.freeze({ emailVerified: Boolean(user.emailVerified), verificationRequested: false });
  });
}

const standardTokenClaims = new Set([
  'iss', 'aud', 'auth_time', 'user_id', 'sub', 'iat', 'exp', 'email', 'email_verified', 'firebase',
  'name', 'picture', 'phone_number'
]);

// Reads the signed-in account's own UID, verification state and current custom claims (the claims "before" state).
// The caller must keep these values local and private; nothing here prints or stores them.
export function inspectSignedInAccount({ auth, projectId, email, password, sdk }) {
  if (!sdk || typeof sdk.getIdTokenResult !== 'function') throw new Error('Firebase ID token inspection is unavailable.');
  return withSignedInUser({ auth, projectId, email, password, sdk }, async user => {
    await sdk.reload(user);
    const token = await sdk.getIdTokenResult(user, true);
    const customClaims = Object.fromEntries(Object.entries(token?.claims ?? {})
      .filter(([key]) => !standardTokenClaims.has(key)));
    return Object.freeze({
      uid: String(user.uid),
      signedInEmail: String(user.email ?? ''),
      emailVerified: Boolean(user.emailVerified),
      customClaims
    });
  });
}
