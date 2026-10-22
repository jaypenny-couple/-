// Read-only, privacy-safe audit of the local employee approval CSV.
// This tool never calls Firebase and never prints identity fields.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseCsv, summarizeEmployeeRoster } from './employee-approval-policy.js';

const privateRoot = process.env.LOCALAPPDATA;
if (!privateRoot) throw new Error('LOCALAPPDATA is required; no alternate roster path is accepted.');
const csvPath = join(privateRoot, 'ALICE-P0-PRIVATE-BACKUPS', 'EMPLOYEE-ACCESS-ACCEPTANCE', 'ALICE-P0-EMPLOYEE-ACCESS-PRIVATE.csv');
const rows = parseCsv(await readFile(csvPath, 'utf8'));
const summary = summarizeEmployeeRoster(rows);
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
