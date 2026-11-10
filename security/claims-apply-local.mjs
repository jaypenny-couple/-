// Owner-run, per-project Custom Claims application or rollback on the owner's trusted computer.
// Usage: node claims-apply-local.mjs --project <projectId> --action <apply|rollback> [--person <CODE>]
// - Uses the owner's Application Default Credentials only to obtain a short-lived access token.
//   The target project is sent as X-Goog-User-Project; no ADC file, IAM, API or billing setting changes.
// - Applies only the latest private dry-run plan for that project, after checking it against the
//   private roster and the live account. Prints only status and short hashes (never UID/email/claims).
import { createInterface } from 'node:readline/promises';
import process from 'node:process';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { applicationDefault } from 'firebase-admin/app';
import { normalizePersonCode, overlayOwnerPilotEntries, parseCsv, selectAccountRow } from './employee-approval-policy.js';
import {
  applyClaims, CLAIM_PROJECTS, ClaimsError, claimsSha256, identityToolkitClient, rollbackClaims, validatePlan
} from './claims-apply.mjs';

const { stdin, stdout, env, argv } = process;
const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace('Z', '').replace('T', '-').replace('.', '');
const short = hash => String(hash ?? '').slice(0, 12);

function parseArgs(args) {
  const options = {};
  for (let i = 2; i < args.length; i += 2) {
    const name = args[i];
    const value = args[i + 1];
    if (!['--project', '--action', '--person'].includes(name) || !value || options[name]) throw new ClaimsError('usage');
    options[name] = value;
  }
  if (!CLAIM_PROJECTS.includes(options['--project']) || !['apply', 'rollback'].includes(options['--action'])) {
    throw new ClaimsError('usage');
  }
  let person = '';
  if (options['--person']) {
    try { person = normalizePersonCode(options['--person']); } catch { throw new ClaimsError('usage'); }
  }
  return { projectId: options['--project'], action: options['--action'], person };
}

async function confirm(question, phrase) {
  const readline = createInterface({ input: stdin, output: stdout });
  try {
    if ((await readline.question(question)).trim() !== phrase) throw new ClaimsError('cancelled');
  } finally { readline.close(); }
}

async function latestPrivateJson(folder, files, prefix, exclude) {
  const name = files.filter(file => file.startsWith(prefix) && !(exclude && file.startsWith(exclude)) && file.endsWith('-PRIVATE.json')).sort().at(-1);
  if (!name) return null;
  return { name, data: JSON.parse(await readFile(join(folder, name), 'utf8')) };
}

async function main() {
  if (env.FIREBASE_AUTH_EMULATOR_HOST) throw new ClaimsError('refusing-production-while-emulator-override-is-set');
  const { projectId, action, person } = parseArgs(argv);
  if (!env.LOCALAPPDATA) throw new ClaimsError('private-approval-files-not-found');
  const folder = join(env.LOCALAPPDATA, 'ALICE-P0-PRIVATE-BACKUPS', 'EMPLOYEE-ACCESS-ACCEPTANCE');
  let rows;
  let files;
  try {
    rows = parseCsv(await readFile(join(folder, 'ALICE-P0-EMPLOYEE-ACCESS-PRIVATE.csv'), 'utf8'));
    overlayOwnerPilotEntries(rows, parseCsv(await readFile(join(folder, 'OWNER-PILOT-LOCAL-ENTRY-PRIVATE.csv'), 'utf8')));
    files = await readdir(folder);
  } catch (error) {
    throw error instanceof ClaimsError ? error : new ClaimsError(error?.code === 'ENOENT' ? 'private-approval-files-not-found' : 'private-approval-files-unreadable');
  }
  let rosterRow;
  try { rosterRow = selectAccountRow(rows, projectId, person); }
  catch { throw new ClaimsError(person ? 'person-not-found-for-project' : 'owner-pilot-row-missing'); }
  const label = person || 'OWNER-PILOT';
  const fileTag = person ? `${person}-` : '';

  const credential = applicationDefault();
  const getToken = async () => {
    try { return (await credential.getAccessToken()).access_token; }
    catch { throw new ClaimsError('adc-access-token-unavailable'); }
  };
  const client = identityToolkitClient({ baseUrl: 'https://identitytoolkit.googleapis.com', projectId, getToken });

  if (action === 'apply') {
    const planFile = person
      ? await latestPrivateJson(folder, files, 'CLAIMS-DRY-RUN-EMPLOYEES-')
      : await latestPrivateJson(folder, files, 'CLAIMS-DRY-RUN-', 'CLAIMS-DRY-RUN-EMPLOYEES-');
    const plan = planFile?.data?.plans?.find(candidate => candidate.projectId === projectId &&
      candidate.uid === String(rosterRow.AccountUID ?? '').trim());
    const { uid, before, after } = validatePlan({ plan, projectId, rosterRow });
    await confirm(`業主已核准：核發 ${projectId}／${label} 的 Custom Claims（${Object.keys(after).sort().map(key => `${key}=${after[key]}`).join(', ')}）。輸入 APPLY CLAIMS 繼續：`, 'APPLY CLAIMS');
    const runStamp = stamp();
    const outcome = await applyClaims({
      client, uid, before, after, approvedEmail: rosterRow.ApprovedEmail,
      saveBackup: async ({ before: liveBefore, beforeSha256 }) => {
        await writeFile(join(folder, `CLAIMS-APPLY-BACKUP-${projectId}-${fileTag}${runStamp}-PRIVATE.json`), JSON.stringify({
          projectId, person: label, uid, capturedAt: new Date().toISOString(), planFile: planFile.name,
          before: liveBefore, beforeSha256, plannedAfter: after, plannedAfterSha256: claimsSha256(after)
        }, null, 2) + '\n', { flag: 'wx' });
      }
    });
    await writeFile(join(folder, `CLAIMS-APPLY-LOG-${projectId}-${fileTag}${runStamp}-PRIVATE.json`), JSON.stringify({
      projectId, person: label, uid, action, at: new Date().toISOString(), ...outcome
    }, null, 2) + '\n', { flag: 'wx' });
    stdout.write(JSON.stringify({ projectId, person: label, action, status: outcome.status,
      beforeSha256: short(outcome.beforeSha256), afterSha256: short(outcome.afterSha256) }) + '\n');
    return;
  }

  const backupFile = (await Promise.all(files.filter(name => name.startsWith(`CLAIMS-APPLY-BACKUP-${projectId}-`) && name.endsWith('-PRIVATE.json')).sort().reverse()
    .map(async name => ({ name, data: JSON.parse(await readFile(join(folder, name), 'utf8')) }))))
    .find(file => file.data.uid === String(rosterRow.AccountUID ?? '').trim());
  if (!backupFile || backupFile.data.uid !== String(rosterRow.AccountUID ?? '').trim()) throw new ClaimsError('no-matching-apply-backup');
  await confirm(`將 ${projectId}／${label} 的 Custom Claims 回復為核發前狀態。輸入 ROLLBACK CLAIMS 繼續：`, 'ROLLBACK CLAIMS');
  const outcome = await rollbackClaims({ client, uid: backupFile.data.uid, backupBefore: backupFile.data.before, expectedLive: backupFile.data.plannedAfter });
  await writeFile(join(folder, `CLAIMS-ROLLBACK-LOG-${projectId}-${fileTag}${stamp()}-PRIVATE.json`), JSON.stringify({
    projectId, person: label, uid: backupFile.data.uid, action, at: new Date().toISOString(), backupFile: backupFile.name, ...outcome
  }, null, 2) + '\n', { flag: 'wx' });
  stdout.write(JSON.stringify({ projectId, person: label, action, status: outcome.status, claimsSha256: short(outcome.claimsSha256) }) + '\n');
}

main().catch(error => {
  const reason = error instanceof ClaimsError ? error.safeReason
    : /^[a-z0-9-]+$/.test(String(error?.code ?? '')) ? `error-${error.code}` : 'unexpected-error-rerun-apply-to-check-state';
  stdout.write(JSON.stringify({ status: 'not-completed', reason }) + '\n');
  process.exitCode = 1;
}).finally(() => setTimeout(() => process.exit(process.exitCode ?? 0), 300));
