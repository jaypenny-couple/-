// Offline comparison only. Reads private backup files and writes a private change ledger.
import { createHash } from 'node:crypto';
import { readFile, realpath, writeFile } from 'node:fs/promises';
import { basename, isAbsolute, join, relative, resolve } from 'node:path';
import { compareFirestore, compareRtdb } from './snapshot-diff.js';

const args = process.argv.slice(2);
const option = name => {
  const index = args.indexOf(name);
  return index < 0 ? null : args[index + 1];
};
const project = option('--project');
const beforeFile = option('--before');
const afterFile = option('--after');
const privateDir = option('--private-dir');
const rtdbRoots = {
  'new-customer-management-system': 'records',
  'pre-order-registration': 'reservations',
  'restocking-list': 'stockItems'
};
const hrProject = 'hr-system-ad937';
const sha256 = buffer => createHash('sha256').update(buffer).digest('hex');

async function privatePath(path) {
  if (!path || !isAbsolute(path)) throw new Error('An absolute private path is required.');
  const root = await realpath(resolve(process.env.LOCALAPPDATA ?? '', 'ALICE-P0-PRIVATE-BACKUPS'));
  const actual = await realpath(path);
  const rel = relative(root, actual);
  if (!process.env.LOCALAPPDATA || !rel || rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error('Snapshot and output must be inside the ALICE private backup root.');
  }
  return actual;
}

try {
  if (!rtdbRoots[project] && project !== hrProject) throw new Error('Unknown project.');
  const [beforePath, afterPath, outputDir] = await Promise.all([
    privatePath(beforeFile), privatePath(afterFile), privatePath(privateDir)
  ]);
  const [beforeRaw, afterRaw] = await Promise.all([readFile(beforePath), readFile(afterPath)]);
  const before = JSON.parse(beforeRaw.toString('utf8'));
  const after = JSON.parse(afterRaw.toString('utf8'));
  if (project === hrProject &&
      (before.sourceProject !== project || after.sourceProject !== project)) throw new Error('Wrong HR project.');
  const result = project === hrProject ? compareFirestore(before, after)
    : compareRtdb(before, after, rtdbRoots[project]);
  const ledger = {
    format: 'alice-private-snapshot-diff-v1', project, comparedAtUtc: new Date().toISOString(),
    before: { file: beforePath, sha256: sha256(beforeRaw), bytes: beforeRaw.length },
    after: { file: afterPath, sha256: sha256(afterRaw), bytes: afterRaw.length },
    result,
    note: 'A deletion must be confirmed against the live work log. Do not restore by overwriting production.'
  };
  const file = join(outputDir, `snapshot-diff-${project}-${Date.now()}.json`);
  await writeFile(file, JSON.stringify(ledger, null, 2), { flag: 'wx', mode: 0o600 });
  const count = project === hrProject ? result.documents.counts : result.records.counts;
  console.log(`PRIVATE_DIFF_OK project=${project} added=${count.added} modified=${count.modified} deleted=${count.deleted} unchanged=${count.unchanged}`);
  console.log(`PRIVATE_LEDGER_NAME=${basename(file)}`);
} catch (error) {
  console.error(`PRIVATE_DIFF_STOPPED type=${error.name}`);
  process.exitCode = 1;
}
