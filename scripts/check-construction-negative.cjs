/* Spark-only bounded negative controls. Never execute this runner on M6.
 * Copies the identical candidate regression file into a private temporary tree
 * and substitutes only the preserved pre-review engine. The candidate stays intact.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const {createHash} = require('node:crypto'), {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..'), output = path.join(root, 'artifacts/construction-negative');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const fixture = fs.readFileSync(path.join(root, 'tests/fixtures/hearth-construction-before-review.txt'));
assert.equal(hash(fixture), '00166edf7b5f98c75538cee5843198106f48fb149384b2ff4b1ca78004449d9e');
const testBytes = fs.readFileSync(path.join(root, 'tests/hearth-construction.test.cjs'));
const statusBytes = fs.readFileSync(path.join(root, 'tests/hearth-construction-status.test.cjs'));
const candidate = fs.readFileSync(path.join(root, 'src/hearth-rts/engine.js'));
const controls = [
  {id: 'C01', file: 'tests/hearth-construction.test.cjs', name: 'construction admission rejects a group containing a trapped hearth-edge worker before any reservation or ID mutation', marker: 'C01_UNREACHABLE_BUILD_MUST_REJECT'},
  {id: 'C02', file: 'tests/hearth-construction.test.cjs', name: 'source and planned-pickup identities reject coercible or inherited keys without mutating any intrinsic object', marker: 'C02_SOURCE_ID_MUST_REJECT'},
  {id: 'G01', file: 'tests/hearth-construction-status.test.cjs', name: 'waiting construction workers report installation when the final physical load unlocks their work', marker: 'G01_WAITING_WORKER_MUST_SHOW_INSTALLING'}
];
fs.mkdirSync(output, {recursive: true});
const report = {status: 'running', candidateEngineSHA256: hash(candidate), negativeEngineSHA256: hash(fixture), testSHA256: hash(testBytes), statusTestSHA256: hash(statusBytes),
  method: 'Identical candidate regression body; only engine source replaced in an owned temporary copy', controls: [],
  limits: ['These controls establish expected regression assertion failures, not a historical user incident or browser evidence.']};
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'hearth-construction-negative-'));
const write = () => fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
try {
  fs.mkdirSync(path.join(temp, 'src/hearth-rts'), {recursive: true}); fs.mkdirSync(path.join(temp, 'tests/fixtures'), {recursive: true});
  fs.writeFileSync(path.join(temp, 'src/hearth-rts/engine.js'), fixture);
  fs.writeFileSync(path.join(temp, 'tests/hearth-construction.test.cjs'), testBytes);
  fs.writeFileSync(path.join(temp, 'tests/hearth-construction-status.test.cjs'), statusBytes);
  fs.copyFileSync(path.join(root, 'tests/fixtures/hearth-v5-4c3ac2f-engine.txt'), path.join(temp, 'tests/fixtures/hearth-v5-4c3ac2f-engine.txt'));
  for (const control of controls) {
    const command = ['--test', '--test-reporter=tap', '--test-name-pattern=^' + control.name + '$', control.file];
    const result = spawnSync(process.execPath, command, {cwd: temp, encoding: 'utf8', timeout: 240000, maxBuffer: 8 * 1024 * 1024});
    const log = (result.stdout || '') + (result.stderr || ''), file = control.id + '.log'; fs.writeFileSync(path.join(output, file), log);
    const matched = !result.error && !result.signal && result.status === 1 && log.includes(control.name) && log.includes(control.marker) && /not ok \d+ - /.test(log);
    report.controls.push({...control, command, exitCode: result.status, signal: result.signal, error: result.error?.message || null, expectedAssertionObserved: matched, log: file, logSHA256: hash(log)}); write();
    assert.equal(matched, true, control.id + ' must fail at its named regression assertion, not during setup');
  }
  assert.deepEqual(fs.readFileSync(path.join(root, 'src/hearth-rts/engine.js')), candidate);
  report.status = 'passed'; write(); console.log('PASS expected C01/C02/G01 negative assertions; candidate source unchanged');
} catch (error) {
  report.status = 'failed'; report.failure = {message: String(error), stack: error.stack}; write(); throw error;
} finally {
  fs.rmSync(temp, {recursive: true, force: true});
}
