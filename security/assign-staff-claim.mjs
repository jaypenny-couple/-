// Run only on a trusted administrator's computer with Application Default Credentials.
// Dry run unless --apply and a private backup path are both supplied.
import { existsSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index < 0 ? null : args[index + 1];
};
const projectId = option('--project');
const uid = option('--uid');
const role = option('--role');
const designer = option('--designer');
const backupFile = option('--backup-file');
const apply = args.includes('--apply');
const apps = {
  'new-customer-management-system': 'customer',
  'pre-order-registration': 'preorder',
  'restocking-list': 'stock',
  'hr-system-ad937': 'hr'
};
if (!apps[projectId] || !uid || !/^[a-zA-Z0-9:_-]{1,128}$/.test(uid)) {
  throw new Error('Provide a supported --project and Firebase Auth --uid.');
}
const app = apps[projectId];
const allowedRoles = app === 'customer' ? ['manager', 'designer']
  : app === 'hr' ? ['manager'] : ['staff', 'manager'];
if (!allowedRoles.includes(role)) throw new Error('Role is not allowed for this project.');
if (role === 'designer' && !['JAY', 'IRIS', 'SHERRY', 'CINDY'].includes(designer)) {
  throw new Error('Designer must match an existing record designer value.');
}
if (role !== 'designer' && designer) throw new Error('Only designer accounts may use --designer.');
if (apply) {
  if (!backupFile || !isAbsolute(backupFile) || existsSync(backupFile)) {
    throw new Error('--apply requires a new absolute --backup-file outside this repository.');
  }
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..').toLowerCase();
  const privateParent = realpathSync(dirname(backupFile)).toLowerCase();
  if (privateParent === repoRoot || privateParent.startsWith(repoRoot + sep)) {
    throw new Error('Claim backup must be outside the public repository.');
  }
}

const auth = getAuth(initializeApp({ credential: applicationDefault(), projectId }));
const user = await auth.getUser(uid);
if (user.disabled || !user.emailVerified) throw new Error('Account must be enabled and email verified.');
const before = user.customClaims ?? {};
const next = { ...before, aliceApp: app, aliceRole: role };
delete next.aliceDesigner;
if (role === 'designer') next.aliceDesigner = designer;

if (!apply) {
  console.log(`DRY RUN: ${projectId} account is eligible for ${role}; no claim changed.`);
  process.exit(0);
}
writeFileSync(backupFile, JSON.stringify({ projectId, uid, savedAt: new Date().toISOString(), customClaims: before }, null, 2), {
  encoding: 'utf8', flag: 'wx', mode: 0o600
});
await auth.setCustomUserClaims(uid, next);
console.log(`Claim applied to ${projectId}; previous claims saved privately. User must sign in again or refresh token.`);
