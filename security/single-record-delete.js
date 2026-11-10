import { createHash, randomUUID } from 'node:crypto';

export const DELETE_TARGETS = Object.freeze({
  'pre-order-registration': Object.freeze({ collection: 'reservations', app: 'preorder' }),
  'restocking-list': Object.freeze({ collection: 'stockItems', app: 'stock' })
});

export function validateDeleteTarget(projectId, recordId) {
  const target = DELETE_TARGETS[projectId];
  if (!target) throw new Error('INVALID_PROJECT');
  if (typeof recordId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(recordId) || recordId === '.' || recordId === '..' || recordId === target.collection) {
    throw new Error('INVALID_RECORD_ID');
  }
  return Object.freeze({ projectId, recordId, path: `${target.collection}/${recordId}`, collection: target.collection });
}

export function parseSingleDeleteArgs(argv) {
  if (!Array.isArray(argv) || argv.length !== 4 || argv[0] !== '--project' || argv[2] !== '--id') throw new Error('USAGE');
  const [, projectId, , recordId] = argv;
  return validateDeleteTarget(projectId, recordId);
}

export function assertApprovedLocalOperator(approval, { actor, projectId }) {
  if (!approval || approval.format !== 'alice-local-delete-operators-v1' || !Array.isArray(approval.operators)) {
    throw new Error('OPERATOR_APPROVAL_FILE_INVALID');
  }
  const entry = approval.operators.find(item => String(item?.windowsIdentity ?? '').toLocaleLowerCase() === String(actor ?? '').toLocaleLowerCase());
  if (!entry || !['store-manager', 'approved-supervisor'].includes(entry.role) || !entry.projects?.includes(projectId) ||
      !String(entry.approvedBy ?? '').trim() || !String(entry.approvalRef ?? '').trim() ||
      !Number.isFinite(Date.parse(entry.approvedAt ?? ''))) {
    throw new Error('LOCAL_OPERATOR_NOT_APPROVED');
  }
  return { role: entry.role, approvalRef: entry.approvalRef };
}

export function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

const UNRESOLVED_DELETE_RESULTS = new Set([
  'DELETE_ATTEMPTING',
  'DELETE_OUTCOME_UNKNOWN',
  'DELETE_COMMITTED_UNVERIFIED',
  'STOPPED'
]);

export function assertNoUnresolvedDeleteAttempt(audits, { projectId, recordId }) {
  const previous = (audits ?? []).filter(audit => audit?.projectId === projectId && audit?.recordId === recordId);
  const byOperation = new Map();
  for (const [index, audit] of previous.entries()) {
    const key = audit.operationId ?? `legacy-${index}`;
    const current = byOperation.get(key) ?? [];
    current.push(audit);
    byOperation.set(key, current);
  }
  const latestResults = [...byOperation.values()].map(entries => entries.findLast(audit => audit.result !== 'DELETE_ATTEMPTING')?.result ?? 'DELETE_ATTEMPTING');
  if (latestResults.some(result => UNRESOLVED_DELETE_RESULTS.has(result))) {
    throw new Error('PRIOR_DELETE_REQUIRES_RECONCILIATION');
  }
  if (latestResults.includes('DELETED_AND_VERIFIED')) {
    throw new Error('ALREADY_DELETED_VERIFIED');
  }
}

export async function performSingleRecordDelete({ projectId, recordId, actor, approvalRef, approvalSha256, confirmed, expectedRecordSha256, store, adapter, now = () => new Date() }) {
  const target = validateDeleteTarget(projectId, recordId);
  const startedAt = now().toISOString();
  const audit = { format: 'alice-single-record-delete-v1', operationId: randomUUID(), projectId, path: target.path, recordId, actor, approvalRef, approvalSha256, startedAt, result: 'NOT_STARTED' };
  let deleteOutcome = 'NOT_ATTEMPTED';
  const finish = async result => {
    audit.result = result;
    audit.finishedAt = now().toISOString();
    const bytes = Buffer.from(JSON.stringify(audit, null, 2));
    audit.auditSha256 = sha256(bytes);
    await store.writeAudit(bytes, audit);
    return audit;
  };

  try {
    if (!confirmed) throw new Error('CONFIRMATION_REQUIRED');
    const beforeCollection = await adapter.readCollection(target.collection);
    const beforeRecord = beforeCollection?.[recordId];
    if (beforeRecord === undefined || beforeRecord === null) throw new Error('RECORD_NOT_FOUND');
    const recordHash = sha256(canonicalJson(beforeRecord));
    if (expectedRecordSha256 && recordHash !== expectedRecordSha256) throw new Error('RECORD_CHANGED');
    const recordJson = `${JSON.stringify(beforeRecord, null, 2)}\n`;
    const recordBytes = Buffer.from(recordJson);
    const backup = await store.writeBackup(recordBytes, { projectId, path: target.path, recordId, recordSha256: recordHash });
    const savedBytes = await store.readBackup(backup.fileName);
    if (!savedBytes || !Buffer.from(savedBytes).equals(recordBytes) || sha256(savedBytes) !== sha256(recordBytes)) {
      throw new Error('BACKUP_HASH_MISMATCH');
    }
    audit.backup = { fileName: backup.fileName, fileSha256: sha256(savedBytes), recordSha256: recordHash };
    audit.beforeCollectionSha256 = sha256(canonicalJson(beforeCollection));

    // Persist intent before contacting RTDB. If the process exits or the response is lost,
    // a later run can recognize that the result needs reconciliation instead of retrying.
    audit.result = 'DELETE_ATTEMPTING';
    audit.attemptedAt = now().toISOString();
    await store.writeAudit(Buffer.from(JSON.stringify(audit, null, 2)), audit);
    deleteOutcome = 'OUTCOME_UNKNOWN';
    let transaction;
    try {
      transaction = await adapter.deleteIfUnchanged(target.collection, recordId, recordHash);
    } catch (error) {
      throw Object.assign(new Error('DELETE_OUTCOME_UNKNOWN'), { cause: error });
    }
    if (!transaction.committed) {
      deleteOutcome = 'NOT_EXECUTED';
      throw new Error(transaction.reason === 'changed' ? 'RECORD_CHANGED' : 'DELETE_NOT_COMMITTED');
    }
    deleteOutcome = 'COMMITTED';

    const afterRecord = await adapter.readRecord(target.collection, recordId);
    const afterCollection = await adapter.readCollection(target.collection);
    if (afterRecord !== null && afterRecord !== undefined) throw new Error('POST_DELETE_RECORD_STILL_EXISTS');
    const expectedCollection = { ...(beforeCollection ?? {}) };
    delete expectedCollection[recordId];
    if (sha256(canonicalJson(expectedCollection)) !== sha256(canonicalJson(afterCollection ?? {}))) {
      throw new Error('POST_DELETE_COLLECTION_MISMATCH');
    }
    audit.afterCollectionSha256 = sha256(canonicalJson(afterCollection ?? {}));
    audit.affectedRecordCount = 1;
    return await finish('DELETED_AND_VERIFIED');
  } catch (error) {
    audit.errorCode = String(error?.message ?? 'UNKNOWN_ERROR').replace(/[^A-Z0-9_]/g, '').slice(0, 64) || 'UNKNOWN_ERROR';
    const result = deleteOutcome === 'COMMITTED'
      ? 'DELETE_COMMITTED_UNVERIFIED'
      : deleteOutcome === 'OUTCOME_UNKNOWN'
        ? 'DELETE_OUTCOME_UNKNOWN'
        : 'DELETE_NOT_EXECUTED';
    await finish(result);
    throw Object.assign(new Error(audit.errorCode), { audit });
  }
}
