// Pure, per-record merge for the existing salon/main arrays.
export const HR_SECTIONS = ['staff', 'entitlements', 'leaves', 'trainings'];

export class HrConflictError extends Error {
  constructor(message = '資料已由另一台裝置修改') {
    super(message);
    this.name = 'HrConflictError';
  }
}

const clone = value => structuredClone(value);
const canonical = value => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
};
const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
export const hrFingerprint = value => JSON.stringify(canonical(
  Object.fromEntries(HR_SECTIONS.map(section => [section, value[section] ?? []]))
));

export function hrEntryKey(section, row) {
  if (!row || typeof row !== 'object') throw new HrConflictError('資料列格式不正確');
  if (row.id !== undefined && row.id !== null && String(row.id) !== '') return `id:${String(row.id)}`;
  if (section === 'entitlements' && row.staffId != null && Number.isFinite(Number(row.year))) {
    return `legacy:${String(row.staffId)}:${Number(row.year)}`;
  }
  throw new HrConflictError('資料列缺少可安全比對的識別值');
}

function keyed(section, list) {
  if (!Array.isArray(list)) throw new HrConflictError('資料區段不是陣列');
  const map = new Map();
  for (const row of list) {
    const key = hrEntryKey(section, row);
    if (map.has(key)) throw new HrConflictError('資料列識別值重複');
    map.set(key, row);
  }
  return map;
}

export function hrChanges(before, desired) {
  const changes = {};
  for (const section of HR_SECTIONS) {
    const oldRows = keyed(section, before[section] ?? []);
    const newRows = keyed(section, desired[section] ?? []);
    const edits = [];
    for (const key of new Set([...oldRows.keys(), ...newRows.keys()])) {
      const oldRow = oldRows.get(key);
      const newRow = newRows.get(key);
      if (!same(oldRow, newRow)) edits.push({ key, before: clone(oldRow), after: clone(newRow) });
    }
    if (edits.length) changes[section] = edits;
  }
  return changes;
}

export function mergeHrChanges(latest, changes) {
  const updates = {};
  for (const [section, edits] of Object.entries(changes)) {
    if (!HR_SECTIONS.includes(section)) throw new HrConflictError('未知資料區段');
    const rows = clone(latest[section] ?? []);
    keyed(section, rows); // Reject ambiguous old data rather than selecting a row arbitrarily.
    for (const edit of edits) {
      const index = rows.findIndex(row => hrEntryKey(section, row) === edit.key);
      const actual = index < 0 ? undefined : rows[index];
      if (same(actual, edit.after)) continue; // A previous commit may have succeeded before a timeout.
      if (!same(actual, edit.before)) throw new HrConflictError();
      if (edit.after === undefined) rows.splice(index, 1);
      else if (index < 0) rows.unshift(clone(edit.after));
      else rows[index] = clone(edit.after);
    }
    updates[section] = rows;
  }
  return updates;
}
