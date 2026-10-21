import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const securityRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const claimScript = join(securityRoot, 'assign-staff-claim.mjs');

test('預購與缺貨的 Custom Claims 核發工具拒絕不必要的 manager claim', () => {
  for (const project of ['pre-order-registration', 'restocking-list']) {
    const result = spawnSync(process.execPath, [claimScript,
      '--project', project, '--uid', 'synthetic-uid', '--role', 'manager'],
    { encoding: 'utf8', timeout: 10000 });
    assert.notEqual(result.status, 0, `${project} must reject manager`);
    assert.match(result.stderr, /Role is not allowed for this project/);
    assert.doesNotMatch(result.stderr, /Could not load the default credentials/);
  }
});
