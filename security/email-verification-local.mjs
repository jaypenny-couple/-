import { createInterface } from 'node:readline/promises';
import process from 'node:process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { deleteApp, initializeApp } from 'firebase/app';
import {
  initializeAuth, inMemoryPersistence, reload, sendEmailVerification,
  signInWithEmailAndPassword, signOut
} from 'firebase/auth';
import {
  checkEmailVerification, EMAIL_VERIFICATION_PROJECTS, requestEmailVerification
} from './email-verification-flow.mjs';
import { isApproved, normalizeApprovedEmail, overlayOwnerPilotEntries, parseCsv } from './employee-approval-policy.js';

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
    if (!['--project', '--action'].includes(name) || !value || options[name]) throw new Error('Usage: node security/email-verification-local.mjs --project <projectId> --action <send|check>');
    options[name] = value;
  }
  if (!EMAIL_VERIFICATION_PROJECTS.includes(options['--project']) || !['send', 'check'].includes(options['--action'])) {
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
      if (approval !== 'SEND VERIFY') throw new Error('Cancelled.');
    } finally { readline.close(); }
  }

  const readline = createInterface({ input: stdin, output: stdout });
  let email;
  try { email = (await readline.question('核准帳號登入 Email（不會回顯於結果）：')).trim(); }
  finally { readline.close(); }
  const privateRoot = env.LOCALAPPDATA;
  if (!privateRoot) throw new Error('Private approval records are unavailable.');
  const privateFolder = join(privateRoot, 'ALICE-P0-PRIVATE-BACKUPS', 'EMPLOYEE-ACCESS-ACCEPTANCE');
  const approvedRows = parseCsv(await readFile(join(privateFolder, 'ALICE-P0-EMPLOYEE-ACCESS-PRIVATE.csv'), 'utf8'));
  const ownerEntries = parseCsv(await readFile(join(privateFolder, 'OWNER-PILOT-LOCAL-ENTRY-PRIVATE.csv'), 'utf8'));
  overlayOwnerPilotEntries(approvedRows, ownerEntries);
  const approved = approvedRows.filter(row => row.FirebaseProject === projectId && row.RecordType === 'OWNER-PILOT');
  if (approved.length !== 1 || !isApproved(approved[0].AccountCreationApproval) || !isApproved(approved[0].OwnerApproval) ||
      normalizeApprovedEmail(approved[0].ApprovedEmail) !== normalizeApprovedEmail(email)) {
    throw new Error('The selected email is not the privately approved account for this project.');
  }
  let password = await readSecret('密碼（不回顯）：');

  const app = initializeApp(projectConfigs[projectId], `alice-local-email-check-${Date.now()}`);
  const auth = initializeAuth(app, { persistence: inMemoryPersistence });
  const sdk = { signInWithEmailAndPassword, sendEmailVerification, reload, signOut };
  try {
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
  const safeCode = typeof error?.code === 'string' && /^auth\/[a-z-]+$/.test(error.code) ? error.code : undefined;
  stdout.write(JSON.stringify({ status: 'not-completed', reason: safeCode ?? 'check-private-approval-and-local-account-state' }) + '\n');
  process.exitCode = 1;
});
