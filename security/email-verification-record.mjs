import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { applyAccountRecord, parseCsvDocument, serializeCsv } from './employee-approval-policy.js';

export class SafeError extends Error {
  constructor(code) { super(code); this.safeReason = code; }
}
const sha256 = buffer => createHash('sha256').update(buffer).digest('hex');
const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace('Z', '').replace('T', '-').replace('.', '');
const taipeiDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date());

// Writes only the three account columns of this project's owner pilot row. A byte-identical backup is
// written and hash-checked first; the main file is rewritten in place so its existing ACL is kept; any
// round-trip mismatch restores the backup. UID, email and claims are never printed.
export async function recordAccount({ privateFolder, mainCsvPath, mainCsvBuffer, projectId, person, mergedRow, account, checkedOn }) {
  const current = await readFile(mainCsvPath);
  if (sha256(current) !== sha256(mainCsvBuffer)) throw new SafeError('private-csv-changed-during-run');
  const doc = parseCsvDocument(current.toString('utf8'));
  let result;
  try {
    result = applyAccountRecord(doc.rows, {
      projectId, person, mergedRow, signedInEmail: account.signedInEmail, uid: account.uid,
      emailVerified: account.emailVerified, checkedOn: checkedOn ?? taipeiDate()
    });
  } catch { throw new SafeError('private-csv-row-not-updatable-manual-review'); }
  const runStamp = stamp();
  const claimsBeforePath = join(privateFolder, `CLAIMS-BEFORE-${projectId}-${person ? `${person}-` : ''}${runStamp}-PRIVATE.json`);
  await writeFile(claimsBeforePath, JSON.stringify({ projectId, person: person || 'OWNER-PILOT', uid: account.uid, capturedAt: new Date().toISOString(),
    source: 'client-sdk-id-token', customClaims: account.customClaims }, null, 2) + '\n', { flag: 'wx' });
  if (!result.changed) {
    return { status: 'unchanged', emailVerified: account.emailVerified, accountEnabled: true,
      existingClaimKeys: Object.keys(account.customClaims).length };
  }
  const originalHash = sha256(current);
  const backupPath = `${mainCsvPath}.pre-record-${projectId}-${person ? `${person}-` : ''}${runStamp}.csv`;
  await writeFile(backupPath, current, { flag: 'wx' });
  if (sha256(await readFile(backupPath)) !== originalHash) throw new SafeError('backup-hash-mismatch-no-change-made');
  const next = Buffer.from(serializeCsv(doc.headers, doc.rows, { bom: doc.bom, quoteAll: doc.quoteAll }), 'utf8');
  try {
    await writeFile(mainCsvPath, next);
    const check = parseCsvDocument((await readFile(mainCsvPath)).toString('utf8'));
    const before = parseCsvDocument(current.toString('utf8'));
    const sameShape = check.rows.length === before.rows.length && check.headers.join('\u0000') === before.headers.join('\u0000');
    const onlyExpected = sameShape && check.rows.every((row, i) => check.headers.every(header =>
      row[header] === before.rows[i][header] || (i === result.rowIndex && result.changedFields.includes(header))));
    if (!onlyExpected || check.rows[result.rowIndex]?.AccountUID !== account.uid) throw new Error('round-trip');
  } catch {
    await copyFile(backupPath, mainCsvPath);
    throw new SafeError(sha256(await readFile(mainCsvPath)) === originalHash ? 'write-verify-failed-restored-backup' : 'write-verify-failed-restore-unconfirmed');
  }
  return { status: 'recorded', changedFields: result.changedFields, emailVerified: account.emailVerified,
    accountEnabled: true, existingClaimKeys: Object.keys(account.customClaims).length,
    backupSha256Matches: true, csvSha256Before: originalHash.slice(0, 12), csvSha256After: sha256(next).slice(0, 12) };
}

