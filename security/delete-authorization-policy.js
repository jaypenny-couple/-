import { createHash } from 'node:crypto';

export const DELETE_AUTH_PROJECTS = Object.freeze({
  'pre-order-registration': 'preorder',
  'restocking-list': 'stock'
});

export function validateDeleteAuthorizationApproval(record, { projectId, uid, action }) {
  const app = DELETE_AUTH_PROJECTS[projectId];
  const enabled = action === 'grant';
  if (!app || !/^[A-Za-z0-9:_-]{1,128}$/.test(uid ?? '') || !['grant', 'revoke'].includes(action) ||
      !record || record.approved !== true || record.projectId !== projectId || record.uid !== uid ||
      record.aliceApp !== app || record.aliceRole !== 'staff' || record.deleteAuthorization !== enabled ||
      typeof record.approvalRef !== 'string' || !record.approvalRef.trim() ||
      typeof record.approvedBy !== 'string' || !record.approvedBy.trim() ||
      !Number.isFinite(Date.parse(record.approvedAt))) {
    throw new Error('A matching individually approved project, UID, staff role and authorization action is required.');
  }
  return app;
}

export function authorizationFromApproval(record, { projectId, uid, action }) {
  validateDeleteAuthorizationApproval(record, { projectId, uid, action });
  return action === 'grant';
}

export function sha256Json(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
