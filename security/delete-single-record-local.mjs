// Emulator-only trusted local deletion tool. No production apply mode exists.
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { assertApprovedLocalOperator, canonicalJson, parseSingleDeleteArgs, performSingleRecordDelete, sha256 } from './single-record-delete.js';

const DATABASES = Object.freeze({
  'pre-order-registration': { url: 'https://pre-order-registration-default-rtdb.asia-southeast1.firebasedatabase.app', collection: 'reservations' },
  'restocking-list': { url: 'https://restocking-list-default-rtdb.firebaseio.com', collection: 'stockItems' }
});
const args = process.argv.slice(2);

function requireLocalEmulator() {
  const value = process.env.FIREBASE_DATABASE_EMULATOR_HOST ?? '';
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(value)) throw new Error('EMULATOR_REQUIRED');
  const [host, port] = value.split(':');
  return { host, port: Number(port) };
}

async function privateDirectory() {
  if (!process.env.LOCALAPPDATA) throw new Error('PRIVATE_LOCALAPPDATA_REQUIRED');
  const requested = resolve(process.env.LOCALAPPDATA, 'ALICE-P0-PRIVATE-BACKUPS', 'RECORD-DELETIONS');
  await mkdir(requested, { recursive: true, mode: 0o700 });
  const actual = await realpath(requested);
  if (process.platform === 'win32') {
    const account = execFileSync('whoami', [], { encoding: 'utf8' }).trim();
    execFileSync('icacls', [actual, '/inheritance:r', '/grant:r', `${account}:(OI)(CI)F`, 'SYSTEM:(OI)(CI)F', '/T', '/C'], { stdio: 'ignore' });
  }
  return actual;
}

function privateStore(directory) {
  return {
    async writeBackup(bytes, info) {
      const fileName = `record-${info.projectId}-${Date.now()}-${randomUUID()}.json`;
      await writeFile(join(directory, fileName), bytes, { flag: 'wx', mode: 0o600 });
      return { fileName };
    },
    readBackup: fileName => readFile(join(directory, fileName)),
    async writeAudit(bytes, details) {
      const id = `${Date.now()}-${randomUUID()}`;
      const fileName = `audit-${id}.json`;
      await writeFile(join(directory, fileName), bytes, { flag: 'wx', mode: 0o600 });
      const hashName = `${fileName}.sha256`;
      await writeFile(join(directory, hashName), `${sha256(bytes)}  ${fileName}\n`, { flag: 'wx', mode: 0o600 });
      return { fileName, auditSha256: sha256(bytes), result: details.result };
    }
  };
}

async function main() {
  if (!stdin.isTTY) throw new Error('INTERACTIVE_CONFIRMATION_REQUIRED');
  const { projectId, recordId } = parseSingleDeleteArgs(args);
  const emulator = requireLocalEmulator();
  const database = DATABASES[projectId];
  const directory = await privateDirectory();
  const actor = execFileSync('whoami', [], { encoding: 'utf8' }).trim();
  const operatorApprovalFile = join(directory, 'DELETE-OPERATORS-APPROVAL.json');
  const operatorApproval = JSON.parse(await readFile(operatorApprovalFile, 'utf8'));
  const operator = assertApprovedLocalOperator(operatorApproval, { actor, projectId });
  const operatorApprovalSha256 = sha256(await readFile(operatorApprovalFile));
  const app = initializeApp({ projectId, databaseURL: database.url }, `alice-single-delete-${process.pid}`);
  const prompt = readline.createInterface({ input: stdin, output: stdout });
  try {
    const db = getDatabase(app);
    db.useEmulator(emulator.host, emulator.port);
    const adapter = {
      async readCollection(collection) {
        const snap = await db.ref(collection).get();
        return snap.exists() ? snap.val() : {};
      },
      async readRecord(collection, id) {
        const snap = await db.ref(`${collection}/${id}`).get();
        return snap.exists() ? snap.val() : null;
      },
      async deleteIfUnchanged(collection, id, expectedHash) {
        let changed = false;
        let matchedVersion = false;
        const result = await db.ref(`${collection}/${id}`).transaction(current => {
          // The first local transaction callback may have no cached value. Returning null
          // lets RTDB fetch server state and invoke the updater again; matchedVersion ensures
          // a concurrently deleted row cannot be reported as a deletion by this tool.
          if (current === null) return null;
          if (sha256(canonicalJson(current)) !== expectedHash) { changed = true; return; }
          matchedVersion = true;
          return null;
        }, undefined, false);
        return { committed: result.committed && matchedVersion, reason: changed ? 'changed' : 'not-committed' };
      }
    };

    const initialCollection = await adapter.readCollection(database.collection);
    const initialRecord = initialCollection?.[recordId];
    if (initialRecord === undefined || initialRecord === null) throw new Error('RECORD_NOT_FOUND');
    const expectedRecordSha256 = sha256(canonicalJson(initialRecord));
    stdout.write(`\n僅限本機 Emulator 單筆刪除\n專案：${projectId}\n路徑：${database.collection}/${recordId}\n紀錄狀態：存在（內容不在終端顯示）\n內容 SHA-256：${expectedRecordSha256}\n備份與稽核：${directory}\n\n`);
    const typedId = await prompt.question('再次輸入完整紀錄 ID：');
    if (typedId !== recordId) throw new Error('RECORD_ID_CONFIRMATION_MISMATCH');
    const typedDelete = await prompt.question('確認只刪除上述單筆，請輸入 DELETE：');
    if (typedDelete !== 'DELETE') throw new Error('DELETE_CONFIRMATION_MISSING');

    const result = await performSingleRecordDelete({
      projectId, recordId, actor: `${actor} (${operator.role})`, approvalRef: operator.approvalRef,
      approvalSha256: operatorApprovalSha256, confirmed: true, expectedRecordSha256,
      store: privateStore(directory), adapter
    });
    stdout.write(`操作核准紀錄 SHA-256=${operatorApprovalSha256}\n`);
    stdout.write(`完成：單筆刪除並核對成功。結果=${result.result}，備份 SHA-256=${result.backup.fileSha256}\n`);
  } finally {
    prompt.close();
    await deleteApp(app);
  }
}

main().catch(error => {
  const code = String(error?.message ?? 'UNKNOWN_ERROR').replace(/[^A-Z0-9_]/g, '').slice(0, 64) || 'UNKNOWN_ERROR';
  console.error(`SAFE_STOP: ${code}；未將紀錄內容輸出。請保留私人備份並由管理者檢查。`);
  process.exitCode = 1;
});
