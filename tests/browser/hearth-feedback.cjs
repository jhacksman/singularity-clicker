/* Spark-only actual-control acceptance for the visit-local trip feedback.
 * No engine import, hidden production-state reads, storage writes, authored saves,
 * source patches or synthetic simulation commands. The controlled clock is an
 * observation tool, not evidence of human pacing. Only key milestones export PNG
 * and native Journey files; measured cycles retain bounded Pause-save tick traces.
 */
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const http = require('node:http'), crypto = require('node:crypto'), zlib = require('node:zlib'), {once} = require('node:events');
const playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const ROOT = path.resolve(__dirname, '../..'), DIR = path.join(ROOT, 'artifacts/hearth-feedback');
const KEY = 'singularity-clicker.hearth-rts.v1', ALL = ['u0', 'u1', 'u2', 'u3'];
const RES = ['wood', 'stone', 'food'], TOTAL = {wood: 416, stone: 220, food: 225};
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const copy = value => JSON.parse(JSON.stringify(value));
const unit = (s, id = 'u0') => s.units.find(u => u.id === id);
const dep = (s, id) => s.deposits.find(d => d.id === id);
const building = (s, id) => s.buildings.find(b => b.id === id);
const close = (a, b, label, epsilon = 1e-7) => assert.ok(Math.abs(a - b) < epsilon, `${label}: ${a} != ${b}`);
function matter(s) {
  assert.equal(s.version, 6); assert.equal(s.construction.profile, 'accepted-opening.physical-construction.v1');
  for (const r of RES) {
    assert.equal(s.stock[r], Object.values(s.storage.stores).reduce((n, v) => n + v[r], 0));
    assert.equal(s.deposits.filter(d => d.kind === r).reduce((n, d) => n + d.amount, 0) + s.stock[r] + s.spent[r]
      + s.units.filter(u => u.resource === r).reduce((n, u) => n + u.cargo, 0)
      + s.construction.sites.reduce((n, c) => n + c.staged[r], 0), TOTAL[r], 'Finite custody: ' + r);
  }
  assert.equal(s.units.length, 4); assert.deepEqual(s.storage.transfers, []);
}

(async () => {
  fs.mkdirSync(DIR, {recursive: true});
  const start = Date.now(), deadline = start + 850000;
  const manifest = {source: {}, build: {}};
  for (const file of ['src/hearth-rts/engine.js', 'src/hearth-rts/feedback.js', 'src/hearth-rts/view.js',
    'src/hearth-rts/shell.html', 'src/hearth-rts/styles.css', 'build.mjs', 'tests/browser/hearth-feedback.cjs']) {
    manifest.source[file] = sha(fs.readFileSync(path.join(ROOT, file)));
  }
  const html = fs.readFileSync(path.join(ROOT, 'dist/hearth-rts.html'), 'utf8');
  manifest.build['dist/hearth-rts.html'] = sha(html);
  for (const file of ['src/hearth-rts/engine.js', 'src/hearth-rts/feedback.js', 'src/hearth-rts/view.js'])
    assert.ok(html.includes(fs.readFileSync(path.join(ROOT, file), 'utf8')), 'Built exact candidate source: ' + file);
  const binding = sha(JSON.stringify(manifest));
  const report = {status: 'running', sourceCommit: process.env.FEEDBACK_SOURCE_COMMIT || null, binding, manifest,
    bounds: {wallSeconds: 850, maximumMeasuredTickSeconds: .100001, simulationSeconds: 1200},
    checkpoints: [], actions: [], observations: [], inputCounts: {}, errors: [],
    limits: ['Controlled desktop/Chromium touch emulation; no physical-device or human discovery/enjoyment verdict',
      'Long and short trips use the same worker and finite source but different receiver/topology; descriptive observations, not a controlled tool-effect experiment',
      'Pause-save tick traces independently account for measured receipt cycles; setup is observed at coarser intervals',
      'Source hashes bind artifacts for independent coordinator review, not independent authentication']};
  let server, browser, page, active = 'desktop', sequence = 0;
  const contexts = [], journal = [];
  const persist = () => fs.writeFileSync(path.join(DIR, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  const guard = () => assert.ok(Date.now() < deadline, '850-second bounded browser deadline');
  async function inputs(p) {
    const rows = await p.evaluate(() => window.__feedbackInputs.splice(0));
    for (const e of rows) {
      const key = active + ':' + e.type + ':' + e.target + ':' + e.trusted;
      report.inputCounts[key] = (report.inputCounts[key] || 0) + 1;
    }
    if (rows.length) journal.push({kind: 'input', scenario: active, rows});
  }
  async function rawSave(p) { return p.evaluate(key => localStorage.getItem(key), KEY); }
  async function saved(p) { const raw = await rawSave(p), s = JSON.parse(raw); matter(s); return s; }
  async function flush(p) { await p.clock.runFor(120); }
  async function checkpoint(p, label, screenshot = false, expectedRaw = null) {
    guard(); assert.equal(await p.locator('#pause').innerText(), 'Resume');
    await p.locator('#journey').click(); const waiting = p.waitForEvent('download'); await p.locator('#export').click();
    const download = await waiting, stem = String(++sequence).padStart(3, '0') + '-' + active + '-' + label;
    const file = stem + '.json'; await download.saveAs(path.join(DIR, file)); await download.delete(); await p.locator('#close').click();
    const raw = fs.readFileSync(path.join(DIR, file), 'utf8'), s = JSON.parse(raw); matter(s);
    assert.equal(await rawSave(p), raw, 'Exact native Journey/Pause-save bytes');
    if (expectedRaw !== null) assert.equal(raw, expectedRaw, 'Exact expected camp survives view-only operation');
    const row = {scenario: active, label, file, sha256: sha(raw), time: s.time};
    if (screenshot) {
      await flush(p); row.png = stem + '.png'; await p.screenshot({path: path.join(DIR, row.png), fullPage: true});
      row.pngSHA256 = sha(fs.readFileSync(path.join(DIR, row.png))); assert.equal(await rawSave(p), raw);
    }
    report.checkpoints.push(row); await inputs(p); persist(); return {s, raw, file};
  }
  async function pulse(p, milliseconds = 1000) {
    guard(); assert.equal(await p.locator('#pause').innerText(), 'Resume');
    await p.locator('#pause').click(); await p.clock.runFor(milliseconds); await p.locator('#pause').click();
    const s = await saved(p); assert.ok(s.time < 1200, 'Finite simulation budget'); return s;
  }
  async function until(p, s, predicate, label, milliseconds = 1000) {
    for (let n = 0; !predicate(s) && n < 600; n++) s = await pulse(p, milliseconds);
    assert.ok(predicate(s), 'Ordinary UI scenario completed: ' + label); return s;
  }
  async function clickMap(p, x, y, touch = false) {
    await p.locator('#world').scrollIntoViewIfNeeded(); const box = await p.locator('#world').boundingBox();
    const t = await p.locator('#world').evaluate(c => ({width: c.width, height: c.height,
      x: Number(c.dataset.cameraX || 0), y: Number(c.dataset.cameraY || 0), scale: Number(c.dataset.cameraScale || 1)}));
    const point = {x: box.x + (x * 32 * t.scale + t.x) / t.width * box.width,
      y: box.y + (y * 32 * t.scale + t.y) / t.height * box.height};
    assert.equal(await p.evaluate(q => document.elementFromPoint(q.x, q.y)?.id, point), 'world');
    if (touch) await p.touchscreen.tap(point.x, point.y); else await p.mouse.click(point.x, point.y);
  }
  async function select(p, ids) {
    for (let i = 0; i < ids.length; i++) await p.locator('[data-unit="' + ids[i] + '"]').click({modifiers: i ? ['Shift'] : []});
  }
  async function gather(p, s, ids, target) {
    await select(p, ids); await p.locator('#gather').click(); const d = dep(s, target); await clickMap(p, d.x + .5, d.y + .5);
    const after = await saved(p); assert.equal(after.time, s.time);
    for (const id of ids) assert.deepEqual(unit(after, id).next || unit(after, id).order, {kind: 'gather', target});
    report.actions.push({scenario: active, kind: 'gather', ids, target, time: s.time}); return after;
  }
  async function stop(p, s, ids = ALL) {
    await select(p, ids); await p.locator('#stop').click();
    return until(p, await saved(p), v => ids.every(id => !unit(v, id).cargo && unit(v, id).phase === 'idle'), 'Stop and Return');
  }
  async function place(p, s, kind, x, y) {
    await select(p, ALL); await p.locator('[data-build="' + kind + '"]').click(); await clickMap(p, x + .5, y + .5);
    if (await p.locator('#placement-confirm').isVisible()) {
      assert.equal(await p.locator('#placement-confirm').isEnabled(), true, 'Chosen ordinary site is valid before confirmation');
      await p.locator('#placement-confirm').click();
    }
    const after = await saved(p), added = after.buildings.filter(b => !building(s, b.id));
    assert.equal(added.length, 1); const b = added[0]; assert.deepEqual([b.kind, b.x, b.y, b.done], [kind, x, y, false]);
    assert.deepEqual(after.spent, s.spent); assert.deepEqual(after.stock, s.stock);
    report.actions.push({scenario: active, kind: 'build', buildingId: b.id, x, y, time: s.time});
    const finished = await until(p, after, v => building(v, b.id).done && v.units.every(u => u.order.kind !== 'build'), 'physical ' + kind);
    await checkpoint(p, kind + '-usable', true); return {s: finished, id: b.id};
  }
  async function inspectSource(p, s, target = 'd4', touch = false) {
    const before = await rawSave(p), d = dep(s, target);
    if (await p.locator('#command-cancel').isEnabled()) await p.locator('#command-cancel').click();
    for (const id of ['move', 'gather', 'assign-build']) assert.equal(await p.locator('#' + id).getAttribute('aria-pressed'), 'false', 'Inspection begins with no armed command');
    assert.equal(await p.locator('#placement-controls').isVisible(), false, 'Inspection has no pending placement');
    await clickMap(p, d.x + .5, d.y + .5, touch); await flush(p);
    assert.equal(await rawSave(p), before, 'Unarmed deposit inspection is read-only');
    assert.ok(await p.locator('#trip-feedback').isVisible());
  }
  async function rows(p) {
    return p.locator('#trip-feedback [data-trip]').evaluateAll(nodes => nodes.map(n => ({sourceId: n.dataset.source,
      workerId: n.dataset.worker, storeId: n.dataset.store, tools: n.dataset.tools,
      title: n.querySelector('.trip-title').textContent, parts: n.querySelector('.trip-parts').textContent,
      when: n.querySelector('.trip-when').textContent})));
  }
  function parseRow(row) {
    const title = /· (\d+) (wood|stone|food) in ([\d.]+)s$/.exec(row.title);
    const parts = /^Extraction ([\d.]+)s · walking ([\d.]+)s · handling ([\d.]+)s$/.exec(row.parts);
    const when = /^Observed at ([\d.]+)s camp time; (\d+) remained at this source\. (Current|Earlier) camp layout\.$/.exec(row.when);
    assert.ok(title && parts && when, 'Visible row uses complete, parseable measured labels');
    return {...row, amount: Number(title[1]), resource: title[2], seconds: Number(title[3]), extractSeconds: Number(parts[1]),
      travelSeconds: Number(parts[2]), otherSeconds: Number(parts[3]), time: Number(when[1]), sourceRemaining: Number(when[2]), currentLayout: when[3] === 'Current'};
  }
  async function measure(p, s, label, storeId, tools, count = 2) {
    assert.ok(s.units.filter(u => u.order.kind === 'gather').every(u => u.id === 'u0'), 'Isolate receipt accounting from other gatherers');
    const receipts = [], ticks = [], initial = copy(s), firstCheckpoint = await checkpoint(p, label + '-start');
    for (let i = 0; receipts.length < count && i < 2400; i++) {
      const before = s, old = unit(before); s = await pulse(p, 80); const current = unit(s), dt = s.time - before.time;
      assert.ok(dt >= 0 && dt <= .100001, 'Every measured simulation tick is bracketed');
      if (!dt) { assert.deepEqual(s, before); continue; }
      const part = old.path.length ? 'travelSeconds' : old.phase === 'extract' ? 'extractSeconds' : 'otherSeconds';
      ticks.push({start: before.time, end: s.time, dt, part, outbound: !!old.path.length && old.phase === 'extract'});
      journal.push({kind: 'measured-native-pause-tick', scenario: active, label, before, after: s});
      assert.equal(old.order.kind, 'gather'); assert.equal(old.order.target, 'd4'); assert.equal(before.tools, tools); assert.equal(s.tools, tools);
      if (old.phase !== 'return' || old.path.length || old.cargo !== 5 || current.cargo !== 0) continue;
      assert.equal(old.dropoff, storeId); assert.ok(!old.next && !old.transfer && !old.reclaim && !old.supply);
      assert.equal(s.delivered.wood - before.delivered.wood, 5);
      assert.equal(s.storage.stores[storeId].wood - before.storage.stores[storeId].wood, 5);
      assert.equal(dep(s, 'd4').amount, dep(before, 'd4').amount);
      receipts.push({time: s.time, sourceId: 'd4', sourceRemaining: dep(s, 'd4').amount, storeId, amount: 5});
    }
    assert.equal(receipts.length, count, 'Complete ordinary measured receipts');
    await inspectSource(p, s, 'd4', active === 'narrow-touch'); const displayed = (await rows(p)).map(parseRow);
    const last = receipts.at(-1), previous = receipts.at(-2), intervals = ticks.filter(t => t.start >= previous.time - 1e-8 && t.end <= last.time + 1e-8);
    const sample = displayed.find(v => v.sourceId === 'd4' && v.workerId === 'u0' && v.storeId === storeId
      && v.tools === String(tools) && Math.abs(v.time - last.time) < .051);
    assert.ok(sample, 'Visible sample binds the last new receipt, not an old row');
    assert.equal(sample.currentLayout, true, 'New measurement labels its actual current layout');
    assert.equal(sample.amount, 5); assert.equal(sample.resource, 'wood'); assert.equal(sample.sourceRemaining, last.sourceRemaining);
    close(sample.seconds, last.time - previous.time, 'visible cycle duration', .051);
    for (const part of ['extractSeconds', 'travelSeconds', 'otherSeconds']) close(sample[part], intervals.filter(t => t.part === part).reduce((n, t) => n + t.dt, 0), part, .051);
    close(sample.seconds, sample.extractSeconds + sample.travelSeconds + sample.otherSeconds, 'displayed phase sum', .151);
    assert.ok(intervals.some(t => t.outbound), 'Movement in extraction phase is witnessed');
    const end = await checkpoint(p, label + '-complete', true);
    report.observations.push({scenario: active, label, startCheckpoint: firstCheckpoint.file, endCheckpoint: end.file,
      initialTime: initial.time, finalTime: s.time, receipts, sample, displayed, measuredTicks: ticks.length,
      tickPhases: intervals}); persist(); return {s, sample, raw: end.raw};
  }
  async function inspectOpportunity(p, label, touch = false) {
    const raw = await rawSave(p), selected = await p.locator('[data-unit][aria-pressed="true"]').evaluateAll(ns => ns.map(n => n.dataset.unit));
    const pause = await p.locator('#pause').innerText();
    if (touch) await p.locator('#progress-inspect').tap(); else await p.locator('#progress-inspect').click();
    assert.equal(await rawSave(p), raw); assert.equal(await p.locator('#pause').innerText(), pause);
    assert.deepEqual(await p.locator('[data-unit][aria-pressed="true"]').evaluateAll(ns => ns.map(n => n.dataset.unit)), selected);
    await checkpoint(p, label, true, raw); return raw;
  }
  async function screenshotReachable(p, selector, label) {
    await p.locator(selector).evaluate(el => el.scrollIntoView({block: 'start'})); await flush(p);
    const bounds = await p.locator(selector).boundingBox(), tray = await p.locator('#action-tray').boundingBox();
    assert.ok(bounds && bounds.y >= -.5 && bounds.x >= -.5 && bounds.x + bounds.width <= p.viewportSize().width + .5);
    assert.ok(bounds.y + bounds.height <= Math.min(tray.y, p.viewportSize().height), 'Entire visible target above fixed command tray: ' + selector);
    const visible = await p.locator(selector).evaluate(el => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); });
    assert.ok(visible, 'Actual viewport target is not covered');
    const file = String(++sequence).padStart(3, '0') + '-' + active + '-' + label + '.png';
    await p.screenshot({path: path.join(DIR, file)});
    report.checkpoints.push({scenario: active, label, png: file, pngSHA256: sha(fs.readFileSync(path.join(DIR, file))), selector, bounds, tray});
  }
  async function spaceDisclosure(p, selector) {
    const raw = await rawSave(p), pause = await p.locator('#pause').innerText();
    const before = await p.locator(selector).evaluate(el => el.parentElement.open);
    await p.locator(selector).focus(); await p.keyboard.press('Space'); await flush(p);
    assert.equal(await p.locator(selector).evaluate(el => el.parentElement.open), !before, 'Space activates focused native summary');
    assert.equal(await p.locator('#pause').innerText(), pause, 'Disclosure Space does not pause/resume the camp');
    assert.equal(await rawSave(p), raw, 'Disclosure is view-only');
  }
  async function open(touch = false, readFault = false) {
    const context = await browser.newContext({viewport: touch ? {width: 390, height: 844} : {width: 1440, height: 1100}, hasTouch: touch});
    contexts.push(context); context.setDefaultTimeout(6000);
    await context.addInitScript(() => {
      window.__feedbackInputs = [];
      for (const type of ['pointerdown', 'pointerup', 'click', 'contextmenu', 'keydown', 'keyup', 'change']) document.addEventListener(type, e => {
        window.__feedbackInputs.push({type, trusted: e.isTrusted, target: e.target.closest?.('[data-unit]')?.dataset.unit || e.target.id || e.target.tagName,
          key: e.key || null, pointerType: e.pointerType || null, time: performance.now()});
      }, true);
    });
    if (readFault) await context.addInitScript(key => {
      const original = Storage.prototype.getItem;
      Storage.prototype.getItem = function(name) { if (name === key) throw Error('bounded QA storage-read fault'); return original.call(this, name); };
    }, KEY);
    const p = await context.newPage(); page = p;
    p.on('pageerror', e => report.errors.push({scenario: active, message: e.message}));
    await p.clock.install({time: new Date('2026-01-01T00:00:00Z')});
    await p.goto('http://127.0.0.1:' + server.address().port + '/hearth-rts.html');
    await p.locator('[data-unit="u0"]').waitFor(); if (await p.locator('#pause').innerText() === 'Pause') await p.locator('#pause').click();
    await p.clock.pauseAt(new Date('2026-01-01T01:00:00Z')); return p;
  }
  async function importExact(p, raw, label) {
    await p.locator('#journey').click(); p.once('dialog', dialog => dialog.accept());
    await p.locator('#file').setInputFiles({name: label + '.json', mimeType: 'application/json', buffer: Buffer.from(raw)});
    await p.locator('#dialog').waitFor({state: 'hidden'}); await flush(p);
    return checkpoint(p, label, true, raw);
  }
  try {
    server = http.createServer((req, res) => { if (req.url.split('?')[0] !== '/hearth-rts.html') {res.writeHead(404); return res.end();}
      res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'}); res.end(html); });
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    browser = await playwright.chromium.launch({headless: true, chromiumSandbox: true});
    const p = await open(); let s = (await checkpoint(p, 'fresh', true)).s;
    assert.deepEqual(s.stock, {wood: 20, stone: 10, food: 0}); assert.equal(s.tools, false);
    for (const id of ['d0', 'd2', 'd1']) {
      s = await gather(p, s, ALL, id);
      s = await until(p, s, v => dep(v, id).amount === 0 && v.units.every(u => !u.cargo && u.phase === 'idle'), 'earn all western ' + id);
    }
    assert.deepEqual(s.stock, {wood: 116, stone: 70, food: 0}); await checkpoint(p, 'earned-west', true);
    for (const [x, y] of [[25, 13], [6, 16]]) {
      await select(p, ALL); await p.locator('#move').click(); await clickMap(p, x + .5, y + .5);
      s = await until(p, await saved(p), v => v.units.every(u => u.phase === 'idle' && !u.cargo), 'scout ' + x);
    }
    s = await gather(p, s, ['u0'], 'd4'); const long = await measure(p, s, 'long-haul-before-outpost', 'b0', false); s = await stop(p, long.s, ['u0']);
    const outpost = await place(p, s, 'outpost', 22, 11); s = outpost.s;
    const workshop = await place(p, s, 'workshop', 26, 13); s = workshop.s;
    assert.equal(s.complete, true); assert.match(await p.locator('#opening-count').innerText(), /3\s*\/\s*3/);
    await spaceDisclosure(p, '#opening-checklist>summary'); await spaceDisclosure(p, '#opening-checklist>summary');
    assert.ok(s.stock.wood >= 4 && s.stock.stone >= 8); assert.deepEqual(s.storage.stores[outpost.id], {wood: 0, stone: 0, food: 0});
    await inspectOpportunity(p, 'workshop-continuation');
    assert.match(await p.locator('#craft-funding').innerText(), /Outpost 1 store/);
    assert.match(await p.locator('#craft-funding').innerText(), /4 wood.*8 stone/);
    const unfunded = await rawSave(p); await p.locator('#craft-knapping').click();
    await checkpoint(p, 'local-shortage-no-payment', true, unfunded);
    // Inspection with no selected workers still preserves the native saved state.
    await select(p, ['u0']); await p.locator('[data-unit="u0"]').click({modifiers: ['Shift']});
    assert.equal(await p.locator('[data-unit][aria-pressed="true"]').count(), 0);
    await inspectOpportunity(p, 'no-selection-inspection'); await p.locator('#craft-knapping').click();
    assert.equal(await rawSave(p), unfunded); assert.equal((await saved(p)).knapping, null);
    s = await gather(p, await saved(p), ['u0'], 'd4'); const short = await measure(p, s, 'near-store-before-tools', outpost.id, false); s = await stop(p, short.s, ['u0']);
    assert.ok(short.sample.travelSeconds < long.sample.travelSeconds);
    assert.equal(short.sample.sourceId, long.sample.sourceId); assert.equal(short.sample.workerId, long.sample.workerId);
    await inspectOpportunity(p, 'remaining-local-stone-shortage');
    assert.match(await p.locator('#craft-funding').innerText(), /Outpost 1 store/);
    assert.match(await p.locator('#craft-funding').innerText(), /8 stone/);
    assert.ok(s.stock.stone >= 8 && s.storage.stores[outpost.id].stone === 0);
    s = await gather(p, s, ['u1', 'u2'], 'd6');
    s = await until(p, s, v => v.storage.stores[outpost.id].stone >= 10, 'earn actual local tool stone');
    s = await stop(p, s, ['u1', 'u2']); await select(p, ALL); await p.locator('#gather').click();
    const beforeInspect = await inspectOpportunity(p, 'funded-inspection-cancels-arming');
    assert.equal(await p.locator('#gather').getAttribute('aria-pressed'), 'false');
    assert.equal(beforeInspect, await rawSave(p)); assert.equal(await p.locator('#craft-knapping').innerText(), 'Reserve materials & assign');
    const paidBefore = await saved(p); await p.locator('#craft-knapping').click(); s = await saved(p);
    assert.deepEqual(s.spent, {...paidBefore.spent, wood: paidBefore.spent.wood + 4, stone: paidBefore.spent.stone + 8});
    assert.deepEqual(s.storage.stores[outpost.id], {...paidBefore.storage.stores[outpost.id], wood: paidBefore.storage.stores[outpost.id].wood - 4, stone: paidBefore.storage.stores[outpost.id].stone - 8});
    assert.equal(s.knapping.workshop, workshop.id); const paid = copy(s.spent);
    s = await until(p, s, v => v.knapping.work > 0 && !v.tools, 'partial paid tool work', 80);
    s = await stop(p, s); await inspectOpportunity(p, 'paid-interrupted-progress');
    assert.match(await p.locator('#progress-detail').innerText(), /already paid|reserved/i);
    assert.equal(await p.locator('#craft-knapping').innerText(), 'Assign selected villagers');
    await p.locator('#craft-knapping').click(); assert.deepEqual((await saved(p)).spent, paid);
    s = await until(p, await saved(p), v => v.tools, 'complete paid tools'); assert.equal(s.knapping.work, 12);
    assert.deepEqual(s.spent, paid); await checkpoint(p, 'tools-complete-before-new-receipt', true);
    assert.match(await p.locator('#progress-title').innerText(), /put.*tools|tools.*work/i);
    assert.doesNotMatch(await p.locator('#progress-detail').innerText(), /delivered.*observed this visit/i);
    s = await gather(p, s, ['u0'], 'd4'); const tools = await measure(p, s, 'near-store-after-tools', outpost.id, true, 3); s = tools.s;
    assert.ok(tools.sample.extractSeconds < short.sample.extractSeconds);
    const beforeRow = (await rows(p)).find(v => v.sourceId === 'd4' && v.storeId === outpost.id && v.workerId === 'u0' && v.tools === 'false');
    assert.ok(beforeRow, 'Pre-tools same-route historical observation remains available');
    assert.equal(parseRow(beforeRow).currentLayout, true);
    const oldRoute = (await rows(p)).find(v => v.storeId === 'b0');
    assert.ok(oldRoute); assert.equal(parseRow(oldRoute).currentLayout, false, 'Earlier receiver route remains labelled historical');
    await spaceDisclosure(p, '#trip-history>summary'); await spaceDisclosure(p, '#trip-history>summary');
    assert.match(await p.locator('#progress-detail').innerText(), /delivered 5 wood.*Outpost 1 store.*observed this visit/i);
    const exact = await checkpoint(p, 'paid-tools-and-useful-receipts', true);
    const history = await rows(p); await p.clock.runFor(5000);
    assert.equal(await rawSave(p), exact.raw); assert.deepEqual(await rows(p), history, 'Paused wall time creates no measurement');
    assert.equal(await p.locator('#toast').isVisible(), false, 'Historical toast expires');
    await p.reload(); await p.locator('#progress-title').waitFor(); await flush(p);
    await checkpoint(p, 'paused-exact-refresh', true, exact.raw);
    await inspectSource(p, exact.s); assert.deepEqual(await rows(p), []);
    assert.match(await p.locator('#trip-status').innerText(), /No complete cycle observed this visit/);
    assert.doesNotMatch(await p.locator('#progress-detail').innerText(), /delivered.*observed this visit/i);
    await importExact(p, exact.raw, 'exact-native-reimport'); await inspectSource(p, exact.s); assert.deepEqual(await rows(p), []);
    await inputs(p); await p.context().close();
    active = 'narrow-touch'; const q = await open(true); await importExact(q, exact.raw, 'earned-tools-import');
    await screenshotReachable(q, '.mission', 'current-opportunity-visible');
    await inspectOpportunity(q, 'touch-opportunity-inspection', true);
    assert.equal(await q.locator('#trip-feedback [data-trip]').count(), 0);
    await screenshotReachable(q, '#trip-status', 'no-invented-history-visible');
    const touch = await measure(q, exact.s, 'touch-new-visit-cycle', outpost.id, true);
    await screenshotReachable(q, '#trip-feedback [data-trip]', 'actual-cycle-visible-above-tray');
    await checkpoint(q, 'touch-final-earned-camp', true);
    assert.ok(touch.sample.time > tools.sample.time); await inputs(q);
    for (const target of ['world', 'pause', 'gather', 'progress-inspect', 'craft-knapping', 'export'])
      assert.ok(Object.keys(report.inputCounts).some(k => k.endsWith(':click:' + target + ':true')), 'Trusted click evidence: ' + target);
    assert.ok(journal.some(row => row.kind === 'input' && row.scenario === 'narrow-touch'
      && row.rows.some(e => e.pointerType === 'touch' && e.trusted && e.target === 'progress-inspect')));
    // Isolated fresh context, no camp injection: an unreadable save must remain
    // visibly blocked after the ordinary transient-message interval has elapsed.
    active = 'narrow-storage-read-fault'; const blocked = await open(true, true);
    assert.equal(await blocked.locator('#pause').innerText(), 'Resume');
    assert.match(await blocked.locator('#camp-warning').innerText(), /could not be read/i);
    await blocked.clock.runFor(7000); assert.equal(await blocked.locator('#camp-warning').isVisible(), true);
    await screenshotReachable(blocked, '#camp-warning', 'unreadable-save-warning-survives-toast-timeout');
    await blocked.locator('#journey').tap(); assert.match(await blocked.locator('#save-status').innerText(), /could not be read|unavailable/i);
    assert.equal(await blocked.locator('#export').isDisabled(), true); await inputs(blocked);
    assert.deepEqual(report.errors, []); report.status = 'passed';
  } catch (error) {
    report.status = 'failed'; report.failure = {message: String(error), stack: error.stack}; process.exitCode = 1;
    if (page && !page.isClosed()) {
      await page.screenshot({path: path.join(DIR, 'failure.png'), fullPage: true}).catch(() => {});
      report.failure.body = await page.locator('body').innerText().catch(() => null);
      report.failure.raw = await rawSave(page).catch(() => null); await inputs(page).catch(() => {});
    }
  } finally {
    for (const c of contexts) await c.close().catch(() => {});
    if (browser) await browser.close(); if (server) await new Promise(resolve => server.close(resolve));
    const compressed = zlib.gzipSync(journal.map(row => JSON.stringify(row)).join('\n') + '\n');
    fs.writeFileSync(path.join(DIR, 'observations.jsonl.gz'), compressed);
    report.journal = {file: 'observations.jsonl.gz', sha256: sha(compressed), records: journal.length};
    report.wallSeconds = (Date.now() - start) / 1000; persist();
  }
  if (report.status === 'passed') console.log('PASS actual-control Tools continuation, named local funding, same-source route observations, paid interruption, exact refresh/import and bounded touch feedback');
})().catch(error => {console.error(error); process.exitCode = 1;});
