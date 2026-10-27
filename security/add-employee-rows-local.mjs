// Owner-run: add the owner-approved EMPLOYEE rows to the private roster on this computer.
// Usage: node add-employee-rows-local.mjs --persons IRIS,CINDY,SHERRY --approved-on 2026-10-27
// Writes only new rows; existing rows are byte-for-byte preserved in content (verified after writing).
// A hash-checked backup is written first and restored automatically if verification fails.
import { createInterface } from 'node:readline/promises';
import process from 'node:process';
import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import {
  buildEmployeeRows, overlayOwnerPilotEntries, parseCsv, parseCsvDocument, selectAccountRow, serializeCsv
} from './employee-approval-policy.js';
import { mergeEmployeeRows } from './employee-rows.mjs';

const { stdin, stdout, env, argv } = process;
const sha256 = buffer => createHash('sha256').update(buffer).digest('hex');
const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace('Z', '').replace('T', '-').replace('.', '');
const fail = reason => { const error = new Error(reason); error.safeReason = reason; return error; };

function parseArgs(args) {
  const options = {};
  for (let i = 2; i < args.length; i += 2) {
    if (!['--persons', '--approved-on'].includes(args[i]) || !args[i + 1] || options[args[i]]) throw fail('usage');
    options[args[i]] = args[i + 1];
  }
  if (!options['--persons'] || !/^\d{4}-\d{2}-\d{2}$/.test(options['--approved-on'] ?? '')) throw fail('usage');
  return { persons: options['--persons'].split(',').map(p => p.trim()).filter(Boolean), approvedOn: options['--approved-on'] };
}

async function main() {
  const { persons, approvedOn } = parseArgs(argv);
  if (!env.LOCALAPPDATA) throw fail('private-approval-files-not-found');
  const folder = join(env.LOCALAPPDATA, 'ALICE-P0-PRIVATE-BACKUPS', 'EMPLOYEE-ACCESS-ACCEPTANCE');
  const mainPath = join(folder, 'ALICE-P0-EMPLOYEE-ACCESS-PRIVATE.csv');
  let current;
  let entryText;
  try {
    current = await readFile(mainPath);
    entryText = await readFile(join(folder, 'OWNER-PILOT-LOCAL-ENTRY-PRIVATE.csv'), 'utf8');
  } catch (error) { throw fail(error?.code === 'ENOENT' ? 'private-approval-files-not-found' : 'private-approval-files-unreadable'); }

  const mergedView = parseCsv(current.toString('utf8'));
  overlayOwnerPilotEntries(mergedView, parseCsv(entryText));
  const ownerRow = selectAccountRow(mergedView, 'new-customer-management-system');
  const built = buildEmployeeRows({ ownerEmail: ownerRow.ApprovedEmail, persons, approvedOn });

  const doc = parseCsvDocument(current.toString('utf8'));
  let result;
  try { result = mergeEmployeeRows(doc.headers, doc.rows, built); }
  catch (error) {
    stdout.write(JSON.stringify({ status: 'not-completed', reason: 'roster-merge-refused', detail: error.missingColumns ? `missing-columns:${error.missingColumns.join('|')}` : error.message }) + '\n');
    process.exitCode = 1;
    return;
  }
  const logins = [...new Map(built.map(row => [row.InternalRef, row.ApprovedEmail])).entries()];
  stdout.write('將寫入私人名單的員工帳號（只顯示在本機）：\n');
  for (const [person, email] of logins) stdout.write(`  ${person}：${email}\n`);
  stdout.write(`  每人 3 個專案：顧客管理 designer、商品預訂 staff、缺貨登記 staff；新增 ${result.added} 列、已存在 ${result.unchanged} 列\n`);
  if (result.added === 0) {
    stdout.write(JSON.stringify({ status: 'unchanged', added: 0, unchanged: result.unchanged }) + '\n');
    return;
  }
  const readline = createInterface({ input: stdin, output: stdout });
  try {
    if ((await readline.question('確認寫入，請輸入 ADD EMPLOYEES：')).trim() !== 'ADD EMPLOYEES') throw fail('cancelled');
  } finally { readline.close(); }

  const latest = await readFile(mainPath);
  if (sha256(latest) !== sha256(current)) throw fail('private-csv-changed-during-run');
  const runStamp = stamp();
  const backupPath = `${mainPath}.pre-add-employees-${runStamp}.csv`;
  await writeFile(backupPath, current, { flag: 'wx' });
  if (sha256(await readFile(backupPath)) !== sha256(current)) throw fail('backup-hash-mismatch-no-change-made');
  const next = Buffer.from(serializeCsv(doc.headers, result.rows, { bom: doc.bom, quoteAll: doc.quoteAll }), 'utf8');
  try {
    await writeFile(mainPath, next);
    const check = parseCsvDocument((await readFile(mainPath)).toString('utf8'));
    const same = check.headers.join('\u0000') === doc.headers.join('\u0000') && check.rows.length === doc.rows.length + result.added &&
      doc.rows.every((row, i) => doc.headers.every(header => check.rows[i][header] === row[header])) &&
      built.every(candidate => check.rows.some(row => row.RecordType === 'EMPLOYEE' && row.InternalRef === candidate.InternalRef &&
        row.FirebaseProject === candidate.FirebaseProject && row.ApprovedEmail === candidate.ApprovedEmail));
    if (!same) throw new Error('verify');
  } catch {
    await copyFile(backupPath, mainPath);
    throw fail(sha256(await readFile(mainPath)) === sha256(current) ? 'write-verify-failed-restored-backup' : 'write-verify-failed-restore-unconfirmed');
  }
  await writeFile(join(folder, `EMPLOYEE-ACCOUNT-CREATION-APPROVAL-${runStamp}-PRIVATE.json`), JSON.stringify({
    approvedOn, approvedBy: 'owner (chat)', persons: logins.map(([person]) => person),
    accounts: built.map(row => ({ person: row.InternalRef, projectId: row.FirebaseProject, role: row.SystemRole, designerCode: row.DesignerCode, email: row.ApprovedEmail }))
  }, null, 2) + '\n', { flag: 'wx' });
  stdout.write(JSON.stringify({ status: 'added', added: result.added, unchanged: result.unchanged, backupSha256Matches: true,
    csvSha256Before: sha256(current).slice(0, 12), csvSha256After: sha256(next).slice(0, 12) }) + '\n');
}

main().catch(error => {
  stdout.write(JSON.stringify({ status: 'not-completed', reason: error?.safeReason ?? 'unexpected-error-no-change-unless-reported' }) + '\n');
  process.exitCode = 1;
}).finally(() => setTimeout(() => process.exit(process.exitCode ?? 0), 300));
