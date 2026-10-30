// Owner-approved Custom Claims application for exactly one project's owner pilot UID per run.
// Uses the Identity Toolkit REST API with the target project as the quota/billing project
// (X-Goog-User-Project), so no ADC, IAM or API settings are changed. The caller supplies the
// transport (fetch), base URL and token, which lets the same logic run against the Auth Emulator.
import { createHash } from 'node:crypto';
import { buildStaffClaims } from './staff-claim-policy.js';
import { normalizeApprovedEmail } from './employee-approval-policy.js';

export const CLAIM_PROJECTS = Object.freeze([
  'new-customer-management-system', 'pre-order-registration', 'restocking-list', 'hr-system-ad937'
]);

export class ClaimsError extends Error {
  constructor(code) { super(code); this.safeReason = code; }
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
export const claimsSha256 = value => createHash('sha256').update(canonicalJson(value ?? {})).digest('hex');

function parseClaims(customAttributes) {
  if (!customAttributes) return {};
  try {
    const parsed = JSON.parse(customAttributes);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    return parsed;
  } catch { throw new ClaimsError('existing-claims-unparseable'); }
}

export function identityToolkitClient({ fetchImpl = fetch, baseUrl, projectId, getToken }) {
  if (!CLAIM_PROJECTS.includes(projectId)) throw new ClaimsError('unsupported-project');
  const call = async (method, body) => {
    const token = await getToken();
    let response;
    try {
      response = await fetchImpl(`${baseUrl}/v1/projects/${projectId}/accounts:${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Goog-User-Project': projectId },
        body: JSON.stringify(body)
      });
    } catch { throw new ClaimsError('network-error'); }
    if (!response.ok) {
      let status = '';
      try { status = String((await response.json())?.error?.status ?? ''); } catch {}
      throw new ClaimsError(`identity-toolkit-${response.status}${/^[A-Z_]+$/.test(status) ? `-${status}` : ''}`);
    }
    return response.json();
  };
  return {
    async lookup(uid) {
      const data = await call('lookup', { localId: [uid] });
      const users = data?.users ?? [];
      if (users.length !== 1 || users[0].localId !== uid) throw new ClaimsError('uid-not-found-in-project');
      const user = users[0];
      return { uid: user.localId, email: user.email ?? '', emailVerified: user.emailVerified === true,
        disabled: user.disabled === true, claims: parseClaims(user.customAttributes) };
    },
    async setClaims(uid, claims) {
      await call('update', { localId: uid, customAttributes: JSON.stringify(claims) });
    }
  };
}

// Validates the private dry-run plan against the private roster and recomputes the target claims.
export function validatePlan({ plan, projectId, rosterRow }) {
  if (!plan || plan.mode !== 'DRY-RUN-NOT-APPLIED' || plan.projectId !== projectId) throw new ClaimsError('plan-missing-for-project');
  if (!rosterRow || String(rosterRow.AccountUID ?? '').trim() !== plan.uid) throw new ClaimsError('plan-uid-does-not-match-roster');
  if (String(rosterRow.AccountStatus ?? '').trim() !== 'ENABLED' || !/^VERIFIED/.test(String(rosterRow.EmailVerificationStatus ?? '').trim())) {
    throw new ClaimsError('roster-account-not-enabled-and-verified');
  }
  if (Array.isArray(plan.blockers) && plan.blockers.length) throw new ClaimsError('plan-has-blockers');
  const role = String(rosterRow.SystemRole ?? '').trim().toLowerCase();
  if (plan.role !== role) throw new ClaimsError('plan-role-does-not-match-roster');
  const designer = role === 'designer' ? String(rosterRow.DesignerCode ?? '').trim().toUpperCase() : undefined;
  const { next } = buildStaffClaims(structuredClone(plan.before ?? {}), { projectId, role, designer });
  if (claimsSha256(next) !== plan.afterSha256 || claimsSha256(plan.after) !== plan.afterSha256 ||
      claimsSha256(plan.before) !== plan.beforeSha256) throw new ClaimsError('plan-hash-mismatch');
  if (Object.hasOwn(next, 'aliceCanDelete')) throw new ClaimsError('plan-contains-delete-claim');
  return { uid: plan.uid, before: plan.before ?? {}, after: next };
}

// Applies one validated plan. `saveBackup` must durably store the live before-state and resolve
// before any write happens. Any read-back mismatch triggers an automatic restore of the before-state.
export async function applyClaims({ client, uid, before, after, approvedEmail, saveBackup }) {
  const live = await client.lookup(uid);
  if (live.disabled) throw new ClaimsError('account-disabled');
  if (!live.emailVerified) throw new ClaimsError('email-not-verified');
  if (normalizeApprovedEmail(live.email) === null || normalizeApprovedEmail(live.email) !== normalizeApprovedEmail(approvedEmail)) {
    throw new ClaimsError('account-email-does-not-match-approved-email');
  }
  const liveHash = claimsSha256(live.claims);
  if (liveHash === claimsSha256(after)) return { status: 'already-applied', beforeSha256: liveHash, afterSha256: liveHash };
  if (liveHash !== claimsSha256(before)) throw new ClaimsError('live-claims-differ-from-plan-before-state');
  await saveBackup({ uid, before: live.claims, beforeSha256: liveHash });
  let check;
  try {
    await client.setClaims(uid, after);
    check = await client.lookup(uid);
  } catch {
    // Re-running apply is safe: it reports already-applied, or re-checks the saved before-state.
    throw new ClaimsError('write-attempted-state-unknown-rerun-apply-to-check');
  }
  if (claimsSha256(check.claims) !== claimsSha256(after)) {
    await client.setClaims(uid, live.claims);
    const restored = await client.lookup(uid);
    throw new ClaimsError(claimsSha256(restored.claims) === liveHash ? 'read-back-mismatch-restored-before-state' : 'read-back-mismatch-restore-unconfirmed');
  }
  return { status: 'applied', beforeSha256: liveHash, afterSha256: claimsSha256(check.claims) };
}

// Restores a saved before-state. Refuses unless the live claims are exactly the applied after-state,
// so a rollback can never overwrite a later, unrelated change.
export async function rollbackClaims({ client, uid, backupBefore, expectedLive }) {
  const live = await client.lookup(uid);
  const liveHash = claimsSha256(live.claims);
  if (liveHash === claimsSha256(backupBefore)) return { status: 'already-at-before-state', claimsSha256: liveHash };
  if (liveHash !== claimsSha256(expectedLive)) throw new ClaimsError('live-claims-changed-since-apply-manual-review');
  await client.setClaims(uid, backupBefore);
  const check = await client.lookup(uid);
  if (claimsSha256(check.claims) !== claimsSha256(backupBefore)) throw new ClaimsError('rollback-read-back-mismatch');
  return { status: 'rolled-back', claimsSha256: claimsSha256(check.claims) };
}
