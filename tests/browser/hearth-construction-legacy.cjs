/* Spark-only ordinary witness from the immutable pre-construction v5 page.
 * Author/review source on M6; never execute there.
 * OLD_BASE_DIR=/absolute/archive/4c3ac2f PLAYWRIGHT_MODULE=/absolute/playwright \
 * node tests/browser/hearth-construction-legacy.cjs
 * Coordinator must build OLD_BASE_DIR on Spark first. This harness serves those
 * exact bytes and does not import an engine or inject authored localStorage state.
 * Outputs artifacts/hearth-construction-legacy/{legacy-unfinished-v5.json,report.json}.
 */
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const crypto = require('node:crypto'), http = require('node:http'), {once} = require('node:events');
const playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const SOURCE = '4c3ac2f6c16ce58563f0300f286040a7aae0a963', KEY = 'singularity-clicker.hearth-rts.v1';
const HASHES = {
  'src/hearth-rts/engine.js': '416b35153c781eb56a045848afaa6bb92daa0c93447b18a4e51f2d9a580f58d5',
  'src/hearth-rts/view.js': '2a6495938d9a10d305da0b53e39896bf0951d1d51edc44a17c6a96bea09c4e67',
  'src/hearth-rts/shell.html': '124046ab8f67f79b72eecb7a771e61dae8416e396449b79e84e8e6d751250ebd',
  'src/hearth-rts/styles.css': '3054d93950fbf881a06ebbd0f15235286479628da74137df3bce7a279b94d535',
  'build.mjs': 'cc3a45bc20f08dff82c01aceadefe3e4b7c2c5ea924aaba5da3561c05b119d47'
};
const ROOT = path.resolve(__dirname, '../..'), DIR = path.join(ROOT, 'artifacts/hearth-construction-legacy');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const RES = ['wood', 'stone', 'food'], TOTAL = {wood: 416, stone: 220, food: 225};
const vector = fn => Object.fromEntries(RES.map(r => [r, fn(r)]));
function matter(s) {
  assert.equal(s.version, 5); assert.equal(s.construction, undefined);
  assert.equal(s.reclaim.profile, 'accepted-opening.outpost-reclaim.v1');
  assert.deepEqual(vector(r => s.deposits.filter(d => d.kind === r).reduce((n, d) => n + d.amount, 0)
    + Object.values(s.storage.stores).reduce((n, store) => n + store[r], 0)
    + s.units.filter(u => u.resource === r).reduce((n, u) => n + u.cargo, 0) + s.spent[r]), TOTAL);
  assert.deepEqual(s.stock, vector(r => Object.values(s.storage.stores).reduce((n, store) => n + store[r], 0)));
}
fs.mkdirSync(DIR, {recursive: true});
(async () => {
  const start = Date.now(), deadline = start + 280000;
  const report = {status: 'running', sourceCommit: SOURCE, sourceHashes: {}, builtHTML: null,
    method: 'Fresh exact pinned-v5 browser page, ordinary trusted input, controlled clock, Pause-save observations and Journey exports',
    synthetic: false, events: [], checkpoints: [], pageErrors: [], limits: [
      'This is a separately earned old-executable witness, created for migration acceptance',
      'Controlled browser clock establishes the saved paid job, not human pacing or historical player behavior'], bounds: {wallSeconds: 280}};
  let server, browser, context, page, binding;
  const write = () => fs.writeFileSync(path.join(DIR, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  const guard = () => assert.ok(Date.now() < deadline, '280-second old-witness wall budget exceeded');
  async function inputs() {
    report.events.push(...(await page.evaluate(() => window.__legacyConstructionInputs.splice(0))).map(e => ({binding, ...e})));
  }
  async function exported(label, expected) {
    const eventStart = report.events.length;
    guard(); await page.locator('#journey').click(); const event = page.waitForEvent('download'); await page.locator('#export').click();
    const download = await event, file = label + '.json'; await download.saveAs(path.join(DIR, file)); await download.delete();
    const raw = fs.readFileSync(path.join(DIR, file), 'utf8'), s = JSON.parse(raw); matter(s);
    if (expected) assert.deepEqual(s, expected, 'Journey export matches actual synchronous Pause-save state');
    await page.locator('#close').click(); await page.screenshot({path: path.join(DIR, label + '.png'), fullPage: true});
    report.checkpoints.push({binding, file, sha256: sha(raw), bytes: Buffer.byteLength(raw), time: s.time,
      screenshot: {file: label + '.png', sha256: sha(fs.readFileSync(path.join(DIR, label + '.png')))}});
    await inputs(); report.checkpoints.at(-1).eventRange = {start: eventStart, end: report.events.length}; write(); return {raw, s};
  }
  const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
  async function tick(ms) {
    guard(); assert.equal(await page.locator('#pause').innerText(), 'Resume');
    await page.locator('#pause').click(); await page.clock.runFor(ms); await page.locator('#pause').click();
    const s = await saved(); matter(s); return s;
  }
  async function until(predicate, label, seconds = 400, step = 1000) {
    let s = await saved(); for (let i = 0; !predicate(s) && i < seconds * 1000 / step; i++) s = await tick(step);
    assert.ok(predicate(s), 'Old ordinary UI timeout: ' + label); return s;
  }
  async function map(x, y, button = 'left') {
    await page.locator('#world').scrollIntoViewIfNeeded(); const box = await page.locator('#world').boundingBox();
    const t = await page.locator('#world').evaluate(c => ({width: c.width, height: c.height, x: Number(c.dataset.cameraX || 0), y: Number(c.dataset.cameraY || 0), scale: Number(c.dataset.cameraScale || 1)}));
    const p = {x: box.x + (x * 32 * t.scale + t.x) / t.width * box.width, y: box.y + (y * 32 * t.scale + t.y) / t.height * box.height};
    assert.equal(await page.evaluate(p => document.elementFromPoint(p.x, p.y)?.id, p), 'world'); await page.mouse.click(p.x, p.y, {button});
  }
  try {
    assert.ok(process.env.OLD_BASE_DIR, 'OLD_BASE_DIR must name the separately archived and Spark-built pinned source');
    const old = path.resolve(process.env.OLD_BASE_DIR), html = fs.readFileSync(path.join(old, 'dist/hearth-rts.html'));
    for (const [file, expected] of Object.entries(HASHES)) {
      const bytes = fs.readFileSync(path.join(old, file)); report.sourceHashes[file] = sha(bytes); assert.equal(sha(bytes), expected, 'Pinned original source: ' + file);
      if (file.endsWith('engine.js') || file.endsWith('view.js')) assert.ok(html.toString().includes(bytes.toString()), 'Pinned built page contains exact original source');
    }
    report.builtHTML = {sha256: sha(html), bytes: html.length};
    report.harnessSHA256 = sha(fs.readFileSync(__filename)); binding = sha(JSON.stringify({source: report.sourceHashes, build: report.builtHTML, harness: report.harnessSHA256})); report.binding = binding;
    // Artifact transport includes exact pinned old bytes; the v6 consumer can
    // verify them after the coordinator returns this entire tree from Spark.
    for (const file of [...Object.keys(HASHES), 'dist/hearth-rts.html']) {
      const destination = path.join(DIR, 'old-source', file); fs.mkdirSync(path.dirname(destination), {recursive: true}); fs.copyFileSync(path.join(old, file), destination);
    }
    report.producerFile = 'producer-source.cjs'; fs.copyFileSync(__filename, path.join(DIR, report.producerFile));
    server = http.createServer((req, res) => { if (req.url !== '/hearth-rts.html') { res.writeHead(404); return res.end(); } res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'}); res.end(html); });
    server.listen(0, '127.0.0.1'); await once(server, 'listening'); browser = await playwright.chromium.launch({headless: true, chromiumSandbox: true});
    context = await browser.newContext({viewport: {width: 1440, height: 1100}});
    context.setDefaultTimeout(5000);
    await context.addInitScript(() => { window.__legacyConstructionInputs = []; for (const type of ['pointerdown', 'pointerup', 'click', 'contextmenu', 'keydown', 'keyup']) document.addEventListener(type, e => window.__legacyConstructionInputs.push({type, target: e.target.closest?.('[data-unit]')?.dataset.unit || e.target.id || e.target.tagName, key: e.key || null, button: e.button, trusted: e.isTrusted}), true); });
    page = await context.newPage(); page.on('pageerror', e => report.pageErrors.push(e.message)); await page.clock.install({time: new Date('2026-01-01T00:00:00Z')});
    await page.goto('http://127.0.0.1:' + server.address().port + '/hearth-rts.html'); await page.locator('[data-unit="u0"]').waitFor();
    if (await page.locator('#pause').innerText() === 'Pause') await page.locator('#pause').click();
    await page.clock.pauseAt(new Date('2026-01-01T01:00:00Z')); const fresh = (await exported('fresh-pinned-v5')).s;
    assert.deepEqual(fresh.stock, {wood: 20, stone: 10, food: 0}); assert.equal(fresh.buildings.length, 1);
    let state = fresh;
    for (const id of ['d0', 'd2', 'd1']) {
      const d = state.deposits.find(d => d.id === id); await page.locator('#select-all').click(); await page.locator('#gather').click(); await map(d.x + .5, d.y + .5);
      state = await until(s => s.deposits.find(d => d.id === id).amount === 0 && s.units.every(u => !u.cargo && u.phase === 'idle'), 'earned ' + id);
      await exported('earned-' + id, state);
    }
    assert.deepEqual(state.stock, {wood: 116, stone: 70, food: 0}); await page.locator('[data-unit="u0"]').click();
    const before = (await exported('before-paid-placement')).s; await page.locator('[data-build="outpost"]').click(); await map(11.5, 11.5);
    state = (await exported('paid-reserved-before-work')).s; const added = state.buildings.filter(b => !before.buildings.some(p => p.id === b.id)); assert.equal(added.length, 1);
    const site = added[0]; assert.equal(site.kind, 'outpost'); assert.equal(site.work, 0); assert.equal(site.done, false);
    assert.deepEqual(state.stock, {wood: 56, stone: 50, food: 0}); assert.deepEqual(state.spent, {wood: 60, stone: 20, food: 0});
    assert.deepEqual(vector(r => state.storage.reservations[site.id].sources.filter(p => p.resource === r).reduce((n, p) => n + p.amount, 0)), {wood: 60, stone: 20, food: 0});
    state = await until(s => s.buildings.find(b => b.id === site.id).work > 0, 'genuine partial paid installation', 100, 100);
    const unfinished = state.buildings.find(b => b.id === site.id); assert.ok(unfinished.work > 0 && unfinished.work < 24); assert.equal(unfinished.done, false);
    assert.ok(state.units.some(u => u.order.kind === 'build' && u.order.target === site.id)); assert.ok(state.units.every(u => !u.cargo));
    const earned = await exported('legacy-unfinished-v5', state);
    report.legacyFixture = {file: 'legacy-unfinished-v5.json', rawSha256: sha(earned.raw), bytes: Buffer.byteLength(earned.raw), sourceCommit: SOURCE,
      buildingId: site.id, work: unfinished.work, earnedBeforeAnyConstructionCode: true, synthetic: false, projectedSchema: false, sourceInjected: false};
    assert.ok(report.events.some(e => e.trusted && e.target === 'world')); assert.ok(report.events.some(e => e.trusted && e.target === 'export'));
    assert.deepEqual(report.pageErrors, []); report.status = 'passed'; report.wallSeconds = (Date.now() - start) / 1000; guard(); write();
    console.log('PASS genuine pinned-v5 unfinished paid outpost: ' + path.join(DIR, 'legacy-unfinished-v5.json') + ' · binding ' + binding);
  } catch (error) {
    report.status = 'failed'; report.failure = {message: String(error), stack: error.stack};
    if (page && !page.isClosed()) { await page.screenshot({path: path.join(DIR, 'failure.png'), fullPage: true}).catch(() => {}); report.failure.state = await saved().catch(() => null); await inputs().catch(() => {}); }
    write(); throw error;
  } finally { if (context) await context.close(); if (browser) await browser.close(); if (server) await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
