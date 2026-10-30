// Local, private Custom Claims DRY RUN for the four owner pilot accounts.
// Makes no Firebase call and changes no claim. Reads the private CSV and the CLAIMS-BEFORE files written by
// `email-verification-local.mjs --action record`, writes one private plan file, and prints only counts/hashes.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { overlayOwnerPilotEntries, parseCsv, firebaseProjectRoles } from './employee-approval-policy.js';
import { buildStaffClaimsDryRun } from './staff-claim-policy.js';

const privateRoot = process.env.LOCALAPPDATA;
if (!privateRoot) throw new Error('LOCALAPPDATA is required; no alternate roster path is accepted.');
const folder = join(privateRoot, 'ALICE-P0-PRIVATE-BACKUPS', 'EMPLOYEE-ACCESS-ACCEPTANCE');
const rows = parseCsv(await readFile(join(folder, 'ALICE-P0-EMPLOYEE-ACCESS-PRIVATE.csv'), 'utf8'));
overlayOwnerPilotEntries(rows, parseCsv(await readFile(join(folder, 'OWNER-PILOT-LOCAL-ENTRY-PRIVATE.csv'), 'utf8')));
const files = await readdir(folder);
const scopeIndex = process.argv.indexOf('--scope');
const scope = scopeIndex > 0 ? process.argv[scopeIndex + 1] : 'owner';
if (!['owner', 'employees'].includes(scope) || process.argv.length > (scopeIndex > 0 ? 4 : 2)) {
  throw new Error('Usage: node claims-dry-run-local.mjs [--scope owner|employees]');
}
const targets = rows.filter(r => scope === 'owner' ? r.RecordType === 'OWNER-PILOT' : r.RecordType === 'EMPLOYEE')
  .filter(r => Object.keys(firebaseProjectRoles).includes(r.FirebaseProject));

// Latest CLAIMS-BEFORE file for this exact UID. Legacy owner files (written before UIDs were stored) are
// accepted only for owner rows.
async function beforeFileFor(row) {
  const uid = row.AccountUID.trim();
  const candidates = files.filter(name => name.startsWith(`CLAIMS-BEFORE-${row.FirebaseProject}-`) && name.endsWith('-PRIVATE.json')).sort().reverse();
  for (const name of candidates) {
    const data = JSON.parse(await readFile(join(folder, name), 'utf8'));
    if (data.uid ? data.uid === uid : row.RecordType === 'OWNER-PILOT' && data.projectId === row.FirebaseProject) return { name, data };
  }
  return null;
}

const plans = [];
const report = [];
for (const row of targets) {
  const projectId = row.FirebaseProject;
  const person = row.RecordType === 'EMPLOYEE' ? String(row.InternalRef ?? '').trim().toUpperCase() : 'OWNER-PILOT';
  const beforeFile = row.AccountUID?.trim() ? await beforeFileFor(row) : null;
  if (!row.AccountUID?.trim() || !beforeFile) {
    report.push({ projectId, person, planned: false, reason: !row.AccountUID?.trim() ? 'uid-not-recorded' : 'claims-before-not-captured' });
    continue;
  }
  const before = beforeFile.data.customClaims ?? {};
  const role = String(row.SystemRole ?? '').trim().toLowerCase();
  const designer = role === 'designer' ? String(row.DesignerCode ?? '').trim().toUpperCase() : undefined;
  try {
    const plan = buildStaffClaimsDryRun(before, {
      projectId, uid: row.AccountUID.trim(), role, designer,
      accountEnabled: String(row.AccountStatus).trim() === 'ENABLED',
      emailVerified: /^VERIFIED/.test(String(row.EmailVerificationStatus ?? '').trim()),
      managerDutiesJustification: row.ManagerDutiesJustification
    });
    plan.person = person;
    plan.beforeSource = beforeFile.name;
    plans.push(plan);
    report.push({ projectId, person, planned: true, role, changedKeys: plan.changes.map(c => c.key),
      beforeSha256: plan.beforeSha256.slice(0, 12), afterSha256: plan.afterSha256.slice(0, 12),
      containsAliceCanDelete: plan.containsAliceCanDelete, blockers: plan.blockers });
  } catch {
    report.push({ projectId, person, planned: false, reason: 'role-or-designer-not-valid-for-project' });
  }
}
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-');
const body = JSON.stringify({ mode: 'DRY-RUN-NOT-APPLIED', scope, createdAt: new Date().toISOString(), plans }, null, 2) + '\n';
const planPath = join(folder, `CLAIMS-DRY-RUN-${scope === 'employees' ? 'EMPLOYEES-' : ''}${stamp}-PRIVATE.json`);
await writeFile(planPath, body, { flag: 'wx' });
process.stdout.write(JSON.stringify({
  mode: 'DRY-RUN-NOT-APPLIED', scope, claimsChanged: 0, plannedAccounts: plans.length,
  readyForOwnerUidApproval: plans.filter(p => p.blockers.length === 0).length,
  planFileSha256: createHash('sha256').update(body).digest('hex').slice(0, 12),
  projects: report
}, null, 2) + '\n');
