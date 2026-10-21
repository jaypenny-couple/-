const projectApps = {
  'new-customer-management-system': 'customer',
  'pre-order-registration': 'preorder',
  'restocking-list': 'stock',
  'hr-system-ad937': 'hr'
};

export function buildStaffClaims(before, { projectId, role, designer, canDelete }) {
  const app = projectApps[projectId];
  if (!app) throw new Error('Unsupported Firebase project.');
  const allowedRoles = app === 'customer' ? ['manager', 'designer'] : app === 'hr' ? ['manager'] : ['staff'];
  if (!allowedRoles.includes(role)) throw new Error('Role is not allowed for this project.');
  if (role === 'designer' && !['JAY', 'IRIS', 'SHERRY', 'CINDY'].includes(designer)) throw new Error('Designer must match an existing record designer value.');
  if (role !== 'designer' && designer) throw new Error('Only designer accounts may use --designer.');
  const deletionProject = app === 'preorder' || app === 'stock';
  if (deletionProject && typeof canDelete !== 'boolean') throw new Error('Preorder and stock require an explicit --can-delete true|false.');
  if (!deletionProject && canDelete !== undefined) throw new Error('aliceCanDelete is only valid for preorder and stock projects.');
  const next = { ...before, aliceApp: app, aliceRole: role };
  delete next.aliceDesigner;
  delete next.aliceCanDelete;
  if (role === 'designer') next.aliceDesigner = designer;
  if (deletionProject && canDelete) next.aliceCanDelete = true;
  return { app, next };
}

export function validateDeletionApproval(record, { projectId, uid, role, app, canDelete }) {
  if (!record || record.approved !== true || record.projectId !== projectId || record.uid !== uid ||
      record.aliceApp !== app || record.aliceRole !== role || record.aliceCanDelete !== canDelete ||
      typeof record.approvalRef !== 'string' || !record.approvalRef.trim() ||
      typeof record.approvedBy !== 'string' || !record.approvedBy.trim() ||
      !Number.isFinite(Date.parse(record.approvedAt))) {
    throw new Error('A matching, individually approved project+UID+complete-claims record is required.');
  }
}
