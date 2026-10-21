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
