import { createHash } from 'node:crypto';

const projectApps = {
  'new-customer-management-system': 'customer',
  'pre-order-registration': 'preorder',
  'restocking-list': 'stock',
  'hr-system-ad937': 'hr'
};

export function buildStaffClaims(before, { projectId, role, designer }) {
  const app = projectApps[projectId];
  if (!app) throw new Error('Unsupported Firebase project.');
  const allowedRoles = app === 'customer' ? ['manager', 'designer'] : app === 'hr' ? ['manager'] : ['staff'];
  if (!allowedRoles.includes(role)) throw new Error('Role is not allowed for this project.');
  if (role === 'designer' && !['JAY', 'IRIS', 'SHERRY', 'CINDY'].includes(designer)) throw new Error('Designer must match an existing record designer value.');
  if (role !== 'designer' && designer) throw new Error('Only designer accounts may use --designer.');
  const next = { ...before, aliceApp: app, aliceRole: role };
  delete next.aliceDesigner;
  delete next.aliceCanDelete;
  if (role === 'designer') next.aliceDesigner = designer;
  return { app, next };
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

// Pure planning only: this creates no Auth user and makes no Firebase calls.
// The saved `before` object is sufficient to restore the complete prior claim set.
export function buildStaffClaimsPlan(before, assignment) {
  if (!assignment?.uid || !/^[a-zA-Z0-9:_-]{1,128}$/.test(assignment.uid)) {
    throw new Error('Claims plan requires the exact Firebase UID for this project.');
  }
  if (assignment.accountDisabled !== false || assignment.emailVerified !== true || !assignment.email ||
      assignment.email.trim().toLowerCase() !== assignment.approvedEmail?.trim().toLowerCase()) {
    throw new Error('Claims plan requires an enabled account with verified email matching the approved email.');
  }
  if (assignment.approvalStatus !== 'APPROVED' || assignment.approvalProjectId !== assignment.projectId ||
      assignment.approvalUid !== assignment.uid || !assignment.approvalRef?.trim()) {
    throw new Error('Claims plan requires an explicit approval record matching this project and UID.');
  }
  if (assignment.role === 'manager' && !assignment.managerDutiesJustification?.trim()) {
    throw new Error('Manager claims require a documented business-duty justification.');
  }
  const snapshot = structuredClone(before ?? {});
  const { app, next } = buildStaffClaims(snapshot, assignment);
  const keys = new Set([...Object.keys(snapshot), ...Object.keys(next)]);
  const changes = [...keys].sort().filter(key => canonicalJson(snapshot[key]) !== canonicalJson(next[key]))
    .map(key => ({ key, before: snapshot[key], after: next[key] }));
  return {
    projectId: assignment.projectId,
    uid: assignment.uid ?? null,
    app,
    role: assignment.role,
    before: snapshot,
    after: next,
    changes,
    rollbackClaims: structuredClone(snapshot),
    beforeSha256: sha256(snapshot),
    afterSha256: sha256(next),
    containsAliceCanDelete: Object.hasOwn(next, 'aliceCanDelete')
  };
}
