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

const plans = [];
const report = [];
for (const projectId of Object.keys(firebaseProjectRoles)) {
  const row = rows.find(r => r.FirebaseProject === projectId && r.RecordType === 'OWNER-PILOT');
  const beforeFile = files.filter(name => name.startsWith(`CLAIMS-BEFORE-${projectId}-`) && name.endsWith('-PRIVATE.json')).sort().at(-1);
  if (!row?.AccountUID?.trim() || !beforeFile) {
    report.push({ projectId, planned: false, reason: !row?.AccountUID?.trim() ? 'uid-not-recorded' : 'claims-before-not-captured' });
    continue;
  }
  const before = JSON.parse(await readFile(join(folder, beforeFile), 'utf8')).customClaims ?? {};
  const role = String(row.SystemRole ?? '').trim().toLowerCase();
  const designer = role === 'designer' ? String(row.DesignerCode ?? '').trim().toUpperCase() : undefined;
  try {
    const plan = buildStaffClaimsDryRun(before, {
      projectId, uid: row.AccountUID.trim(), role, designer,
      accountEnabled: String(row.AccountStatus).trim() === 'ENABLED',
      emailVerified: /^VERIFIED/.test(String(row.EmailVerificationStatus ?? '').trim()),
      managerDutiesJustification: row.ManagerDutiesJustification
    });
    plan.beforeSource = beforeFile;
    plans.push(plan);
    report.push({ projectId, planned: true, role, changedKeys: plan.changes.map(c => c.key),
      beforeSha256: plan.beforeSha256.slice(0, 12), afterSha256: plan.afterSha256.slice(0, 12),
      containsAliceCanDelete: plan.containsAliceCanDelete, blockers: plan.blockers });
  } catch {
    report.push({ projectId, planned: false, reason: 'role-or-designer-not-valid-for-project' });
  }
}
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-');
const body = JSON.stringify({ mode: 'DRY-RUN-NOT-APPLIED', createdAt: new Date().toISOString(), plans }, null, 2) + '\n';
const planPath = join(folder, `CLAIMS-DRY-RUN-${stamp}-PRIVATE.json`);
await writeFile(planPath, body, { flag: 'wx' });
process.stdout.write(JSON.stringify({
  mode: 'DRY-RUN-NOT-APPLIED', claimsChanged: 0, plannedAccounts: plans.length,
  readyForOwnerUidApproval: plans.filter(p => p.blockers.length === 0).length,
  planFileSha256: createHash('sha256').update(body).digest('hex').slice(0, 12),
  projects: report
}, null, 2) + '\n');
