import { createHash } from 'node:crypto';

const canonical = value => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
};
const hash = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');

function entries(value, label) {
  if (value == null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value;
}

export function compareEntries(before, after) {
  const oldRows = entries(before, 'before');
  const newRows = entries(after, 'after');
  const changes = [];
  let unchanged = 0;
  for (const key of new Set([...Object.keys(oldRows), ...Object.keys(newRows)])) {
    const oldExists = Object.hasOwn(oldRows, key);
    const newExists = Object.hasOwn(newRows, key);
    const oldHash = oldExists ? hash(oldRows[key]) : null;
    const newHash = newExists ? hash(newRows[key]) : null;
    if (oldHash === newHash) { unchanged++; continue; }
    changes.push({ key, kind: !oldExists ? 'added' : !newExists ? 'deleted' : 'modified',
      beforeSha256: oldHash, afterSha256: newHash });
  }
  changes.sort((a, b) => a.key.localeCompare(b.key));
  return { changes, unchanged, counts: {
    added: changes.filter(x => x.kind === 'added').length,
    modified: changes.filter(x => x.kind === 'modified').length,
    deleted: changes.filter(x => x.kind === 'deleted').length,
    unchanged
  } };
}

export function compareRtdb(before, after, rootName) {
  const oldRoot = entries(before, 'RTDB before root');
  const newRoot = entries(after, 'RTDB after root');
  const expected = rootName;
  const otherRoots = [...new Set([...Object.keys(oldRoot), ...Object.keys(newRoot)])]
    .filter(key => key !== expected).sort();
  return {
    projectRoot: expected,
    rootChanges: compareEntries(oldRoot, newRoot),
    records: compareEntries(oldRoot[expected], newRoot[expected]),
    unexpectedRoots: otherRoots
  };
}

function valueText(value) {
  return value?.stringValue ?? value?.integerValue ?? null;
}
function firestoreRows(doc, section) {
  const values = doc?.fields?.[section]?.arrayValue?.values ?? [];
  if (!Array.isArray(values)) throw new Error('HR section is not an array.');
  const rows = Object.create(null);
  for (const row of values) {
    const fields = row?.mapValue?.fields;
    if (!fields) throw new Error('HR array item is not a map.');
    const id = valueText(fields.id);
    const staffId = valueText(fields.staffId);
    const year = valueText(fields.year);
    const key = id != null ? `id:${id}` : section === 'entitlements'
      && staffId != null && year != null ? `legacy:${staffId}:${year}` : null;
    if (!key || Object.hasOwn(rows, key)) {
      throw new Error('HR array item cannot be compared by a unique key.');
    }
    rows[key] = row;
  }
  return rows;
}

export function compareFirestore(before, after) {
  if (before.format !== 'alice-firestore-rest-v1' || after.format !== before.format ||
      before.sourceProject !== after.sourceProject || before.database !== after.database) {
    throw new Error('Firestore snapshots have different format, project or database.');
  }
  const oldDocs = Object.fromEntries(before.documents.map(doc => [doc.name, doc]));
  const newDocs = Object.fromEntries(after.documents.map(doc => [doc.name, doc]));
  if (Object.keys(oldDocs).length !== before.documents.length ||
      Object.keys(newDocs).length !== after.documents.length) throw new Error('Duplicate Firestore path.');
  const oldFields = Object.fromEntries(Object.entries(oldDocs).filter(([, doc]) => doc.exists)
    .map(([path, doc]) => [path, doc.fields ?? {}]));
  const newFields = Object.fromEntries(Object.entries(newDocs).filter(([, doc]) => doc.exists)
    .map(([path, doc]) => [path, doc.fields ?? {}]));
  const main = `projects/${before.sourceProject}/databases/${before.database}/documents/salon/main`;
  const sections = {};
  for (const section of ['staff', 'entitlements', 'leaves', 'trainings']) {
    sections[section] = compareEntries(firestoreRows(oldDocs[main], section), firestoreRows(newDocs[main], section));
  }
  const oldCollections = Object.fromEntries(before.collections.map(path => [path, true]));
  const newCollections = Object.fromEntries(after.collections.map(path => [path, true]));
  return {
    documents: compareEntries(oldFields, newFields),
    collections: compareEntries(oldCollections, newCollections),
    salonMainSections: sections
  };
}
