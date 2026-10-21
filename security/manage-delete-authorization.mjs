// Staging-only administrator tool. It can inspect or create a private dry-run ledger
// against a local RTDB Emulator. Applying database changes is deliberately disabled.
import { createHash } from 'node:crypto';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { authorizationFromApproval, DELETE_AUTH_PROJECTS, sha256Json } from './delete-authorization-policy.js';

const FORMAL_WRITES_ENABLED = false;
const DATABASE_URLS = {
  'pre-order-registration': 'https://pre-order-registration-default-rtdb.asia-southeast1.firebasedatabase.app',
  'restocking-list': 'https://restocking-list-default-rtdb.firebaseio.com'
};
const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(name); return i < 0 ? null : args[i + 1]; };
const action = option('--action');
const projectId = option('--project');
const uid = option('--uid');
const approvalFile = option('--approval-file');
const apply = args.includes('--apply');
const privateBase = resolve(process.env.LOCALAPPDATA ?? '', 'ALICE-P0-PRIVATE-BACKUPS', 'EMPLOYEE-ACCESS-ACCEPTANCE');
const auditDir = join(privateBase, 'DELETE-AUTH-AUDIT');

function ensureStagingOnly() {
  if (apply && !FORMAL_WRITES_ENABLED) throw new Error('Authorization writes are disabled in this staging phase; --apply is permanently blocked here.');
  if (!DELETE_AUTH_PROJECTS[projectId]) throw new Error('Use exactly pre-order-registration or restocking-list.');
  if (!['status', 'grant', 'revoke'].includes(action)) throw new Error('Use --action status|grant|revoke.');
  if (!/^[A-Za-z0-9:_-]{1,128}$/.test(uid ?? '')) throw new Error('Provide a valid project-local Firebase Auth UID.');
  const emulator = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
  if (!emulator || !/^(127\.0\.0\.1|localhost):\d+$/.test(emulator)) {
    throw new Error('This staging tool only connects to a localhost Realtime Database Emulator. No live project was contacted.');
  }
}

async function requirePrivateFile(file) {
  if (!process.env.LOCALAPPDATA || !file || !isAbsolute(file)) throw new Error('An absolute --approval-file inside the protected local private directory is required.');
  const base = await realpath(privateBase);
  const actual = await realpath(file);
  const rel = relative(base, actual);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw new Error('Approval record must stay inside the protected employee-access directory.');
  return actual;
}

async function secureAuditDirectory() {
  if (!process.env.LOCALAPPDATA) throw new Error('LOCALAPPDATA is unavailable; private audit storage cannot be secured.');
  await mkdir(auditDir, { recursive: true, mode: 0o700 });
  const directory = await realpath(auditDir);
  if (process.platform === 'win32') {
    const account = execFileSync('whoami', [], { encoding: 'utf8' }).trim();
    execFileSync('icacls', [directory, '/inheritance:r', '/grant:r', `${account}:(OI)(CI)F`, 'SYSTEM:(OI)(CI)F'], { stdio: 'ignore' });
  }
  return directory;
}

async function main() {
  ensureStagingOnly();
  const app = initializeApp({ projectId, databaseURL: DATABASE_URLS[projectId] }, `alice-delete-auth-${process.pid}`);
  try {
    const db = getDatabase(app);
    const [host, port] = process.env.FIREBASE_DATABASE_EMULATOR_HOST.split(':');
    db.useEmulator(host, Number(port));
    const authRef = db.ref(`deletionAuthorizations/${uid}`);
    const beforeSnapshot = await authRef.get();
    const before = beforeSnapshot.exists() ? beforeSnapshot.val() : null;

    if (action === 'status') {
      const state = before === null ? 'ABSENT' : before === true ? 'ENABLED' : before === false ? 'DISABLED' : 'MALFORMED';
      console.log(`EMULATOR_STATUS project=${projectId} state=${state}`);
      return;
    }

    const approvalPath = await requirePrivateFile(approvalFile);
    const approval = JSON.parse(await readFile(approvalPath, 'utf8'));
    const after = authorizationFromApproval(approval, { projectId, uid, action });
    const directory = await secureAuditDirectory();
    const beforeJson = before === null ? null : JSON.stringify(before);
    const afterJson = JSON.stringify(after);
    const ledger = {
      format: 'alice-delete-authorization-dry-run-v1', mode: 'dry-run-only',
      projectId, uid, action, generatedAtUtc: new Date().toISOString(),
      approvalFileSha256: createHash('sha256').update(await readFile(approvalPath)).digest('hex'),
      before: { exists: before !== null, sha256: beforeJson === null ? null : createHash('sha256').update(beforeJson).digest('hex'), value: before },
      after: { sha256: createHash('sha256').update(afterJson).digest('hex'), value: after },
      note: 'No RTDB value was written. Formal writes are disabled in this build.'
    };
    const auditPath = join(directory, `delete-authorization-${projectId}-${Date.now()}.json`);
    await writeFile(auditPath, JSON.stringify(ledger, null, 2), { flag: 'wx', mode: 0o600 });
    console.log(`DRY_RUN_OK project=${projectId} action=${action} beforeSha256=${ledger.before.sha256 ?? 'absent'} afterSha256=${ledger.after.sha256}`);
    console.log(`PRIVATE_AUDIT_WRITTEN name=${auditPath.split(/[\\/]/).at(-1)} auditSha256=${sha256Json(ledger)}`);
  } finally {
    await deleteApp(app);
  }
}

main().catch(error => {
  console.error(`AUTHORIZATION_TOOL_STOPPED reason=${error.message}`);
  process.exitCode = 1;
});
