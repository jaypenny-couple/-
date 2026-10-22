export const firebaseProjectRoles = Object.freeze({
  'new-customer-management-system': Object.freeze(['designer', 'manager']),
  'pre-order-registration': Object.freeze(['staff']),
  'restocking-list': Object.freeze(['staff']),
  'hr-system-ad937': Object.freeze(['manager'])
});

const knownDesignerCodes = new Set(['JAY', 'IRIS', 'SHERRY', 'CINDY']);
const placeholderPattern = /(?:OWNER-PILOT-TBD|ROLE[-_ ]?TEMPLATE|TBD|PENDING|待填|待確認|待業主|待核准|待批准|請填寫|範本|placeholder)/i;

export function isApproved(value) {
  return String(value ?? '').trim().toUpperCase() === 'APPROVED';
}

export function hasConfirmedValue(value) {
  const text = String(value ?? '').trim();
  return text.length > 0 && !placeholderPattern.test(text);
}

export function normalizeApprovedEmail(value) {
  const email = String(value ?? '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function expectedClaims(projectId, role, designerCode = '') {
  const allowed = firebaseProjectRoles[projectId];
  if (!allowed) throw new Error('Unsupported Firebase project.');
  if (!allowed.includes(role)) throw new Error('Role does not match the selected Firebase project.');
  const app = projectId === 'new-customer-management-system' ? 'customer'
    : projectId === 'pre-order-registration' ? 'preorder'
      : projectId === 'restocking-list' ? 'stock' : 'hr';
  const claims = { aliceApp: app, aliceRole: role };
  if (role === 'designer') {
    const code = String(designerCode ?? '').trim().toUpperCase();
    if (!knownDesignerCodes.has(code)) throw new Error('Designer role requires an approved designer code.');
    claims.aliceDesigner = code;
  } else if (designerCode) {
    throw new Error('Designer code is only valid for a designer role.');
  }
  return claims;
}

export function summarizeEmployeeRoster(rows) {
  const projects = Object.keys(firebaseProjectRoles);
  const pilotRows = rows.filter(row => String(row.InternalRef ?? '').trim() === 'OWNER-PILOT-TBD');
  const candidates = rows.filter(row => {
    const ref = String(row.InternalRef ?? '').trim();
    return normalizeApprovedEmail(row.ApprovedEmail) !== null || (ref && ref !== 'OWNER-PILOT-TBD' && !placeholderPattern.test(ref));
  });
  const emailByProject = new Map();
  const duplicateEmailProjectCount = new Set();
  const roleConflictCount = new Set();
  const managerReasonIssueCount = new Set();
  const designerCodeIssueCount = new Set();

  for (const row of candidates) {
    const projectId = String(row.FirebaseProject ?? '').trim();
    const role = String(row.SystemRole ?? '').trim().toLowerCase();
    const email = normalizeApprovedEmail(row.ApprovedEmail);
    if (email && projectId) {
      const key = `${projectId}\u0000${email}`;
      if (emailByProject.has(key)) duplicateEmailProjectCount.add(projectId);
      emailByProject.set(key, true);
    }
    if (!firebaseProjectRoles[projectId] || !firebaseProjectRoles[projectId].includes(role)) {
      roleConflictCount.add(projectId || '(missing project)');
    }
    const ref = String(row.InternalRef ?? '').trim() || email || '(missing employee identifier)';
    if (role === 'manager' && !hasConfirmedValue(row.ManagerDutiesJustification)) {
      managerReasonIssueCount.add(`${projectId}\u0000${ref}`);
    }
    if (role === 'designer' && !knownDesignerCodes.has(String(row.DesignerCode ?? '').trim().toUpperCase())) {
      designerCodeIssueCount.add(`${projectId}\u0000${ref}`);
    }
  }

  const pilotSummary = projects.map(projectId => {
    const row = pilotRows.find(candidate => String(candidate.FirebaseProject ?? '').trim() === projectId);
    if (!row) return { projectId, present: false, missing: ['OWNER-PILOT-TBD row'] };
    const missing = [];
    for (const [field, label] of [
      ['ApprovedEmail', '核准登入信箱'],
      ['JobDuties', '實際工作職責'],
      ['MinimumAccess', '最低必要角色'],
      ['AccountUID', '該專案 UID（帳號建立後）'],
      ['EmailVerificationStatus', 'Email 驗證狀態（帳號建立後）'],
      ['AccountDisableOwner', '帳號停用負責人']
    ]) {
      if (!hasConfirmedValue(row[field])) missing.push(label);
    }
    if (!normalizeApprovedEmail(row.ApprovedEmail)) missing.push('有效的 Email 格式');
    if (!hasConfirmedValue(row.InternalRef) || row.InternalRef === 'OWNER-PILOT-TBD') missing.push('員工識別');
    if (!isApproved(row.AccountCreationApproval)) missing.push('逐人逐專案帳號建立核准');
    if (!isApproved(row.OwnerApproval)) missing.push('業主核准紀錄');
    const role = String(row.SystemRole ?? '').trim().toLowerCase();
    if (!firebaseProjectRoles[projectId]?.includes(role)) missing.push('經確認且符合專案的角色');
    if (role === 'designer' && !knownDesignerCodes.has(String(row.DesignerCode ?? '').trim().toUpperCase())) {
      missing.push('核准設計師代碼');
    }
    if (role === 'manager' && !hasConfirmedValue(row.ManagerDutiesJustification)) {
      missing.push('主管權限的實際業務理由');
    }
    return { projectId, present: true, missing: [...new Set(missing)] };
  });

  return {
    totalRows: rows.length,
    roleTemplateRows: rows.filter(row => !String(row.InternalRef ?? '').trim() && !normalizeApprovedEmail(row.ApprovedEmail)).length,
    ownerPilotRows: pilotRows.length,
    candidateRows: candidates.length,
    rowsWithValidApprovedEmail: candidates.filter(row => normalizeApprovedEmail(row.ApprovedEmail)).length,
    duplicateEmailProjectCount: duplicateEmailProjectCount.size,
    roleConflictCount: roleConflictCount.size,
    managerReasonIssueCount: managerReasonIssueCount.size,
    designerCodeIssueCount: designerCodeIssueCount.size,
    projects: pilotSummary
  };
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const source = String(text ?? '').replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field.length === 0) quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(value => value.length > 0)) rows.push(row);
      row = [];
    } else field += char;
  }
  if (quoted) throw new Error('CSV contains an unterminated quoted field.');
  if (field.length || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const [headers, ...data] = rows;
  if (headers.some(header => !header.trim()) || new Set(headers).size !== headers.length) {
    throw new Error('CSV headers must be non-empty and unique.');
  }
  return data.map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
}
