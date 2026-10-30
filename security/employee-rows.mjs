// Pure merge of owner-approved EMPLOYEE rows into the private roster. No file or network access.
import { normalizeApprovedEmail } from './employee-approval-policy.js';

export const REQUIRED_EMPLOYEE_COLUMNS = Object.freeze([
  'RecordType', 'InternalRef', 'FirebaseProject', 'SystemRole', 'DesignerCode', 'ApprovedEmail', 'JobDuties',
  'MinimumAccess', 'AccountDisableOwner', 'AccountCreationApproval', 'OwnerApproval', 'AccountUID', 'AccountStatus',
  'EmailVerificationStatus'
]);
const accountColumns = new Set(['AccountUID', 'AccountStatus', 'EmailVerificationStatus']);

// Returns the merged rows. Existing identical rows are kept as-is (re-running is safe); an existing row for
// the same person/project with different approval data stops everything for manual review.
export function mergeEmployeeRows(headers, rows, built) {
  const missing = REQUIRED_EMPLOYEE_COLUMNS.filter(column => !headers.includes(column));
  if (missing.length) {
    const error = new Error(`Private CSV is missing columns: ${missing.join(', ')}`);
    error.missingColumns = missing;
    throw error;
  }
  const merged = rows.map(row => ({ ...row }));
  let added = 0;
  let unchanged = 0;
  for (const candidate of built) {
    const key = row => `${String(row.FirebaseProject ?? '').trim()}\u0000${String(row.InternalRef ?? '').trim().toUpperCase()}`;
    const existing = merged.filter(row => String(row.RecordType ?? '').trim() === 'EMPLOYEE' && key(row) === key(candidate));
    if (existing.length > 1) throw new Error('Duplicate employee rows already exist; manual review required.');
    if (existing.length === 1) {
      const differs = headers.filter(header => header in candidate && !accountColumns.has(header))
        .some(header => String(existing[0][header] ?? '').trim() !== String(candidate[header] ?? '').trim());
      if (differs) throw new Error('An employee row with different approval data already exists; manual review required.');
      unchanged += 1;
      continue;
    }
    const sameEmail = merged.some(row => String(row.FirebaseProject ?? '').trim() === candidate.FirebaseProject &&
      normalizeApprovedEmail(row.ApprovedEmail) === normalizeApprovedEmail(candidate.ApprovedEmail));
    if (sameEmail) throw new Error('The derived login email is already used in this project; manual review required.');
    merged.push(Object.fromEntries(headers.map(header => [header, candidate[header] ?? ''])));
    added += 1;
  }
  return { rows: merged, added, unchanged };
}
