// Run only on a trusted administrator's computer with Application Default Credentials.
// This phase permits dry-run only. Formal claim application is explicitly disabled.
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, resolve, sep } from 'node:path';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { buildStaffClaims, validateDeletionApproval } from './staff-claim-policy.js';

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index < 0 ? null : args[index + 1];
};
const projectId = option('--project');
const uid = option('--uid');
const role = option('--role');
const designer = option('--designer');
const canDeleteOption = option('--can-delete');
const canDelete = canDeleteOption === null ? undefined : canDeleteOption === 'true' ? true : canDeleteOption === 'false' ? false : 'invalid';
const approvalFile = option('--approval-file');
const apply = args.includes('--apply');
if (!projectId || !uid || !/^[a-zA-Z0-9:_-]{1,128}$/.test(uid)) {
  throw new Error('Provide a supported --project and Firebase Auth --uid.');
}
if (canDelete === 'invalid') throw new Error('--can-delete must be exactly true or false.');
const { app } = buildStaffClaims({}, { projectId, role, designer, canDelete });
if (app === 'preorder' || app === 'stock') {
  if (!approvalFile || !isAbsolute(approvalFile) || !existsSync(approvalFile)) throw new Error('Provide an existing private --approval-file for this exact project and UID.');
  const privateRoot = resolve(process.env.LOCALAPPDATA ?? '', 'ALICE-P0-PRIVATE-BACKUPS', 'EMPLOYEE-ACCESS-ACCEPTANCE').toLowerCase();
  const approvedPath = realpathSync(approvalFile).toLowerCase();
  if (!privateRoot || !approvedPath.startsWith(privateRoot + sep)) throw new Error('Approval record must be inside the protected private employee-access directory.');
  const record = JSON.parse(readFileSync(approvalFile, 'utf8'));
  validateDeletionApproval(record, { projectId, uid, role, app, canDelete });
}
if (apply) {
  throw new Error('Formal Custom Claims application is disabled in this staging phase; only dry-run plans are allowed.');
}

const auth = getAuth(initializeApp({ credential: applicationDefault(), projectId }));
const user = await auth.getUser(uid);
if (user.disabled || !user.emailVerified) throw new Error('Account must be enabled and email verified.');
const before = user.customClaims ?? {};
buildStaffClaims(before, { projectId, role, designer, canDelete });
if (!apply) {
  console.log(`DRY RUN: ${projectId} UID eligibility checked for role ${role}; aliceCanDelete=${app === 'preorder' || app === 'stock' ? canDelete : 'not applicable'}; existing aliceCanDelete will be removed outside preorder/stock; before any future application, save complete prior claims to a private backup and verify a restore plan. No claim changed.`);
  process.exit(0);
}
