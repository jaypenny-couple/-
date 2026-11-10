// Run only on a trusted administrator's computer with Application Default Credentials.
// This phase permits dry-run only. Formal claim application is explicitly disabled.
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { buildStaffClaims } from './staff-claim-policy.js';

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index < 0 ? null : args[index + 1];
};
const projectId = option('--project');
const uid = option('--uid');
const role = option('--role');
const designer = option('--designer');
const apply = args.includes('--apply');
if (!projectId || !uid || !/^[a-zA-Z0-9:_-]{1,128}$/.test(uid)) {
  throw new Error('Provide a supported --project and Firebase Auth --uid.');
}
if (args.includes('--can-delete')) throw new Error('--can-delete has been retired; client-side RTDB deletion is disabled.');
const { app } = buildStaffClaims({}, { projectId, role, designer });
if (apply) {
  throw new Error('Formal Custom Claims application is disabled in this staging phase; only dry-run plans are allowed.');
}

const auth = getAuth(initializeApp({ credential: applicationDefault(), projectId }));
const user = await auth.getUser(uid);
if (user.disabled || !user.emailVerified) throw new Error('Account must be enabled and email verified.');
const before = user.customClaims ?? {};
buildStaffClaims(before, { projectId, role, designer });
if (!apply) {
  console.log(`DRY RUN: ${projectId} UID eligibility checked for role ${role}; any existing aliceCanDelete claim will be removed and cannot grant deletion. Before any future application, save complete prior claims to a private backup and verify a restore plan. No claim changed.`);
  process.exit(0);
}
