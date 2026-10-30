// Read-only production inventory/export. The only write API targets a loopback Emulator.
import { createHash } from 'node:crypto';
import { readFile, writeFile, rename, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auth, firestore } from '@googleapis/firestore';

const PROJECT = 'hr-system-ad937';
const DATABASE = '(default)';
const PAGE_SIZE = 25;
const ROOT = `projects/${PROJECT}/databases/${DATABASE}/documents`;
const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const args = process.argv.slice(2);
const option = (name) => {
  const i = args.indexOf(name);
  return i < 0 ? null : args[i + 1];
};
const mode = args[0];
const privateDir = option('--private-dir');
const inventoryFile = option('--inventory');
const backupFile = option('--backup');
const manifestFile = option('--manifest');
const maxBudget = Number(option('--max-read-budget') ?? 5000);
const todayReads = Number(option('--today-reads'));
const emulatorHost = option('--emulator-host');

async function assertSafePrivateDir(dir) {
  if (!dir || !isAbsolute(dir)) throw new Error('Use an existing absolute --private-dir outside the repository.');
  const actual = await realpath(dir);
  const rel = relative(repoRoot, actual);
  if (!rel || (!rel.startsWith('..' + sep) && rel !== '..' && !isAbsolute(rel))) {
    throw new Error('Private output must be outside the public repository.');
  }
  if (!emulatorHost) {
    const protectedRoot = resolve(process.env.LOCALAPPDATA ?? '', 'ALICE-P0-PRIVATE-BACKUPS');
    const actualProtectedRoot = await realpath(protectedRoot);
    const fromRoot = relative(actualProtectedRoot, actual);
    if (!process.env.LOCALAPPDATA || !fromRoot || fromRoot.startsWith('..') || isAbsolute(fromRoot)) {
      throw new Error('Production output must be inside the existing ALICE private backup root.');
    }
  }
}

function assertBudget(budget, reserve) {
  if (budget.reserved + reserve > budget.limit) throw new Error('Read budget reached; export is incomplete.');
  budget.reserved += reserve;
  budget.calls++;
}

async function createApi(host) {
  if (host) {
    if (!/^127\.0\.0\.1:\d+$/.test(host)) throw new Error('Emulator host must be 127.0.0.1:<port>.');
    return {
      async call(method, suffix, body) {
        const url = `http://${host}/v1/${suffix}`;
        const response = await fetch(url, {
          method,
          headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
          body: body ? JSON.stringify(body) : undefined
        });
        if (!response.ok) throw new Error(`Emulator API ${method} returned ${response.status}.`);
        return response.json();
      },
      async collections(parent, pageToken) {
        return this.call('POST', `${parent}:listCollectionIds`, { pageSize: PAGE_SIZE, pageToken });
      },
      async documents(parent, collectionId, pageToken) {
        const p = new URLSearchParams({ pageSize: String(PAGE_SIZE), showMissing: 'true' });
        if (pageToken) p.set('pageToken', pageToken);
        return this.call('GET', `${parent}/${encodeURIComponent(collectionId)}?${p}`);
      }
    };
  }
  // GoogleAuth uses the current user's ADC. No service account key is created or read.
  const googleAuth = new auth.GoogleAuth({ scopes: ['https://www.googleapis.com/auth/datastore'] });
  await googleAuth.getClient();
  const client = firestore({ version: 'v1', auth: googleAuth });
  return {
    async collections(parent, pageToken) {
      const r = await client.projects.databases.documents.listCollectionIds({
        parent, requestBody: { pageSize: PAGE_SIZE, pageToken }
      });
      return r.data;
    },
    async documents(parent, collectionId, pageToken, readTime) {
      const r = await client.projects.databases.documents.listDocuments({
        parent, collectionId, pageSize: PAGE_SIZE, pageToken, showMissing: true, readTime
      });
      return r.data;
    }
  };
}

async function scan(api, root, budget, includeFields, readTime) {
  const queue = [root];
  const collections = [];
  const documents = [];
  const seen = new Set();
  while (queue.length) {
    const parent = queue.shift();
    if (seen.has(parent)) continue;
    seen.add(parent);
    let collectionToken;
    do {
      assertBudget(budget, 1);
      const result = await api.collections(parent, collectionToken);
      for (const id of result.collectionIds ?? []) {
        const path = `${parent}/${id}`;
        collections.push(path);
        let documentToken;
        do {
          // Conservative upper bound: one read per possible returned document plus one request.
          assertBudget(budget, PAGE_SIZE + 1);
          const page = await api.documents(parent, id, documentToken, readTime);
          for (const d of page.documents ?? []) {
            if (!d.name?.startsWith(path + '/')) throw new Error('Unexpected document path.');
            const entry = {
              name: d.name,
              createTime: d.createTime ?? null,
              updateTime: d.updateTime ?? null,
              exists: Boolean(d.createTime || d.updateTime)
            };
            if (includeFields && entry.exists) entry.fields = d.fields ?? {};
            documents.push(entry);
            queue.push(d.name); // Includes missing ancestor documents with subcollections.
          }
          documentToken = page.nextPageToken || null;
        } while (documentToken);
      }
      collectionToken = result.nextPageToken || null;
    } while (collectionToken);
  }
  collections.sort();
  documents.sort((a, b) => a.name.localeCompare(b.name));
  if (new Set(documents.map(d => d.name)).size !== documents.length) throw new Error('Duplicate document path.');
  return { collections, documents, budget };
}

function summary(tree) {
  return {
    collections: tree.collections.length,
    documents: tree.documents.filter(d => d.exists).length,
    missingParents: tree.documents.filter(d => !d.exists).length,
    reservedReadUpperBound: tree.budget.reserved,
    apiCalls: tree.budget.calls
  };
}

function fingerprint(tree) {
  return JSON.stringify({
    collections: tree.collections,
    documents: tree.documents.map(({ name, createTime, updateTime, exists }) =>
      ({ name, createTime, updateTime, exists }))
  });
}

async function atomicJson(path, value) {
  const temp = `${path}.partial`;
  await writeFile(temp, JSON.stringify(value, null, 2), { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  await rename(temp, path);
}

async function runInventory() {
  await assertSafePrivateDir(privateDir);
  if (!Number.isInteger(maxBudget) || maxBudget < PAGE_SIZE + 2 || maxBudget > 10000) {
    throw new Error('Read budget must be an integer from 27 to 10000.');
  }
  const api = await createApi(emulatorHost);
  const startedUtc = new Date().toISOString();
  const readTime = emulatorHost ? null : new Date(Date.now() - 5000).toISOString();
  const tree = await scan(api, emulatorHost ? 'projects/demo-alice-backup-restore/databases/(default)/documents' : ROOT,
    { limit: maxBudget, reserved: 0, calls: 0 }, false, readTime);
  const record = { kind: 'firestore-inventory', sourceProject: emulatorHost ? 'demo-alice-backup-restore' : PROJECT,
    database: DATABASE, startedUtc, finishedUtc: new Date().toISOString(), readTime,
    ...summary(tree), collections: tree.collections, documents: tree.documents };
  const path = join(privateDir, `hr-firestore-inventory-${Date.now()}.json`);
  await atomicJson(path, record);
  console.log(`INVENTORY_OK documents=${record.documents.filter(d => d.exists).length} collections=${tree.collections.length} reservedReads=${tree.budget.reserved}`);
  console.log(`PRIVATE_INVENTORY=${path}`);
}

async function runExport() {
  const synthetic = mode === 'export-emulator';
  if (synthetic !== Boolean(emulatorHost)) throw new Error('Emulator export requires export-emulator mode and loopback host.');
  await assertSafePrivateDir(privateDir);
  if (!inventoryFile || !isAbsolute(inventoryFile)) throw new Error('Provide absolute --inventory.');
  if (!synthetic && (!Number.isInteger(todayReads) || todayReads < 0)) throw new Error('Provide recent Console --today-reads.');
  if (!Number.isInteger(maxBudget) || maxBudget < PAGE_SIZE + 2 || maxBudget > 10000) throw new Error('Invalid read budget.');
  const inventory = JSON.parse(await readFile(inventoryFile, 'utf8'));
  const sourceProject = synthetic ? 'demo-alice-backup-restore' : PROJECT;
  const sourceRoot = synthetic ? `projects/${sourceProject}/databases/${DATABASE}/documents` : ROOT;
  if (inventory.kind !== 'firestore-inventory' || inventory.sourceProject !== sourceProject) throw new Error('Wrong inventory.');
  // Leave 20,000 reads for normal operations and delayed quota reporting.
  if (!synthetic && todayReads + inventory.reservedReadUpperBound + maxBudget + 20000 > 50000) {
    throw new Error('Free daily read quota cannot be confirmed with required reserve.');
  }
  const api = await createApi(emulatorHost);
  const startedUtc = new Date().toISOString();
  const readTime = synthetic ? null : new Date(Date.now() - 5000).toISOString();
  const tree = await scan(api, sourceRoot, { limit: maxBudget, reserved: 0, calls: 0 }, true, readTime);
  const result = { format: 'alice-firestore-rest-v1', sourceProject, database: DATABASE,
    startedUtc, finishedUtc: new Date().toISOString(), readTime,
    collections: tree.collections, documents: tree.documents };
  const consistentWithInventory = fingerprint(tree) === fingerprint(inventory);
  const bytes = Buffer.from(JSON.stringify(result, null, 2), 'utf8');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const stamp = Date.now();
  const file = join(privateDir, `${synthetic ? 'synthetic' : 'hr'}-firestore-${stamp}.json`);
  await writeFile(file, bytes, { flag: 'wx', mode: 0o600 });
  await atomicJson(join(privateDir, `${synthetic ? 'synthetic' : 'hr'}-firestore-${stamp}.manifest.json`), {
    file, sha256, bytes: bytes.length, sourceProject, database: DATABASE,
    startedUtc, finishedUtc: result.finishedUtc, readTime,
    ...summary(tree), consistentWithInventory,
    note: 'Application-managed document export. Firestore indexes, rules and server metadata restoration are separate.'
  });
  console.log(`EXPORT_${consistentWithInventory ? 'CANDIDATE' : 'INCONSISTENT'} documents=${summary(tree).documents} reservedReads=${tree.budget.reserved}`);
  console.log(`PRIVATE_BACKUP=${file}`);
  if (!consistentWithInventory) process.exitCode = 2;
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  }
  return value;
}

async function runRestore() {
  if (!backupFile || !isAbsolute(backupFile)) throw new Error('Provide absolute --backup.');
  if (!manifestFile || !isAbsolute(manifestFile)) throw new Error('Provide absolute --manifest.');
  if (!emulatorHost || !/^127\.0\.0\.1:\d+$/.test(emulatorHost)) throw new Error('Restore requires loopback --emulator-host.');
  const raw = await readFile(backupFile);
  const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
  if (manifest.sha256 !== createHash('sha256').update(raw).digest('hex') || manifest.bytes !== raw.length) {
    throw new Error('Backup SHA-256 or size mismatch.');
  }
  const backup = JSON.parse(raw.toString('utf8'));
  if (backup.format !== 'alice-firestore-rest-v1' || ![PROJECT, 'demo-alice-backup-restore'].includes(backup.sourceProject)) {
    throw new Error('Wrong backup format or project.');
  }
  const api = await createApi(emulatorHost);
  const sourceRoot = `projects/${backup.sourceProject}/databases/${DATABASE}/documents`;
  const sourcePrefix = `${sourceRoot}/`;
  const targetRoot = 'projects/demo-alice-backup-restore/databases/(default)/documents';
  let restored = 0;
  for (const doc of backup.documents) {
    if (!doc.exists) continue;
    if (!doc.name.startsWith(sourcePrefix)) throw new Error('Unexpected source path.');
    const target = `${targetRoot}/${doc.name.slice(sourcePrefix.length)}`;
    const safePath = target.split('/').map(encodeURIComponent).join('/');
    const result = await api.call('PATCH', safePath, { fields: doc.fields ?? {} });
    if (JSON.stringify(stable(result.fields ?? {})) !== JSON.stringify(stable(doc.fields ?? {}))) {
      throw new Error('Emulator restore content mismatch.');
    }
    restored++;
  }
  const tree = await scan(api, targetRoot, { limit: 10000, reserved: 0, calls: 0 }, true, null);
  const expected = backup.documents.map(d => d.name.replace(sourceRoot, targetRoot)).sort();
  const actual = tree.documents.map(d => d.name).sort();
  if (JSON.stringify(expected) !== JSON.stringify(actual)) throw new Error('Emulator document path mismatch.');
  const expectedCollections = backup.collections.map(c => c.replace(sourceRoot, targetRoot)).sort();
  if (JSON.stringify(expectedCollections) !== JSON.stringify(tree.collections)) {
    throw new Error('Emulator collection path mismatch.');
  }
  const restoredByPath = new Map(tree.documents.map(d => [d.name, d]));
  for (const original of backup.documents) {
    const restoredDoc = restoredByPath.get(original.name.replace(sourceRoot, targetRoot));
    if (original.exists !== restoredDoc?.exists ||
        JSON.stringify(stable(original.fields ?? {})) !== JSON.stringify(stable(restoredDoc?.fields ?? {}))) {
      throw new Error('Emulator stored document data mismatch.');
    }
  }
  console.log(`EMULATOR_RESTORE_VERIFIED documents=${restored} paths=${actual.length}`);
}

try {
  if (mode === 'inventory') await runInventory();
  else if (mode === 'export' || mode === 'export-emulator') await runExport();
  else if (mode === 'restore-emulator') await runRestore();
  else throw new Error('Mode must be inventory, export, export-emulator or restore-emulator.');
} catch (error) {
  // API errors can contain resource names or data. Keep terminal output metadata-only.
  console.error(`BACKUP_TOOL_STOPPED type=${error.name} code=${error.code ?? error.status ?? 'none'}`);
  process.exitCode = 1;
}
