/* Spark-only ordinary-control cultivation acceptance. Author/static review on M6.
 * No engine import, hidden Camp read, stock grant, authored gameplay fixture or
 * production storage write. Scoped browser API faults exercise persistence only.
 * Public controls, native Journey downloads and read-only Pause-save checkpoints
 * supply evidence. Controlled foreground time does not measure human pacing.
 */
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const http = require('node:http'), crypto = require('node:crypto'), zlib = require('node:zlib');
const {once} = require('node:events');
const playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const ROOT = path.resolve(__dirname, '../..'), DIR = path.join(ROOT, 'artifacts/hearth-cultivation');
const KEY = 'singularity-clicker.hearth-cultivation.v1', OLD_KEY = 'singularity-clicker.hearth-rts.v1';
const FORMAT = 'hearth-local-cultivation-envelope.v1', ALL = ['u0', 'u1', 'u2', 'u3'];
const RES = ['wood', 'stone', 'food'], TOTAL = {wood: 416, stone: 220, food: 225};
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const copy = value => JSON.parse(JSON.stringify(value));
const actor = (s, id = 'u0') => s.units.find(u => u.id === id);
const deposit = (s, id) => s.deposits.find(d => d.id === id);
const building = (s, id) => s.buildings.find(b => b.id === id);
const crop = (s, id) => s.cultivation.plots.find(p => p.id === id);
const decimal = (value, name) => {
  assert.equal(typeof value, 'string', name + ' is a wire decimal string');
  assert.match(value, /^(0|[1-9]\d*)$/, name + ' is canonical and nonnegative');
  return BigInt(value);
};
function adoptedField(actual, original, label) {
  if (Array.isArray(original)) {assert.ok(Array.isArray(actual)); assert.equal(actual.length, original.length, label); for (let i = 0; i < original.length; i++) adoptedField(actual[i], original[i], label + '[' + i + ']'); return;}
  if (!original || typeof original !== 'object') {assert.deepEqual(actual, original, label); return;}
  const keys = Object.keys(original), vector = RES.every(r => Object.hasOwn(original, r));
  assert.deepEqual(Object.keys(actual).sort(), [...keys, ...(vector ? ['water', 'seed'] : [])].sort(), 'Only declared zero vector extensions at ' + label);
  if (vector) {assert.equal(actual.water, 0); assert.equal(actual.seed, 0);}
  for (const key of keys) adoptedField(actual[key], original[key], label + '.' + key);
}
function envelope(raw) {
  assert.equal(typeof raw, 'string'); const e = JSON.parse(raw);
  assert.equal(e.format, FORMAT); assert.equal(e.version, 1); assert.ok(e.state && typeof e.state === 'object');
  assert.ok(e.sourceRaw === null || typeof e.sourceRaw === 'string'); assert.ok(Array.isArray(e.archives));
  for (const a of e.archives) { assert.ok(['camp-state', 'legacy-source'].includes(a.kind)); assert.equal(typeof a.raw, 'string'); }
  assert.ok([6, 7].includes(e.state.version));
  if (e.state.version === 7) {
    assert.equal(e.state.engineProfile, 'local-cultivation.v1');
    assert.equal(e.state.contentProfile, 'local-cultivation-map.v1');
    assert.equal(e.state.numericProfile, 'whole-pantry-slot100.v1');
    assert.equal(JSON.parse(e.sourceRaw).version, 6, 'Adopted envelope owns exact supported source bytes');
  }
  return e;
}
function basicCustody(s) {
  assert.equal(s.units.length, 4); assert.ok(s.units.every(u => Number.isInteger(u.cargo) && u.cargo >= 0 && u.cargo <= 5));
  for (const r of RES) assert.equal(s.stock[r], Object.values(s.storage.stores).reduce((n, v) => n + v[r], 0), 'Actual store sum ' + r);
  if (s.version === 6) for (const r of RES) assert.equal(
    s.deposits.filter(d => d.kind === r).reduce((n, d) => n + d.amount, 0) + s.stock[r] + s.spent[r]
      + s.units.filter(u => u.resource === r).reduce((n, u) => n + u.cargo, 0)
      + s.construction.sites.reduce((n, c) => n + c.staged[r], 0), TOTAL[r], 'Opening finite custody ' + r);
  else {
    const c = s.cultivation; assert.ok(c && Array.isArray(c.plots));
    assert.ok(Number.isInteger(c.seedCache) && c.seedCache >= 0 && c.seedCache <= 6);
    assert.ok(decimal(c.water.poolMilli, 'water pool') <= 30000n);
    for (const r of ['food', 'water', 'wood']) {
      const account = c.pantry[r];
      decimal(account.milli, r + ' pantry'); decimal(account.consumedMilli, r + ' consumption');
      assert.ok(decimal(account.remainder, r + ' remainder') < 3n);
    }
    decimal(c.demandSlots, 'demand slots'); decimal(c.campSlots, 'camp slots');
    assert.equal(decimal(c.pantry.food.consumedMilli, 'food posted') * 3n + decimal(c.pantry.food.remainder, 'food liability'), decimal(c.demandSlots, 'demand slots'));
    assert.equal(decimal(c.pantry.water.consumedMilli, 'water posted') * 3n + decimal(c.pantry.water.remainder, 'water liability'), decimal(c.demandSlots, 'demand slots'));
    assert.equal(decimal(c.pantry.wood.consumedMilli, 'wood posted') * 3n + decimal(c.pantry.wood.remainder, 'wood liability'), decimal(c.campSlots, 'camp slots') * 5n);
    for (const r of RES) {
      const whole = s.deposits.filter(d => d.kind === r).reduce((n, d) => n + d.amount, 0) + s.stock[r] + s.spent[r]
        + s.units.filter(u => u.resource === r).reduce((n, u) => n + u.cargo, 0)
        + s.construction.sites.reduce((n, site) => n + site.staged[r], 0)
        + c.plots.reduce((n, p) => n + (p.job?.output?.[r] || 0), 0);
      const account = c.pantry[r], balance = BigInt(whole) * 1000n + (account ? BigInt(account.milli) + BigInt(account.consumedMilli) : 0n);
      assert.equal(balance, BigInt(TOTAL[r] + (c.generated[r] || 0)) * 1000n, 'Complete whole/pantry/output conservation ' + r);
    }
    const held = r => s.units.filter(u => u.resource === r).reduce((n, u) => n + u.cargo, 0);
    const staged = r => c.plots.reduce((n, p) => n + (p.job?.staged?.[r] || 0), 0);
    assert.equal(c.seedCache + s.stock.seed + held('seed') + staged('seed')
      + c.plots.reduce((n, p) => n + (p.job?.seedLot || 0) + (p.job?.output?.seed || 0), 0), 6, 'Six seed remain physically owned once');
    assert.equal(BigInt(s.stock.water + held('water') + staged('water') + c.recipeWaterConsumed) * 1000n
      + BigInt(c.water.poolMilli) + BigInt(c.pantry.water.milli) + BigInt(c.pantry.water.consumedMilli),
    30000n + decimal(c.water.inflowMilli, 'capacity-admitted water inflow'), 'Physical water plus actual support and recipe consumption');
    if (c.nextFunded) {
      const reservedWater = s.storage.transfers.filter(j => j.from === 'b0' && j.resource === 'water').reduce((n, j) => n + j.remaining, 0)
        + s.construction.sites.flatMap(j => j.sources).filter(r => r.storeId === 'b0' && r.resource === 'water').reduce((n, r) => n + r.amount, 0)
        + c.plots.flatMap(p => p.job?.sources || []).filter(r => r.storeId === 'b0' && r.resource === 'water').reduce((n, r) => n + r.amount, 0);
      assert.ok(s.storage.stores.b0.water - reservedWater >= 3, 'NEXT owns three uncommitted whole local recipe water');
    }
    if (c.active) for (const r of ['food', 'water', 'wood']) {
      const effectiveLocal = BigInt(s.storage.stores.b0[r]) * 3000n + BigInt(c.pantry[r].milli) * 3n - BigInt(c.pantry[r].remainder);
      assert.ok(effectiveLocal >= BigInt(r === 'wood' ? 4 : s.units.length) * 3000n, 'Actual resident recovery floor remains owned: ' + r);
    }
  }
}

(async () => {
  fs.mkdirSync(DIR, {recursive: true});
  const started = Date.now(), deadline = started + 1050000;
  const manifest = {source: {}, build: {}};
  const sources = ['build.mjs', 'src/hearth-rts/engine.js', 'src/hearth-rts/feedback.js', 'tests/browser/hearth-cultivation.cjs',
    ...fs.readdirSync(path.join(ROOT, 'src/hearth-cultivation')).filter(f => /\.(js|html|css)$/.test(f)).sort().map(f => 'src/hearth-cultivation/' + f)];
  for (const file of sources) manifest.source[file] = sha(fs.readFileSync(path.join(ROOT, file)));
  const html = fs.readFileSync(path.join(ROOT, 'dist/hearth-cultivation.html'), 'utf8');
  manifest.build['dist/hearth-cultivation.html'] = sha(html);
  for (const file of sources.filter(f => /^src\/.*\.js$/.test(f)))
    assert.ok(html.includes(fs.readFileSync(path.join(ROOT, file), 'utf8')), 'Exact candidate script embedded: ' + file);
  const legacyHtml = fs.readFileSync(path.join(ROOT, 'dist/hearth-rts.html'), 'utf8');
  manifest.build['dist/hearth-rts.html'] = sha(legacyHtml);
  for (const file of ['src/hearth-rts/view.js', 'src/hearth-rts/shell.html', 'src/hearth-rts/styles.css']) manifest.source[file] = sha(fs.readFileSync(path.join(ROOT, file)));
  for (const file of ['src/hearth-rts/engine.js', 'src/hearth-rts/feedback.js', 'src/hearth-rts/view.js'])
    assert.ok(legacyHtml.includes(fs.readFileSync(path.join(ROOT, file), 'utf8')), 'Exact unchanged opening script embedded: ' + file);
  const binding = sha(JSON.stringify(manifest));
  const report = {status: 'running', sourceCommit: process.env.CULTIVATION_SOURCE_COMMIT || null, binding, manifest,
    bounds: {wallSeconds: 1050, simulationSecondsPerBranch: 5000, maximumCheckpoints: 180, maximumJournalRows: 20000},
    checkpoints: [], actions: [], branches: [], faults: [], inputCounts: {}, errors: [],
    limits: ['Ordinary controls under a controlled foreground clock; not human discovery, enjoyment or pacing evidence',
      'The narrow Chromium context is touch-capable and uses explicit plot taps; most journey commands use trusted mouse controls, not a touch-only playthrough',
      'Two stated investment orders, not a global optimum or statistical performance comparison',
      'Only returned PNG inspection can establish rendered clarity; DOM checks alone cannot',
      'Hashes bind the collected files; independent coordinator source and result verification is still required']};
  let browser, server, page, active = 'earned-opening', seq = 0;
  const contexts = [], journal = [];
  const persist = () => fs.writeFileSync(path.join(DIR, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  const guard = () => { assert.ok(Date.now() < deadline, '1050-second internal deadline'); assert.ok(journal.length < 20000); assert.ok(report.checkpoints.length < 180); };
  function record(kind, value) { guard(); journal.push({sequence: journal.length + 1, scenario: active, binding, kind, ...value}); }
  async function inputs(p) {
    const events = await p.evaluate(() => window.__cultivationInputs.splice(0));
    for (const e of events) { const key = active + ':' + e.type + ':' + e.target + ':' + e.trusted; report.inputCounts[key] = (report.inputCounts[key] || 0) + 1; }
    if (events.length) record('input', {events});
  }
  async function rawSave(p) { return p.evaluate(key => localStorage.getItem(key), KEY); }
  async function saved(p, label = 'native-pause-save') {
    const raw = await rawSave(p), e = envelope(raw); basicCustody(e.state);
    assert.equal(await p.evaluate(key => localStorage.getItem(key), OLD_KEY), null, 'Separate preview never writes the absent old v6 slot');
    record(label, {raw, sha256: sha(raw), time: e.state.time}); await inputs(p); return e;
  }
  async function flush(p) { await p.clock.runFor(120); }
  async function click(p, selector, touch = false) {
    assert.equal(await p.locator(selector).isEnabled(), true, 'Public control enabled: ' + selector);
    if (touch) await p.locator(selector).tap(); else await p.locator(selector).click();
  }
  async function download(p, selector, label) {
    const waiting = p.waitForEvent('download'); await click(p, selector); const d = await waiting;
    const file = String(++seq).padStart(3, '0') + '-' + active + '-' + label + '.json';
    await d.saveAs(path.join(DIR, file)); await d.delete();
    const raw = fs.readFileSync(path.join(DIR, file), 'utf8'); return {file, raw, sha256: sha(raw)};
  }
  async function checkpoint(p, label, screenshot = false, expectedState = null) {
    guard(); assert.equal(await p.locator('#pause').innerText(), 'Resume');
    await click(p, '#journey'); const out = await download(p, '#export', label); await click(p, '#close');
    const e = envelope(out.raw); basicCustody(e.state);
    assert.equal(await rawSave(p), out.raw, 'Native export equals durable envelope');
    if (expectedState) assert.deepEqual(e.state, expectedState, 'Exact expected gameplay state');
    const row = {scenario: active, label, file: out.file, sha256: out.sha256, time: e.state.time};
    if (screenshot) { await flush(p); row.png = out.file.replace(/\.json$/, '.png'); await p.screenshot({path: path.join(DIR, row.png), fullPage: true}); row.pngSHA256 = sha(fs.readFileSync(path.join(DIR, row.png))); assert.equal(await rawSave(p), out.raw); }
    report.checkpoints.push(row); record('journey-checkpoint', row); await inputs(p); persist(); return {...out, e, s: e.state};
  }
  async function pulse(p, milliseconds = 2000) {
    guard(); assert.equal(await p.locator('#pause').innerText(), 'Resume');
    await click(p, '#pause'); await p.clock.runFor(milliseconds); await click(p, '#pause');
    const e = await saved(p); assert.ok(e.state.time < 5000, 'Bounded foreground history'); return e.state;
  }
  async function until(p, s, predicate, label, milliseconds = 2000, attempts = 900) {
    for (let i = 0; !predicate(s) && i < attempts; i++) s = await pulse(p, milliseconds);
    assert.ok(predicate(s), 'Bounded ordinary path: ' + label); return s;
  }
  async function select(p, ids) {
    for (let i = 0; i < ids.length; i++) await p.locator('[data-unit="' + ids[i] + '"]').click({modifiers: i ? ['Shift'] : []});
    assert.deepEqual((await p.locator('[data-unit][aria-pressed="true"]').evaluateAll(ns => ns.map(n => n.dataset.unit))).sort(), [...ids].sort());
  }
  async function map(p, x, y, touch = false) {
    await p.locator('#world').scrollIntoViewIfNeeded(); const box = await p.locator('#world').boundingBox();
    const camera = await p.locator('#world').evaluate(c => ({w: c.width, h: c.height, x: Number(c.dataset.cameraX || 0), y: Number(c.dataset.cameraY || 0), k: Number(c.dataset.cameraScale || 1)}));
    const point = {x: box.x + (x * 32 * camera.k + camera.x) * box.width / camera.w, y: box.y + (y * 32 * camera.k + camera.y) * box.height / camera.h};
    assert.equal(await p.evaluate(q => document.elementFromPoint(q.x, q.y)?.id, point), 'world');
    if (touch) await p.touchscreen.tap(point.x, point.y); else await p.mouse.click(point.x, point.y);
  }
  async function gather(p, s, ids, target) {
    await select(p, ids); await click(p, '#gather'); const d = deposit(s, target); await map(p, d.x + .5, d.y + .5);
    const next = (await saved(p)).state; assert.equal(next.time, s.time);
    for (const id of ids) assert.deepEqual(actor(next, id).next || actor(next, id).order, {kind: 'gather', target});
    report.actions.push({scenario: active, action: 'gather', ids, target, time: s.time}); return next;
  }
  async function stop(p, ids = ALL) {
    await select(p, ids); await click(p, '#stop');
    return until(p, (await saved(p)).state, s => ids.every(id => !actor(s, id).cargo && actor(s, id).phase === 'idle'), 'physical Stop and Return');
  }
  async function move(p, s, ids, x, y) {
    await select(p, ids); await click(p, '#move'); await map(p, x + .5, y + .5);
    return until(p, (await saved(p)).state, v => ids.every(id => actor(v, id).phase === 'idle' && !actor(v, id).cargo), 'Move arrival');
  }
  async function place(p, s, kind, x, y) {
    await select(p, ALL); await click(p, '[data-build="' + kind + '"]'); await map(p, x + .5, y + .5);
    if (await p.locator('#placement-confirm').isVisible()) await click(p, '#placement-confirm');
    let next = (await saved(p)).state; const added = next.buildings.filter(b => !building(s, b.id)); assert.equal(added.length, 1);
    const id = added[0].id; assert.deepEqual([added[0].kind, added[0].x, added[0].y], [kind, x, y]);
    assert.deepEqual(next.spent, s.spent); assert.deepEqual(next.stock, s.stock);
    next = await until(p, next, v => building(v, id).done && v.units.every(u => u.order.kind !== 'build'), 'physical ' + kind);
    await checkpoint(p, kind + '-earned', true); return {s: next, id};
  }
  async function inspectBuilding(p, s, id) {
    if (await p.locator('#command-cancel').isEnabled()) await click(p, '#command-cancel');
    const b = building(s, id); await map(p, b.x + .8, b.y + .8); await flush(p);
  }
  async function importExact(p, raw, label) {
    await click(p, '#journey'); p.once('dialog', d => d.accept());
    await p.locator('#file').setInputFiles({name: label + '.json', mimeType: 'application/json', buffer: Buffer.from(raw)});
    await p.locator('#dialog').waitFor({state: 'hidden'}); await flush(p);
    const out = await checkpoint(p, label, true, envelope(raw).state);
    assert.equal(out.e.sourceRaw, envelope(raw).sourceRaw); return out;
  }
  async function sourceArchive(p, expected) {
    await click(p, '#journey'); const out = await download(p, '#source-export', 'exact-opening-source'); await click(p, '#close');
    assert.equal(out.raw, expected, 'Exact archived opening bytes'); report.checkpoints.push({scenario: active, label: 'exact-opening-source', file: out.file, sha256: out.sha256}); return out;
  }
  async function screenshotReachable(p, selector, label) {
    await p.locator(selector).evaluate(el => el.scrollIntoView({block: 'start'})); await flush(p);
    const box = await p.locator(selector).boundingBox(), tray = await p.locator('#action-tray').boundingBox();
    assert.ok(box && box.x >= -.5 && box.y >= -.5 && box.x + box.width <= p.viewportSize().width + .5);
    assert.ok(box.y + box.height <= Math.min(tray.y, p.viewportSize().height), 'Entire target above fixed tray: ' + selector);
    assert.ok(await p.locator(selector).evaluate(el => {const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));}));
    const png = String(++seq).padStart(3, '0') + '-' + active + '-' + label + '.png'; await p.screenshot({path: path.join(DIR, png)});
    report.checkpoints.push({scenario: active, label, png, pngSHA256: sha(fs.readFileSync(path.join(DIR, png))), selector, box, tray});
  }
  async function open({context = null, touch = false, fault = null} = {}) {
    if (!context) {
      context = await browser.newContext({viewport: touch ? {width: 390, height: 844} : {width: 1440, height: 1100}, hasTouch: touch}); contexts.push(context); context.setDefaultTimeout(7000);
      await context.addInitScript(() => {window.__cultivationInputs = []; for (const type of ['pointerdown', 'pointerup', 'click', 'keydown', 'keyup', 'change']) document.addEventListener(type, e => window.__cultivationInputs.push({type, target: e.target.closest?.('[data-unit]')?.dataset.unit || e.target.closest?.('button[id],input[id],canvas[id]')?.id || e.target.id || e.target.tagName, rawTargetTag: e.target.tagName, trusted: e.isTrusted, key: e.key || null, pointerType: e.pointerType || null, at: performance.now()}), true);});
      if (fault === 'missing-lock') await context.addInitScript(() => Object.defineProperty(navigator, 'locks', {configurable: true, value: undefined}));
      if (fault === 'read') await context.addInitScript(key => {const original = Storage.prototype.getItem; Storage.prototype.getItem = function(k) {if (k === key) throw new DOMException('Bounded cultivation QA read failure', 'SecurityError'); return original.call(this, k);};}, KEY);
    }
    const p = await context.newPage(); page = p; p.on('pageerror', e => report.errors.push({scenario: active, message: e.message}));
    await p.clock.install({time: new Date('2026-01-01T00:00:00Z')});
    await p.goto('http://127.0.0.1:' + server.address().port + '/hearth-cultivation.html');
    await p.locator('#cultivation-panel').waitFor(); await p.locator('[data-unit="u0"]').waitFor();
    if (await p.locator('#pause').innerText() === 'Pause') await click(p, '#pause');
    await p.clock.pauseAt(new Date('2026-01-01T01:00:00Z')); return p;
  }

  async function transfer(p, s, from, to, resource, ids = ALL, concurrent = false) {
    await select(p, ids); await inspectBuilding(p, s, from);
    await p.locator('#store-destination').selectOption(to); await p.locator('#store-resource').selectOption(resource);
    assert.equal(await p.locator('#store-transfer').isEnabled(), true, 'Actual local goods can fund transfer');
    const quote = await p.locator('#store-quote').innerText(), before = copy(s);
    await click(p, '#store-transfer'); let next = (await saved(p)).state;
    assert.equal(next.time, s.time); assert.deepEqual(next.stock, s.stock, 'Transfer assignment does not teleport goods');
    assert.ok(next.storage.transfers.length > s.storage.transfers.length, 'One identified transfer reserved');
    const job = next.storage.transfers.find(j => !s.storage.transfers.some(old => old.id === j.id));
    assert.equal(job.from, from); assert.equal(job.to, to); assert.equal(job.resource, resource);
    next = await until(p, next, v => !v.storage.transfers.some(j => j.id === job.id) && ids.every(id => !actor(v, id).transfer && !actor(v, id).cargo), 'actual ' + resource + ' store transfer', concurrent ? 500 : 2000);
    assert.equal(next.storage.transferred[resource] - before.storage.transferred[resource], job.amount, 'Actual assigned transfer receipt counter');
    if (!concurrent) {assert.deepEqual(next.stock, before.stock, 'Transfer conserves aggregate stores'); assert.equal(next.storage.stores[to][resource] - before.storage.stores[to][resource], job.amount);}
    report.actions.push({scenario: active, action: 'physical-transfer', from, to, resource, quote, amount: job.amount, time: before.time}); return next;
  }
  async function sourceCollection(p, s, resource, targetStored) {
    await select(p, ALL); await click(p, '#' + resource + '-inspect'); await click(p, '#' + resource + '-gather');
    s = await until(p, (await saved(p)).state, v => v.units.some(u => u.resource === resource && u.cargo > 0), 'physical ' + resource + ' source pickup', 80);
    assert.ok(s.units.some(u => u.resource === resource && u.cargo <= 5 && u.cargo > 0));
    await checkpoint(p, resource + '-carried-from-source', true);
    s = await until(p, s, v => v.stock[resource] >= targetStored, resource + ' deposited in actual stores');
    s = await stop(p); await checkpoint(p, resource + '-received', true); return s;
  }
  async function choosePlot(p, id, touch = false) { await click(p, '#plot-' + id, touch); await flush(p); }
  async function startPlot(p, s, id, ids = ['u0']) {
    await select(p, ids); await choosePlot(p, id);
    const label = await p.locator('#plot-start').innerText(); assert.match(label, /Plant/);
    const before = copy(s), startedCount = crop(s, id).batchesStarted;
    await click(p, '#plot-start'); const next = (await saved(p)).state, job = crop(next, id).job;
    assert.ok(job && job.id); assert.equal(crop(next, id).batchesStarted, startedCount + 1); assert.equal(next.time, before.time);
    assert.deepEqual(next.stock, before.stock, 'Plant assignment reserves physically stored ingredients');
    assert.equal(next.cultivation.recipeWaterConsumed, before.cultivation.recipeWaterConsumed, 'Water consumed at workpiece start, not click');
    assert.deepEqual(next.cultivation.generated, before.cultivation.generated);
    const assigned = await checkpoint(p, id + '-reserved', true);
    // A disabled repeat is an explicit UI guard; an enabled repeat must retain the batch.
    if (await p.locator('#plot-start').isEnabled()) {
      await click(p, '#plot-start'); await checkpoint(p, id + '-repeat-keeps-batch', false, assigned.s);
    }
    report.actions.push({scenario: active, action: label, plotId: id, ids, jobId: job.id, time: s.time}); return next;
  }
  async function growPlot(p, s, id, {interrupt = false, overlap = false} = {}) {
    if (interrupt) {
      s = await until(p, s, v => crop(v, id).job?.phase === 'planting' && crop(v, id).job.workSlots > 0, 'paid planting begins', 500);
      const startedJob = copy(crop(s, id).job), recipeWater = s.cultivation.recipeWaterConsumed;
      s = await stop(p); assert.equal(crop(s, id).job.id, startedJob.id); assert.equal(crop(s, id).job.workSlots, startedJob.workSlots);
      await checkpoint(p, id + '-paid-interrupted', true); await select(p, ALL); await choosePlot(p, id);
      assert.equal(await p.locator('#plot-resume').innerText(), 'Resume planting'); await click(p, '#plot-resume');
      s = (await saved(p)).state; assert.equal(crop(s, id).job.id, startedJob.id); assert.equal(s.cultivation.recipeWaterConsumed, recipeWater);
    }
    s = await until(p, s, v => crop(v, id).job?.phase === 'growing', id + ' planting finished', 1000);
    assert.ok(s.units.every(u => u.order.target !== id || u.phase === 'idle'), 'Planting releases workers during growth');
    const growing = await checkpoint(p, id + '-growing-workers-free', true), support = copy(s.cultivation.pantry);
    assert.match(await p.locator('#cultivation-plot-details').innerText(), /Growing|growing/);
    if (overlap) {
      assert.equal(s.tools, false, 'This overlapping finite gathering is bare work');
      const beforeStone = s.delivered.stone; s = await gather(p, s, ['u3'], 'd6');
      s = await until(p, s, v => v.delivered.stone >= beforeStone + 5, 'useful ordinary stone receipt overlaps crop growth'); s = await stop(p, ['u3']);
      assert.deepEqual(s.cultivation.pantry, support, 'Bare work, walking and growth consume no support');
      report.actions.push({scenario: active, action: 'ordinary-stone-during-growth', plotId: id, beforeStone, afterStone: s.delivered.stone});
    }
    const phase = id === 'woodland' ? 'harvest' : 'output';
    s = await until(p, s, v => crop(v, id).job?.phase === phase, id + ' foreground growth matures', 5000);
    assert.deepEqual(s.cultivation.pantry, support, 'Unattended growth adds no support demand');
    assert.ok(s.time >= growing.s.time); await choosePlot(p, id);
    if (id === 'woodland') {
      assert.deepEqual(crop(s, id).job.output, {seed: 0, food: 0, wood: 0});
      await select(p, ['u0']); assert.equal(await p.locator('#plot-resume').innerText(), 'Harvest woodland'); await click(p, '#plot-resume');
      s = await until(p, (await saved(p)).state, v => crop(v, id).job?.phase === 'output', 'physical woodland harvesting');
    }
    assert.deepEqual(crop(s, id).job.output, id === 'pilot' ? {seed: 2, food: 6, wood: 0} : {seed: 2, food: 0, wood: 8});
    await checkpoint(p, id + '-physical-output-tray', true); return s;
  }
  async function collectPlot(p, s, id) {
    const counter = id === 'pilot' ? 'pilotFood' : 'woodlandWood', amount = id === 'pilot' ? 6 : 8;
    const beforeReceipts = s.cultivation.receipts[counter], jobId = crop(s, id).job.id, beforeStock = copy(s.stock);
    await select(p, ['u0']); await choosePlot(p, id); await click(p, '#plot-collect');
    s = (await saved(p)).state; assert.deepEqual(s.stock, beforeStock, 'Collection assignment does not credit tray output');
    s = await until(p, s, v => actor(v).cargo > 0, 'seed-first plot output pickup', 80);
    assert.equal(actor(s).resource, 'seed'); assert.equal(actor(s).cargo, 2); assert.equal(s.cultivation.receipts[counter], beforeReceipts);
    await checkpoint(p, id + '-retained-seed-carried', true);
    if (id === 'pilot' && beforeReceipts === 0) {
      assert.equal(s.cultivation.woodlandUnlocked, false, 'Retained seed pickup is not the food receipt unlock');
      s = await until(p, s, v => v.cultivation.receipts.pilotFood > 0, 'first actual pilot food receipt', 80);
      assert.equal(s.cultivation.receipts.pilotFood, 5); assert.equal(s.cultivation.woodlandUnlocked, true);
      assert.equal(crop(s, 'pilot').job.output.food, 1, 'Unlock occurs before the final one-food load');
      await checkpoint(p, 'first-food-receipt-unlocks-woodland', true);
    }
    s = await until(p, s, v => v.cultivation.receipts[counter] === beforeReceipts + amount && v.units.every(u => !u.cargo), 'entire ' + id + ' output physically receipted', 1000);
    assert.ok(!crop(s, id).job || Object.values(crop(s, id).job.output).every(n => n === 0));
    assert.equal(s.stock.seed, 6, 'Seed lineage returns to inventory after the only active batch settles');
    await checkpoint(p, id + '-whole-output-received', true);
    report.actions.push({scenario: active, action: 'physical-output-received', plotId: id, jobId, amount, counter}); return s;
  }
  async function earnedOpening(p) {
    let s = (await checkpoint(p, 'fresh-opening', true)).s;
    assert.equal(s.version, 6); assert.deepEqual(s.stock, {wood: 20, stone: 10, food: 0});
    for (const id of ['d0', 'd2', 'd1']) {
      s = await gather(p, s, ALL, id);
      s = await until(p, s, v => deposit(v, id).amount === 0 && v.units.every(u => u.phase === 'idle' && !u.cargo), 'finite western ' + id);
    }
    s = await move(p, s, ALL, 25, 13);
    const outpost = await place(p, s, 'outpost', 22, 11); s = await move(p, outpost.s, ALL, 6, 16);
    const workshop = await place(p, s, 'workshop', 11, 15); s = await move(p, workshop.s, ALL, 6, 16);
    s = await gather(p, s, ['u0'], 'd3'); s = await until(p, s, v => v.delivered.food >= 5, 'exact first five food receipt', 80);
    assert.equal(s.stock.food, 5); s = await stop(p, ['u0']); assert.equal(s.stock.food, 5);
    assert.equal(s.complete, true); assert.equal(s.tools, false); assert.equal(s.knapping, null);
    assert.equal(deposit(s, 'd3').amount, 70); assert.deepEqual(s.stock, {wood: 16, stone: 20, food: 5});
    const source = await checkpoint(p, 'earned-eligible-opening', true);
    await click(p, '#cultivation-adopt'); assert.match(await p.locator('#cultivation-confirm-dialog').innerText(), /invitations|shelter/i);
    await click(p, '#cultivation-confirm-cancel'); await checkpoint(p, 'declined-adoption-keeps-opening', false, source.s);
    await click(p, '#cultivation-adopt'); await click(p, '#cultivation-confirm');
    const adopted = await checkpoint(p, 'explicit-adoption', true); s = adopted.s;
    assert.equal(s.version, 7); assert.equal(adopted.e.sourceRaw, JSON.stringify(source.s));
    for (const field of ['units', 'buildings', 'deposits', 'seen', 'time', 'nextId', 'tools', 'knapping', 'complete', 'depleted', 'stock', 'spent', 'delivered', 'storage', 'construction', 'reclaim']) adoptedField(s[field], source.s[field], field);
    assert.equal(s.stock.food, 5); assert.equal(s.stock.water, 0); assert.equal(s.stock.seed, 0);
    assert.equal(s.cultivation.active, false); assert.equal(s.cultivation.seedDiscovered, false);
    assert.equal(s.cultivation.water.poolMilli, '30000'); assert.equal(s.cultivation.seedCache, 6);
    for (const a of Object.values(s.cultivation.pantry)) assert.equal(a.milli, '0');
    await sourceArchive(p, adopted.e.sourceRaw); const preInspect = copy(s.stock);
    await choosePlot(p, 'pilot'); s = (await saved(p)).state; assert.equal(s.cultivation.seedDiscovered, true); assert.deepEqual(s.stock, preInspect);
    s = await sourceCollection(p, s, 'seed', 6); assert.equal(s.cultivation.seedCache, 0);
    s = await sourceCollection(p, s, 'water', 25);
    for (let n = 0; s.storage.stores.b0.water < 25 && n < 4; n++) {
      const id = Object.keys(s.storage.stores).find(id => id !== 'b0' && s.storage.stores[id].water > 0); assert.ok(id, 'Actual collected water has a supplying store');
      s = await transfer(p, s, id, 'b0', 'water');
    }
    assert.ok(s.storage.stores.b0.water >= 25); assert.equal(s.stock.food, 5);
    const beforeProvision = await checkpoint(p, 'water-seed-physically-funded', true);
    await click(p, '#cultivation-provision'); assert.match(await p.locator('#support-quote').innerText(), /Hearth|b0/);
    await click(p, '#support-cancel'); await checkpoint(p, 'support-preview-cancel', false, beforeProvision.s);
    await click(p, '#cultivation-provision'); await click(p, '#support-confirm'); s = (await checkpoint(p, 'support-explicitly-confirmed', true)).s;
    assert.equal(s.cultivation.active, true); assert.equal(s.cultivation.demandSlots, '0'); assert.equal(s.cultivation.campSlots, '0');
    assert.equal(await p.locator('#train').isDisabled(), true, 'Unavailable invitations disclosed before consent and disabled after activation');
    assert.equal(s.cultivation.woodlandUnlocked, false); s = await startPlot(p, s, 'pilot', ALL);
    s = await growPlot(p, s, 'pilot', {interrupt: true, overlap: true});
    assert.equal(s.cultivation.receipts.pilotFood, 0); assert.equal(s.cultivation.woodlandUnlocked, false);
    s = await collectPlot(p, s, 'pilot'); assert.equal(s.cultivation.woodlandUnlocked, true);
    assert.equal(s.cultivation.nextFunded, true); const common = await checkpoint(p, 'common-first-crop-earned', true);
    return {common, opening: source, sourceRaw: adopted.e.sourceRaw, outpostId: outpost.id, workshopId: workshop.id};
  }
  async function woodlandAndUsefulTools(p, s, context) {
    s = await startPlot(p, s, 'woodland'); s = await growPlot(p, s, 'woodland');
    assert.equal(s.tools, false); assert.equal(s.cultivation.receipts.woodlandWood, 0);
    // Physically relocate whole eligible old wood; protected NEXT/floors remain.
    for (let i = 0; i < 5; i++) {
      await select(p, ALL); await inspectBuilding(p, s, 'b0'); const available = Number(await p.locator('#free-wood').innerText());
      assert.ok(Number.isFinite(available) && available >= 0);
      if (available < 1) break;
      s = await transfer(p, s, 'b0', context.outpostId, 'wood');
    }
    await inspectBuilding(p, s, 'b0'); const freeBefore = Number(await p.locator('#free-wood').innerText()); assert.ok(freeBefore < 4);
    assert.ok(s.stock.wood >= 4, 'Remote wood cannot pay the b0 workshop instantly'); assert.equal(s.cultivation.nextFunded, true);
    await select(p, ['u0']); await inspectBuilding(p, s, context.workshopId);
    assert.match(await p.locator('#craft-funding').innerText(), /Hearth store/);
    const blocked = await checkpoint(p, 'wood-output-needed-for-tools', true);
    await click(p, '#craft-knapping'); await checkpoint(p, 'unfunded-tools-do-not-pay', true, blocked.s);
    s = await collectPlot(p, blocked.s, 'woodland'); assert.equal(s.cultivation.receipts.woodlandWood, 8);
    const beforePay = await checkpoint(p, 'woodland-receipt-before-tools-payment', true);
    await select(p, ['u0']); await inspectBuilding(p, s, context.workshopId); await click(p, '#craft-knapping'); s = (await saved(p)).state;
    assert.equal(s.spent.wood, beforePay.s.spent.wood + 4); assert.equal(s.spent.stone, beforePay.s.spent.stone + 8);
    assert.equal(s.storage.stores.b0.wood, beforePay.s.storage.stores.b0.wood - 4);
    assert.equal(s.knapping.workshop, context.workshopId); assert.equal(s.knapping.work, 0);
    s = await until(p, s, v => v.tools, 'harvest-enabled useful paid Tools work'); assert.equal(s.knapping.work, 12);
    await checkpoint(p, 'wood-output-used-for-completed-tools', true);
    report.actions.push({scenario: active, action: 'causal-wood-use', oldLocalFreeWood: freeBefore, newlyReceiptedWood: 8, actualRecipeDebit: 4,
      limit: 'Fungible stores do not identify individual wood items; the receipt enabled an otherwise unfunded local purchase'}); return s;
  }
  async function investmentBranch(context, order, touch) {
    active = order.join('-then-'); const p = await open({touch}); let s = (await importExact(p, context.common.raw, 'same-earned-common-import')).s;
    assert.equal(s.cultivation.receipts.pilotFood, 6); assert.equal(s.cultivation.receipts.woodlandWood, 0);
    await sourceArchive(p, context.sourceRaw);
    if (touch) {await choosePlot(p, 'pilot', true); await screenshotReachable(p, '#support-status', 'protected-next-visible');}
    for (const investment of order) {
      if (investment === 'woodland') s = await woodlandAndUsefulTools(p, s, context);
      else {s = await startPlot(p, s, 'pilot'); s = await growPlot(p, s, 'pilot'); s = await collectPlot(p, s, 'pilot');}
    }
    assert.equal(s.cultivation.receipts.pilotFood, 12); assert.equal(s.cultivation.receipts.woodlandWood, 8); assert.equal(s.tools, true);
    // A third paid planting is supported useful work, not an added progression gate.
    // Its food demand crosses the initial five food minus the protected four floor.
    s = await startPlot(p, s, 'pilot'); s = await until(p, s, v => crop(v, 'pilot').job?.phase === 'growing', 'harvested-food-supported third planting', 1000);
    const c = s.cultivation, consumedThird = BigInt(c.pantry.food.consumedMilli) * 3n + BigInt(c.pantry.food.remainder);
    assert.ok(consumedThird > 3000n, 'Actual support exceeds all initial food available above the four-food floor');
    const effectiveFood = BigInt(s.storage.stores.b0.food) * 3000n + BigInt(c.pantry.food.milli) * 3n - BigInt(c.pantry.food.remainder);
    assert.ok(effectiveFood >= 12000n, 'Resident recovery floor still physically owned');
    assert.equal(deposit(s, 'd3').amount, 70); assert.equal(deposit(s, 'd7').amount, 150, 'No later finite food rescues the proof');
    assert.equal(c.generated.food, 12); assert.equal(c.generated.wood, 8); assert.equal(c.nextFunded, true);
    assert.match(await p.locator('#support-status').innerText(), /Next crop funded/);
    const final = await checkpoint(p, 'useful-outputs-and-funded-next-crop', true);
    await p.clock.runFor(7000); await checkpoint(p, 'paused-no-growth-or-support', false, final.s);
    await p.reload(); await p.locator('#cultivation-panel').waitFor(); await flush(p); await checkpoint(p, 'exact-paused-refresh', true, final.s);
    await sourceArchive(p, context.sourceRaw);
    if (touch) {await choosePlot(p, 'pilot', true); await screenshotReachable(p, '#plot-quote', 'remaining-next-cycle-quote-visible');}
    report.branches.push({scenario: active, order, commonCheckpoint: context.common.file, commonStateSHA256: sha(JSON.stringify(context.common.s)), finalCheckpoint: final.file,
      consumedFoodThirdMilli: consumedThird.toString(), minimumHarvestedFoodUsedThirdMilli: (consumedThird - 3000n).toString(), initialFood: 5, protectedFoodFloor: 4,
      foodEvidenceLimit: 'Fungible stores do not identify food items; this lower bound measures support beyond preharvest spendable food while the floor remains owned.',
      pilotFoodReceipts: c.receipts.pilotFood, woodlandWoodReceipts: c.receipts.woodlandWood, nextFunded: c.nextFunded, thirdCropPhase: crop(s, 'pilot').job.phase});
    return {p, final};
  }

  async function installStorageFault(p, kind) {
    assert.ok(['write', 'read'].includes(kind));
    await p.evaluate(({key, kind}) => {
      const method = kind === 'write' ? 'setItem' : 'getItem', original = Storage.prototype[method]; let attempts = 0;
      Storage.prototype[method] = function(name, ...args) {
        if (name === key) {attempts++; throw new DOMException('Bounded cultivation QA ' + kind + ' failure', kind === 'write' ? 'QuotaExceededError' : 'SecurityError');}
        return original.call(this, name, ...args);
      };
      window.__cultivationRestoreFault = () => {Storage.prototype[method] = original; delete window.__cultivationRestoreFault; return {kind, attempts};};
    }, {key: KEY, kind});
  }
  async function restoreStorageFault(p) {
    const result = await p.evaluate(() => window.__cultivationRestoreFault()); assert.ok(result.attempts > 0, 'Fault was actually encountered'); return result;
  }
  async function failedImport(context, incomingRaw, kind) {
    active = 'import-' + kind + '-failure'; const p = await open();
    const before = await importExact(p, context.common.raw, 'earned-former-live-history');
    await click(p, '#journey'); await installStorageFault(p, kind); p.once('dialog', d => d.accept());
    await p.locator('#file').setInputFiles({name: 'other-earned-history.json', mimeType: 'application/json', buffer: Buffer.from(incomingRaw)});
    await p.locator('#save-status').filter({hasText: 'Import failed to save'}).waitFor(); const fault = await restoreStorageFault(p);
    assert.equal(await rawSave(p), before.raw, 'Failed candidate write/read preserves durable former envelope');
    const out = await download(p, '#export', 'former-live-export-after-failure');
    assert.equal(out.raw, before.raw, 'Failed import preserves exact live export, including source/history');
    await click(p, '#close'); await p.clock.runFor(7000);
    assert.equal(await p.locator('#stop').isDisabled(), true); assert.equal(await p.locator('#camp-warning').isVisible(), true);
    const png = out.file.replace(/\.json$/, '.png'); await p.screenshot({path: path.join(DIR, png), fullPage: true});
    report.checkpoints.push({scenario: active, label: 'former-live-export-after-failure', file: out.file, sha256: out.sha256, png, pngSHA256: sha(fs.readFileSync(path.join(DIR, png)))});
    report.faults.push({scenario: active, ...fault, formerStateSHA256: sha(JSON.stringify(before.s)), incomingStateSHA256: sha(JSON.stringify(envelope(incomingRaw).state)), unchangedEnvelopeSHA256: before.sha256});
    await inputs(p); await p.context().close();
  }
  async function failedAdoption(context) {
    active = 'adoption-quota-failure'; const p = await open(); const before = await importExact(p, context.opening.raw, 'earned-opening-before-adoption');
    await click(p, '#cultivation-adopt'); await installStorageFault(p, 'write'); await click(p, '#cultivation-confirm');
    await p.locator('#cultivation-adoption-quote').filter({hasText: 'not saved'}).waitFor(); const fault = await restoreStorageFault(p);
    assert.equal(await rawSave(p), before.raw); await click(p, '#cultivation-confirm-cancel');
    const unchanged = await checkpoint(p, 'failed-adoption-keeps-v6-live', true, before.s); assert.equal(unchanged.raw, before.raw); assert.equal(unchanged.s.version, 6);
    report.faults.push({scenario: active, ...fault, unchangedEnvelopeSHA256: before.sha256}); await inputs(p); await p.context().close();
  }
  async function cancelRecovery(context) {
    active = 'narrow-unstarted-recovery'; const p = await open({touch: true}); let s = (await importExact(p, context.common.raw, 'same-earned-recovery-start')).s;
    const before = copy(s), beforePantry = copy(s.cultivation.pantry); s = await startPlot(p, s, 'pilot');
    s = await until(p, s, v => crop(v, 'pilot').job?.staged.seed > 0 && crop(v, 'pilot').job.workSlots === 0, 'seed staged before paid processing', 80);
    const jobId = crop(s, 'pilot').job.id; assert.equal(crop(s, 'pilot').job.recipeWater, 0);
    await choosePlot(p, 'pilot', true); await click(p, '#plot-cancel'); s = (await saved(p)).state;
    assert.equal(crop(s, 'pilot').job.phase, 'cancelling'); assert.equal(crop(s, 'pilot').job.id, jobId);
    s = await stop(p); assert.ok(crop(s, 'pilot').job.staged.seed > 0, 'Stop leaves actual onsite seed to recover');
    await select(p, ['u1']); await choosePlot(p, 'pilot', true);
    assert.equal(await p.locator('#plot-resume').innerText(), 'Recover planting supplies');
    await screenshotReachable(p, '#cultivation-plot-details', 'stopped-recovery-retains-seed');
    await screenshotReachable(p, '#plot-resume', 'named-recovery-action-visible');
    await click(p, '#plot-resume', true);
    s = await until(p, (await saved(p)).state, v => actor(v, 'u1').cultivationCargo?.kind === 'recovery' && actor(v, 'u1').cargo > 0, 'different worker carries actual recovered seed', 80);
    const held = await checkpoint(p, 'mid-recovery-custody-before-refresh', true);
    await p.reload(); await p.locator('[data-unit="u0"]').waitFor(); await flush(p); await checkpoint(p, 'mid-recovery-exact-refresh', true, held.s);
    s = await until(p, held.s, v => crop(v, 'pilot').job === null && v.units.every(u => !u.cargo), 'recovered inputs physically return');
    assert.deepEqual(s.stock, before.stock); assert.deepEqual(s.cultivation.pantry, beforePantry);
    assert.equal(s.cultivation.recipeWaterConsumed, before.cultivation.recipeWaterConsumed); assert.deepEqual(s.cultivation.generated, before.cultivation.generated);
    assert.equal(s.cultivation.nextFunded, true); await choosePlot(p, 'pilot', true);
    await screenshotReachable(p, '#plot-quote', 'recovered-planting-quote-visible'); await checkpoint(p, 'unstarted-inputs-returned-once', true);
    report.actions.push({scenario: active, action: 'cancel-stop-reassign-refresh-recover', jobId, previousWorker: 'u0', recoveryWorker: 'u1', inputStockRestored: true});
    await inputs(p); await p.context().close();
  }
  async function supportFallback(context, earnedFinal) {
    active = 'support-floor-fallback'; const p = await open(); let s = (await importExact(p, earnedFinal.raw, 'same-earned-tools-history')).s;
    for (let i = 0; i < 5; i++) {
      await select(p, ALL); await inspectBuilding(p, s, 'b0'); const free = Number(await p.locator('#free-wood').innerText());
      assert.ok(Number.isFinite(free) && free >= 0); if (free < 1) break;
      s = await transfer(p, s, 'b0', context.outpostId, 'wood');
    }
    assert.equal(s.tools, true); s = await gather(p, s, ['u0'], 'd4');
    s = await until(p, s, v => actor(v).reason === 'Recovery pace — waiting for support' && actor(v).phase === 'extract' && !actor(v).path.length,
      'actual support-floor fallback on the unchanged gather order', 500, 1100);
    const fallback = await checkpoint(p, 'bare-recovery-pace-witness', true), before = copy(s), u = actor(before);
    assert.ok(deposit(before, 'd4').amount > 0); assert.equal(before.tools, true);
    for (let n = 0; s.time === before.time && n < 5; n++) s = await pulse(p, 80);
    assert.ok(Math.abs(s.time - before.time - .1) < 1e-7, 'One real fallback slot');
    const v = actor(s), extracts = u.work + .1 + .00001 >= .6;
    assert.deepEqual(v.order, u.order); assert.equal(v.next, u.next); assert.equal(s.tools, true);
    assert.equal(v.cargo, u.cargo + Number(extracts));
    assert.ok(Math.abs(v.work - (extracts ? Math.max(0, u.work + .1 - .6) : u.work + .1)) < 1e-7);
    assert.equal(deposit(s, 'd4').amount, deposit(before, 'd4').amount - Number(extracts));
    assert.deepEqual(s.cultivation.pantry, before.cultivation.pantry, 'Bare fallback charges no supported slot');
    const beforeFundingSlots = s.cultivation.demandSlots;
    assert.ok(s.storage.stores[context.outpostId].wood >= 5);
    s = await transfer(p, s, context.outpostId, 'b0', 'wood', ['u1'], true);
    s = await until(p, s, value => BigInt(value.cultivation.demandSlots) > BigInt(beforeFundingSlots)
      && actor(value).phase === 'extract' && !actor(value).path.length && actor(value).reason === 'Gathering wood', 'same gathering resumes supported work', 500);
    assert.deepEqual(actor(s).order, u.order); assert.equal(s.tools, true);
    const resumed = await checkpoint(p, 'physical-local-funding-resumes-tools', true);
    report.actions.push({scenario: active, action: 'support-fallback-physical-funding-resume', fallbackCheckpoint: fallback.file, resumedCheckpoint: resumed.file,
      gatherer: 'u0', carrier: 'u1', source: 'd4', suppliedWood: 5, unchangedOrder: u.order,
      limit: 'This separate history may mature its already planted third crop; it does not alter the two milestone branch counters'});
    await inputs(p); await p.context().close();
  }
  async function lockAndReadOnly(second) {
    active = 'actual-lock-contention'; const owner = second.p, before = await checkpoint(owner, 'writer-owned-earned-history');
    const other = await open({context: owner.context()}); assert.match(await other.locator('#camp-warning').innerText(), /another tab owns/i);
    assert.equal(await other.locator('#stop').isDisabled(), true); assert.equal(await other.locator('#pause').innerText(), 'Resume');
    await other.clock.runFor(5000); const readOnly = await checkpoint(other, 'contended-read-only-export', true, before.s);
    assert.equal(readOnly.raw, before.raw, 'Nonowner exports exact saved history and cannot advance it');
    await click(other, '#journey'); assert.equal(await other.locator('#import').isDisabled(), true); await click(other, '#close');
    // Make the nonowner genuinely stale through an ordinary action by the actual
    // owner. No harness write or forged storage event participates in this test.
    await owner.bringToFront(); const ownerAdvanced = await pulse(owner, 1000);
    assert.ok(ownerAdvanced.cultivation.tick > before.s.cultivation.tick);
    const latest = await checkpoint(owner, 'actual-owner-newer-durable-history');
    await other.bringToFront(); await other.clock.runFor(4000);
    assert.equal(await rawSave(other), latest.raw, 'Stale nonowner does not overwrite the actual owner update');
    assert.equal(await other.locator('#stop').isDisabled(), true);
    await click(other, '#journey'); assert.equal(await other.locator('#import').isDisabled(), true);
    const staleExport = await download(other, '#export', 'stale-read-only-live-export'); await click(other, '#close');
    assert.equal(staleExport.raw, before.raw, 'Read-only tab retains its honest older live export until reload');
    report.checkpoints.push({scenario: active, label: 'stale-read-only-live-export', file: staleExport.file, sha256: staleExport.sha256});
    await inputs(owner); await owner.close();
    await other.reload(); await other.locator('[data-unit="u0"]').waitFor(); await flush(other);
    assert.equal(await other.locator('#stop').isEnabled(), true, 'Reload after owner close acquires the actual lock');
    await checkpoint(other, 'new-owner-reload-preserves-history', false, latest.s);
    const advanced = await pulse(other, 1000); assert.ok(advanced.cultivation.tick > latest.s.cultivation.tick);
    assert.deepEqual(advanced.cultivation.pantry, latest.s.cultivation.pantry, 'Growing-only new owner advances no support demand');
    report.faults.push({scenario: active, actualSecondTab: true, nonownerEnvelopeSHA256: readOnly.sha256,
      newerOwnerEnvelopeSHA256: latest.sha256, staleTabCouldNotOverwrite: true, ownerReleaseThenReload: true}); await inputs(other); await other.context().close();

    active = 'missing-web-locks'; const missing = await open({touch: true, fault: 'missing-lock'});
    assert.match(await missing.locator('#camp-warning').innerText(), /read.only|writer lock/i);
    assert.equal(await missing.locator('#stop').isDisabled(), true); assert.equal(await rawSave(missing), null);
    await click(missing, '#journey'); const exportBefore = await download(missing, '#export', 'unsupported-lock-readable-export');
    assert.equal(envelope(exportBefore.raw).state.version, 6); assert.equal(await missing.locator('#import').isDisabled(), true); await click(missing, '#close');
    await missing.clock.runFor(7000); assert.equal(await rawSave(missing), null);
    await screenshotReachable(missing, '#camp-warning', 'unsupported-lock-warning-stays-visible');
    await click(missing, '#journey'); const exportAfter = await download(missing, '#export', 'unsupported-lock-no-advance'); await click(missing, '#close');
    assert.equal(exportAfter.raw, exportBefore.raw);
    for (const out of [exportBefore, exportAfter]) report.checkpoints.push({scenario: active, label: out.file, file: out.file, sha256: out.sha256});
    report.faults.push({scenario: active, absentBackingSave: true, exactExportSHA256: exportBefore.sha256}); await inputs(missing); await missing.context().close();

    active = 'initial-unreadable-save'; const unreadable = await open({touch: true, fault: 'read'});
    assert.match(await unreadable.locator('#camp-warning').innerText(), /could not be read/i); assert.equal(await unreadable.locator('#stop').isDisabled(), true);
    await unreadable.clock.runFor(7000); await screenshotReachable(unreadable, '#camp-warning', 'initial-read-failure-stays-visible');
    await click(unreadable, '#journey'); assert.equal(await unreadable.locator('#export').isDisabled(), true); assert.equal(await unreadable.locator('#import').isDisabled(), true);
    report.faults.push({scenario: active, exportDisabledBecauseOriginalUnavailable: true}); await inputs(unreadable); await unreadable.context().close();
  }
  async function inheritedOpeningReadFailure(earned) {
    active = 'inherited-opening-read-failure';
    const context = await browser.newContext({viewport: {width: 1440, height: 1100}}); contexts.push(context); context.setDefaultTimeout(7000);
    await context.addInitScript(({oldKey, newKey}) => {
      window.__cultivationInputs = [];
      for (const type of ['pointerdown', 'pointerup', 'click', 'keydown', 'keyup', 'change']) document.addEventListener(type, e => window.__cultivationInputs.push({type,
        target: e.target.closest?.('[data-unit]')?.dataset.unit || e.target.closest?.('button[id],input[id],canvas[id]')?.id || e.target.id || e.target.tagName,
        rawTargetTag: e.target.tagName, trusted: e.isTrusted, key: e.key || null, pointerType: e.pointerType || null, at: performance.now()}), true);
      if (window.name !== 'cultivation-old-read-fault') return;
      const get = Storage.prototype.getItem, set = Storage.prototype.setItem, seen = {readAttempts: 0, writeCalls: []};
      Storage.prototype.getItem = function(key) {
        if (key === oldKey) {seen.readAttempts++; throw new DOMException('Bounded QA inherited opening read denied', 'SecurityError');}
        return get.call(this, key);
      };
      Storage.prototype.setItem = function(key, value) {
        if (key === oldKey || key === newKey) seen.writeCalls.push({key, bytes: String(value).length});
        return set.call(this, key, value);
      };
      window.__cultivationOldFaultStatus = () => ({readAttempts: seen.readAttempts, writeCalls: seen.writeCalls.slice()});
      window.__cultivationRestoreOldFault = () => {Storage.prototype.getItem = get; Storage.prototype.setItem = set;
        const result = window.__cultivationOldFaultStatus(); delete window.__cultivationOldFaultStatus; delete window.__cultivationRestoreOldFault; return result;};
    }, {oldKey: OLD_KEY, newKey: KEY});
    const p = await context.newPage(); page = p; p.on('pageerror', error => report.errors.push({scenario: active, message: error.message}));
    await p.clock.install({time: new Date('2026-01-01T00:00:00Z')});
    await p.goto('http://127.0.0.1:' + server.address().port + '/hearth-rts.html'); await p.locator('[data-unit="u0"]').waitFor();
    if (await p.locator('#pause').innerText() === 'Pause') await click(p, '#pause');
    await p.clock.pauseAt(new Date('2026-01-01T01:00:00Z'));
    // Seed the old slot solely through its unchanged public import control, using
    // the exact v6 bytes already earned earlier in this browser journey.
    await click(p, '#journey'); p.once('dialog', dialog => dialog.accept());
    await p.locator('#file').setInputFiles({name: 'earned-opening.json', mimeType: 'application/json', buffer: Buffer.from(earned.sourceRaw)});
    await p.locator('#dialog').waitFor({state: 'hidden'}); await flush(p);
    assert.equal(await p.evaluate(key => localStorage.getItem(key), OLD_KEY), earned.sourceRaw);
    assert.equal(await rawSave(p), null, 'Ordinary original opening creates no cultivation slot');
    await click(p, '#journey'); const original = await download(p, '#export', 'ordinary-original-opening-export'); await click(p, '#close');
    assert.equal(original.raw, earned.sourceRaw); report.checkpoints.push({scenario: active, label: 'ordinary-original-opening-export', file: original.file, sha256: original.sha256});
    await inputs(p);
    // window.name is browser metadata for the fault's lifetime. It is neither
    // gameplay state nor a persisted camp setting; no source HTML is patched.
    await p.evaluate(() => {window.name = 'cultivation-old-read-fault';});
    await p.goto('http://127.0.0.1:' + server.address().port + '/hearth-cultivation.html');
    await p.locator('[data-unit="u0"]').waitFor(); await flush(p);
    assert.equal(await rawSave(p), null, 'Denied inherited-source read creates no new playable save');
    assert.equal(await p.locator('#stop').isDisabled(), true); assert.equal(await p.locator('#pause').innerText(), 'Resume');
    assert.match(await p.locator('#camp-warning').innerText(), /could not be read|unavailable/i);
    await p.clock.runFor(7000); await screenshotReachable(p, '#camp-warning', 'inherited-source-read-failure-persists');
    await click(p, '#journey'); assert.equal(await p.locator('#export').isDisabled(), true);
    assert.equal(await p.locator('#import').isDisabled(), true); await click(p, '#close');
    const denied = await p.evaluate(() => window.__cultivationOldFaultStatus());
    assert.ok(denied.readAttempts > 0); assert.deepEqual(denied.writeCalls, []); assert.equal(await rawSave(p), null);
    const restored = await p.evaluate(() => {window.name = ''; return window.__cultivationRestoreOldFault();});
    assert.deepEqual(restored, denied); assert.equal(await p.evaluate(key => localStorage.getItem(key), OLD_KEY), earned.sourceRaw);
    await inputs(p); await p.reload(); await p.locator('[data-unit="u0"]').waitFor(); await flush(p);
    assert.equal(await p.locator('#stop').isEnabled(), true);
    const recovered = await checkpoint(p, 'inherited-source-read-restored', true, JSON.parse(earned.sourceRaw));
    assert.equal(recovered.s.version, 6, 'Read recovery does not adopt or provision the opening');
    assert.equal(recovered.e.sourceRaw, earned.sourceRaw);
    assert.equal(await p.evaluate(key => localStorage.getItem(key), OLD_KEY), earned.sourceRaw, 'Original slot stays byte-exact after normal recovery saving');
    const source = await sourceArchive(p, earned.sourceRaw);
    report.faults.push({scenario: active, setup: 'Unchanged RTS ordinary import of this run\'s exact earned opening',
      originalExportSHA256: original.sha256, deniedReadAttempts: denied.readAttempts, deniedPhaseWrites: denied.writeCalls.length,
      noCultivationSlotDuringFailure: true, recoveredEnvelopeSHA256: recovered.sha256, recoveredSourceSHA256: source.sha256});
    await inputs(p); await context.close();
  }

  try {
    server = http.createServer((req, res) => {const route = req.url.split('?')[0], body = route === '/hearth-cultivation.html' ? html : route === '/hearth-rts.html' ? legacyHtml : null;
      if (body === null) {res.writeHead(404); return res.end();} res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'}); res.end(body);});
    server.listen(0, '127.0.0.1'); await once(server, 'listening'); browser = await playwright.chromium.launch({headless: true, chromiumSandbox: true});
    const openingPage = await open(), context = await earnedOpening(openingPage); await inputs(openingPage); await openingPage.context().close();
    const first = await investmentBranch(context, ['woodland', 'pilot'], false); await inputs(first.p); await first.p.context().close();
    const second = await investmentBranch(context, ['pilot', 'woodland'], true);
    await inputs(second.p); await lockAndReadOnly(second);
    await failedImport(context, first.final.raw, 'write'); await failedImport(context, first.final.raw, 'read'); await failedAdoption(context);
    await cancelRecovery(context); await supportFallback(context, first.final);
    await inheritedOpeningReadFailure(context);
    assert.equal(report.branches.length, 2); assert.deepEqual(report.branches.map(b => b.pilotFoodReceipts), [12, 12]);
    for (const target of ['gather', 'cultivation-adopt', 'cultivation-confirm', 'support-confirm', 'water-gather', 'seed-gather', 'plot-start', 'plot-resume', 'plot-collect', 'craft-knapping', 'export'])
      assert.ok(Object.keys(report.inputCounts).some(k => k.endsWith(':click:' + target + ':true')), 'Trusted control input: ' + target);
    assert.ok(journal.some(r => r.kind === 'input' && r.events.some(e => e.target === 'plot-pilot' && e.trusted && e.pointerType === 'touch')), 'Actual emulated touch plot inspection');
    assert.deepEqual(report.errors, []); report.status = 'passed';
  } catch (error) {
    report.status = 'failed'; report.failure = {message: String(error), stack: error.stack}; process.exitCode = 1;
    if (page && !page.isClosed()) {await page.screenshot({path: path.join(DIR, 'failure.png'), fullPage: true}).catch(() => {}); report.failure.body = await page.locator('body').innerText().catch(() => null); report.failure.raw = await rawSave(page).catch(() => null); await inputs(page).catch(() => {});}
  } finally {
    for (const c of contexts) await c.close().catch(() => {});
    if (browser) await browser.close(); if (server) await new Promise(resolve => server.close(resolve));
    const bytes = zlib.gzipSync(journal.map(r => JSON.stringify(r)).join('\n') + '\n'); fs.writeFileSync(path.join(DIR, 'observations.jsonl.gz'), bytes);
    report.journal = {file: 'observations.jsonl.gz', sha256: sha(bytes), rows: journal.length}; report.wallSeconds = (Date.now() - started) / 1000; persist();
  }
  if (report.status === 'passed') console.log('PASS ordinary-control local cultivation, physical yields, protected continuation and bounded persistence faults');
})().catch(error => {console.error(error); process.exitCode = 1;});
