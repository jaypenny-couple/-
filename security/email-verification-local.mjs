import { createInterface } from 'node:readline/promises';
import process from 'node:process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { deleteApp, initializeApp } from 'firebase/app';
import {
  getIdTokenResult, initializeAuth, inMemoryPersistence, reload, sendEmailVerification,
  signInWithEmailAndPassword, signOut
} from 'firebase/auth';
import {
  checkEmailVerification, EMAIL_VERIFICATION_PROJECTS, inspectSignedInAccount, requestEmailVerification
} from './email-verification-flow.mjs';
import { isApproved, normalizeApprovedEmail, overlayOwnerPilotEntries, parseCsv } from './employee-approval-policy.js';
import { recordAccount, SafeError } from './email-verification-record.mjs';

const projectConfigs = Object.freeze({
  'new-customer-management-system': {
    apiKey: 'AIzaSyAuKPbvzmLv7H8gTIADUugGMGCOrlKJL7I',
    authDomain: 'new-customer-management-system.firebaseapp.com',
    projectId: 'new-customer-management-system', appId: '1:519659942601:web:6e0c257d6b30d120b39318'
  },
  'pre-order-registration': {
    apiKey: 'AIzaSyBSCAo9bCzDK0p39STACEg6opiKttrNy4I',
    authDomain: 'pre-order-registration.firebaseapp.com',
    projectId: 'pre-order-registration', appId: '1:211911682667:web:a8744e7cb96733219e1f2e'
  },
  'restocking-list': {
    apiKey: 'AIzaSyAkNgKjtbDiD_1l4wgvt9GPPMuGQouVGgA',
    authDomain: 'restocking-list.firebaseapp.com',
    projectId: 'restocking-list', appId: '1:1070128829792:web:2ee97f72d545ddd3193a05'
  },
  'hr-system-ad937': {
    apiKey: 'AIzaSyC2Wy1oBQKV_FOBOzVauVKatcqkZnvpOro',
    authDomain: 'hr-system-ad937.firebaseapp.com',
    projectId: 'hr-system-ad937', appId: '1:480786232097:web:28e7dd7ddc3e06bfd9c460'
  }
});
const { stdin, stdout, env, argv } = process;


function parseArgs(args) {
  const options = {};
  for (let i = 2; i < args.length; i += 2) {
    const name = args[i];
    const value = args[i + 1];
    if (!['--project', '--action'].includes(name) || !value || options[name]) throw new Error('Usage: node security/email-verification-local.mjs --project <projectId> --action <send|check|record>');
    options[name] = value;
  }
  if (!EMAIL_VERIFICATION_PROJECTS.includes(options['--project']) || !['send', 'check', 'record'].includes(options['--action'])) {
    throw new Error('Project or action is not allowed.');
  }
  return { projectId: options['--project'], action: options['--action'] };
}

async function readSecret(label) {
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') throw new Error('Run this utility in a local interactive terminal.');
  stdout.write(label);
  stdin.setRawMode(true);
  stdin.resume();
  return new Promise((resolve, reject) => {
    let value = '';
    const onData = chunk => {
      for (const key of chunk.toString('utf8')) {
        if (key === '\u0003') {
          stdin.off('data', onData);
          stdin.setRawMode(false);
          stdout.write('\n');
          reject(new Error('Cancelled.'));
          return;
        }
        if (key === '\r' || key === '\n') {
          stdin.off('data', onData);
          stdin.setRawMode(false);
          stdout.write('\n');
          resolve(value);
          return;
        }
        if (key === '\u007f' || key === '\b') value = value.slice(0, -1);
        else if (key >= ' ') value += key;
      }
    };
    stdin.on('data', onData);
  });
}

async function main() {
  if (env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error('Refusing production workflow while an Auth Emulator override is set.');
  const { projectId, action } = parseArgs(argv);
  if (action === 'send') {
    const readline = createInterface({ input: stdin, output: stdout });
    try {
      const approval = await readline.question('寄送驗證信會聯絡此帳號本人。輸入 SEND VERIFY 繼續：');
      if (approval !== 'SEND VERIFY') throw new SafeError('cancelled');
    } finally { readline.close(); }
  }
  if (action === 'record') {
    const readline = createInterface({ input: stdin, output: stdout });
    try {
      const approval = await readline.question('將本人登入取得的 UID 與驗證狀態寫回本機私人 CSV（先自動備份）。輸入 RECORD UID 繼續：');
      if (approval !== 'RECORD UID') throw new SafeError('cancelled');
    } finally { readline.close(); }
  }

  const readline = createInterface({ input: stdin, output: stdout });
  let email;
  try { email = (await readline.question('核准帳號登入 Email（不會回顯於結果）：')).trim(); }
  finally { readline.close(); }
  const privateRoot = env.LOCALAPPDATA;
  if (!privateRoot) throw new SafeError('private-approval-files-not-found');
  const privateFolder = join(privateRoot, 'ALICE-P0-PRIVATE-BACKUPS', 'EMPLOYEE-ACCESS-ACCEPTANCE');
  const mainCsvPath = join(privateFolder, 'ALICE-P0-EMPLOYEE-ACCESS-PRIVATE.csv');
  let mainCsvBuffer;
  let ownerEntryText;
  try {
    mainCsvBuffer = await readFile(mainCsvPath);
    ownerEntryText = await readFile(join(privateFolder, 'OWNER-PILOT-LOCAL-ENTRY-PRIVATE.csv'), 'utf8');
  } catch (error) {
    throw new SafeError(error?.code === 'ENOENT' ? 'private-approval-files-not-found' : 'private-approval-files-unreadable');
  }
  const approvedRows = parseCsv(mainCsvBuffer.toString('utf8'));
  overlayOwnerPilotEntries(approvedRows, parseCsv(ownerEntryText));
  const approved = approvedRows.filter(row => row.FirebaseProject === projectId && row.RecordType === 'OWNER-PILOT');
  if (approved.length !== 1 || !isApproved(approved[0].AccountCreationApproval) || !isApproved(approved[0].OwnerApproval)) {
    throw new SafeError('project-not-approved-in-private-csv');
  }
  if (normalizeApprovedEmail(approved[0].ApprovedEmail) !== normalizeApprovedEmail(email)) {
    throw new SafeError('email-does-not-match-approved-email');
  }
  let password = await readSecret('密碼（不回顯）：');

  const app = initializeApp(projectConfigs[projectId], `alice-local-email-check-${Date.now()}`);
  const auth = initializeAuth(app, { persistence: inMemoryPersistence });
  const sdk = { signInWithEmailAndPassword, sendEmailVerification, reload, signOut, getIdTokenResult };
  try {
    if (action === 'record') {
      const account = await inspectSignedInAccount({ auth, projectId, email, password, sdk });
      const outcome = await recordAccount({ privateFolder, mainCsvPath, mainCsvBuffer, projectId, mergedRow: approved[0], account });
      stdout.write(JSON.stringify({ projectId, action, ...outcome }) + '\n');
      return;
    }
    const outcome = action === 'send'
      ? await requestEmailVerification({ auth, projectId, email, password, sdk })
      : await checkEmailVerification({ auth, projectId, email, password, sdk });
    stdout.write(JSON.stringify({ projectId, action, ...outcome }) + '\n');
  } finally {
    password = undefined;
    email = undefined;
    try { await signOut(auth); } catch {}
    await deleteApp(app);
  }
}

main().catch(error => {
  if (error?.safeReason) {
    stdout.write(JSON.stringify({ status: 'not-completed', reason: error.safeReason }) + '\n');
    process.exitCode = 1;
    return;
  }
  const safeCode = typeof error?.code === 'string' && /^auth\/[a-z-]+$/.test(error.code) ? error.code : undefined;
  stdout.write(JSON.stringify({ status: 'not-completed', reason: safeCode ?? 'check-private-approval-and-local-account-state' }) + '\n');
  process.exitCode = 1;
});
