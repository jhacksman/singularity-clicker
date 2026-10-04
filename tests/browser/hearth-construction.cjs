/* Spark-only physical-construction browser acceptance. Source authoring on M6 only.
 * Run against the coordinator's immutable built candidate. No engine import, hidden
 * Camp, grants, source patch or main-journey storage injection. Every main action is
 * a trusted UI input. Pause's synchronous save is sampled between controlled ticks;
 * every material boundary is cross-checked with an ordinary Journey download.
 * Replays use the exact ordinary earned Journey file through the import control.
 * Clock-controlled results establish mechanics, never human pacing or enjoyment.
 */
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const crypto = require('node:crypto'), http = require('node:http'), {once} = require('node:events');
const playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const ROOT = path.resolve(__dirname, '../..'), DIR = path.join(ROOT, 'artifacts/hearth-construction');
const KEY = 'singularity-clicker.hearth-rts.v1', PROFILE = 'accepted-opening.physical-construction.v1';
const RES = ['wood', 'stone', 'food'], TOTAL = {wood: 416, stone: 220, food: 225};
const COST = {outpost: {wood: 60, stone: 20, food: 0}, workshop: {wood: 40, stone: 30, food: 0}};
const WORK = {outpost: 24, workshop: 32}, sha = value => crypto.createHash('sha256').update(value).digest('hex');
const SAMPLE_MS = 80;
const LEGACY_BASE = '4c3ac2f6c16ce58563f0300f286040a7aae0a963';
const LEGACY_HASHES = {
  'src/hearth-rts/engine.js': '416b35153c781eb56a045848afaa6bb92daa0c93447b18a4e51f2d9a580f58d5',
  'src/hearth-rts/view.js': '2a6495938d9a10d305da0b53e39896bf0951d1d51edc44a17c6a96bea09c4e67',
  'src/hearth-rts/shell.html': '124046ab8f67f79b72eecb7a771e61dae8416e396449b79e84e8e6d751250ebd',
  'src/hearth-rts/styles.css': '3054d93950fbf881a06ebbd0f15235286479628da74137df3bce7a279b94d535',
  'build.mjs': 'cc3a45bc20f08dff82c01aceadefe3e4b7c2c5ea924aaba5da3561c05b119d47'
};
const vector = fn => Object.fromEntries(RES.map(r => [r, fn(r)])), zero = () => vector(() => 0);
const clone = value => JSON.parse(JSON.stringify(value));
const site = (s, id) => s.construction.sites.find(c => c.buildingId === id);
const building = (s, id) => s.buildings.find(b => b.id === id), actor = (s, id) => s.units.find(u => u.id === id);
const reserved = (s, r) => s.construction.sites.reduce((n, c) => n + c.sources.filter(p => p.resource === r).reduce((m, p) => m + p.amount, 0), 0)
  + s.storage.transfers.filter(j => j.resource === r).reduce((n, j) => n + j.remaining, 0);
const staged = (s, r) => s.construction.sites.reduce((n, c) => n + c.staged[r], 0);
const cargo = (s, r, id) => s.units.filter(u => u.resource === r && (id === undefined || u.supply?.siteId === id)).reduce((n, u) => n + u.cargo, 0);
function matter(s) {
  assert.equal(s.version, 6); assert.equal(s.construction.profile, PROFILE);
  assert.deepEqual(vector(r => s.deposits.filter(d => d.kind === r).reduce((n, d) => n + d.amount, 0)
    + Object.values(s.storage.stores).reduce((n, store) => n + store[r], 0) + cargo(s, r) + staged(s, r) + s.spent[r]), TOTAL,
    'Fixed inventory includes wild, actual stores, all cargo, onsite WIP and spent');
  assert.deepEqual(s.stock, vector(r => Object.values(s.storage.stores).reduce((n, store) => n + store[r], 0)));
  for (const c of s.construction.sites) {
    const b = building(s, c.buildingId); assert.ok(b && !b.done);
    assert.deepEqual(vector(r => c.sources.filter(p => p.resource === r).reduce((n, p) => n + p.amount, 0)
      + c.staged[r] + cargo(s, r, b.id) + c.released[r] + c.returned[r]), COST[b.kind]);
    assert.deepEqual(vector(r => c.origins.filter(p => p.resource === r).reduce((n, p) => n + p.amount, 0)), c.staged);
    if (c.state === 'active') { assert.deepEqual(c.released, zero()); assert.deepEqual(c.returned, zero()); }
    else assert.deepEqual(c.sources, []);
    if (b.work > 0 && c.state === 'active') assert.deepEqual(c.staged, COST[b.kind], 'All delivery precedes installation');
  }
  for (const u of s.units) {
    assert.ok(Number.isInteger(u.cargo) && u.cargo >= 0 && u.cargo <= 5);
    if (u.supply) assert.ok(!u.reclaim && !u.transfer && u.cargo, 'One cargo authority per carrier');
  }
  for (const r of RES) assert.ok(s.stock[r] >= reserved(s, r), 'Source reservations are backed by actual stored goods');
}
function atEdge(u, b) {
  const n = b.kind === 'hearth' ? 3 : ['outpost', 'workshop'].includes(b.kind) ? 2 : 1, near = (a, v) => Math.abs(a - v) < .00001;
  for (let i = 0; i < n; i++) if (near(u.x, b.x - 1) && near(u.y, b.y + i)
    || near(u.x, b.x + n) && near(u.y, b.y + i) || near(u.y, b.y - 1) && near(u.x, b.x + i)
    || near(u.y, b.y + n) && near(u.x, b.x + i)) return true;
  return false;
}
fs.mkdirSync(DIR, {recursive: true});
(async () => {
  const started = Date.now(), deadline = started + 875000, manifest = {source: {}, build: {}};
  for (const file of ['src/hearth-rts/engine.js', 'src/hearth-rts/view.js', 'src/hearth-rts/shell.html',
    'src/hearth-rts/styles.css', 'build.mjs', 'tests/browser/hearth-construction.cjs']) manifest.source[file] = sha(fs.readFileSync(path.join(ROOT, file)));
  const html = fs.readFileSync(path.join(ROOT, 'dist/hearth-rts.html'), 'utf8');
  manifest.build['dist/hearth-rts.html'] = sha(html);
  for (const file of ['src/hearth-rts/engine.js', 'src/hearth-rts/view.js']) assert.ok(html.includes(fs.readFileSync(path.join(ROOT, file), 'utf8')), 'Built page must contain exact candidate source: ' + file);
  const binding = sha(JSON.stringify(manifest));
  const report = {status: 'running', manifest, binding, bounds: {wallSeconds: 875, requestedSampleMilliseconds: SAMPLE_MS, maximumMaterialSampleSeconds: .100001},
    method: 'Trusted ordinary UI, fresh earned main journey, exact Journey imports for labeled comparisons, controlled browser clock',
    scenarios: [], checkpoints: [], transitions: [], workProgress: [], toolWorkProgress: [], installationStatusTransitions: [], installationStatusWitness: null, events: [], legacyUnfinished: {status: 'pending',
      reason: 'Supply LEGACY_CONSTRUCTION_WITNESS, LEGACY_CONSTRUCTION_WITNESS_REPORT and OLD_BASE_DIR from a separate ordinary pinned-v5 Spark run'}, limits: [
      'No human pacing, enjoyment, physical device or full-campaign acceptance claim',
      'Detailed current/legacy fault fixtures live in bootstrap, recovery and navigation browser suites',
      'No historical v5 unfinished job is claimed without a separate pinned ordinary v5 witness'], errors: []};
  const write = (name, value) => fs.writeFileSync(path.join(DIR, name), JSON.stringify(value, null, 2) + '\n');
  const persist = () => write('report.json', report), guard = () => assert.ok(Date.now() < deadline, '875-second bounded browser job exceeded');
  let browser, active, server, sequence = 0, pendingStatusWitness = null;
  const contexts = [];
  async function events(p) { report.events.push(...(await p.evaluate(() => window.__constructionInputs.splice(0))).map(e => ({binding, scenario: active.label, ...e}))); }
  async function exported(p, label = 'sample') {
    guard(); if (!await p.locator('#dialog').evaluate(d => d.open)) await p.locator('#journey').click();
    const waiting = p.waitForEvent('download'); await p.locator('#export').click();
    const download = await waiting, filename = String(++sequence).padStart(5, '0') + '-' + active.label + '-' + label + '.json';
    await download.saveAs(path.join(DIR, filename)); const raw = fs.readFileSync(path.join(DIR, filename), 'utf8'); await download.delete();
    await p.locator('#close').click(); const s = JSON.parse(raw); matter(s);
    report.checkpoints.push({binding, scenario: active.label, label, file: filename, sha256: sha(raw), bytes: Buffer.byteLength(raw), time: s.time,
      inventory: {stock: s.stock, free: vector(r => s.stock[r] - reserved(s, r)), reserved: vector(r => reserved(s, r)), staged: vector(r => staged(s, r)), spent: s.spent, cargo: vector(r => cargo(s, r))}}); return {raw, s, file: filename};
  }
  async function capture(p, label, expected, cropSite) {
    if (cropSite) { assert.equal(await p.locator('#pause').innerText(), 'Resume'); await p.clock.runFor(1000); }
    const data = await exported(p, label); if (expected) assert.deepEqual(data.s, expected, 'Journey download matches synchronous Pause checkpoint');
    const image = data.file.replace(/\.json$/, '.png'); await p.screenshot({path: path.join(DIR, image), fullPage: true});
    report.checkpoints.at(-1).screenshot = {file: image, sha256: sha(fs.readFileSync(path.join(DIR, image)))};
    if (cropSite) {
      await p.locator('#world').scrollIntoViewIfNeeded();
      const clip = await p.locator('#world').evaluate((c, b) => {
        const r = c.getBoundingClientRect(), scale = Number(c.dataset.cameraScale || 1), x = Number(c.dataset.cameraX || 0), y = Number(c.dataset.cameraY || 0);
        return {x: r.x + (((b.x - .5) * 32 * scale + x) / c.width) * r.width,
          y: r.y + (((b.y - 1) * 32 * scale + y) / c.height) * r.height,
          width: 96 * scale / c.width * r.width, height: 128 * scale / c.height * r.height};
      }, cropSite);
      const name = data.file.replace(/\.json$/, '-site.png'); await p.screenshot({path: path.join(DIR, name), clip});
      data.siteImage = {file: name, sha256: sha(fs.readFileSync(path.join(DIR, name)))}; report.checkpoints.at(-1).siteImage = data.siteImage;
    }
    await events(p); persist(); return data;
  }
  const saved = p => p.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
  async function tick(p, milliseconds = SAMPLE_MS) {
    guard(); assert.equal(await p.locator('#pause').innerText(), 'Resume');
    await p.locator('#pause').click(); await p.clock.runFor(milliseconds); await p.locator('#pause').click();
    const s = await saved(p); matter(s); return s;
  }
  async function until(p, predicate, label, seconds = 400, step = 1000) {
    let s = (await exported(p, 'before-' + label)).s;
    for (let i = 0; !predicate(s) && i < seconds * 1000 / step; i++) s = await tick(p, step);
    assert.ok(predicate(s), 'Ordinary-control timeout: ' + label); return s;
  }
  async function clickMap(p, x, y, button = 'left') {
    await p.locator('#world').scrollIntoViewIfNeeded(); const box = await p.locator('#world').boundingBox();
    const t = await p.locator('#world').evaluate(c => ({width: c.width, height: c.height,
      x: Number(c.dataset.cameraX || 0), y: Number(c.dataset.cameraY || 0), scale: Number(c.dataset.cameraScale || 1)}));
    const q = {x: box.x + (x * 32 * t.scale + t.x) / t.width * box.width, y: box.y + (y * 32 * t.scale + t.y) / t.height * box.height};
    assert.equal(await p.evaluate(q => document.elementFromPoint(q.x, q.y)?.id, q), 'world'); await p.mouse.click(q.x, q.y, {button});
  }
  async function select(p, ids) { for (let i = 0; i < ids.length; i++) await p.locator('[data-unit="' + ids[i] + '"]').click({modifiers: i ? ['Shift'] : []}); }
  const selectedIds = p => p.locator('.unit-card[aria-pressed="true"]').evaluateAll(nodes => nodes.map(n => n.dataset.unit));
  async function restoreSelection(p, ids) {
    if (ids.length) await select(p, ids);
    else for (const id of await selectedIds(p)) await p.locator('[data-unit="' + id + '"]').click({modifiers: ['Shift']});
  }
  const all = p => p.locator('#select-all').click();
  async function move(p, x, y) { await p.locator('#move').click(); await clickMap(p, x + .5, y + .5); }
  async function moveAll(p, x, y) { await all(p); await move(p, x, y); return until(p, s => s.units.every(u => !u.cargo && u.phase === 'idle'), 'move-all'); }
  async function inspect(p, b) { await clickMap(p, b.x + 1.1, b.y + 1.1); }
  async function supplyText(p, s, b) {
    const c = site(s, b.id), sourceReserved = vector(r => c.sources.filter(row => row.resource === r).reduce((n, row) => n + row.amount, 0));
    const carried = vector(r => cargo(s, r, b.id)), goods = values => RES.filter(r => values[r] > 0).map(r => values[r] + ' ' + r).join(' · ') || 'none';
    const detail = await p.locator('#site-supply').innerText();
    for (const text of ['Source-reserved: ' + goods(sourceReserved), 'En route: ' + goods(carried), 'Onsite: ' + goods(c.staged),
      'Build work: ' + b.work.toFixed(1) + ' / ' + WORK[b.kind] + ' worker-seconds.']) assert.ok(detail.includes(text), 'Inspector reflects exported counters: ' + text);
    for (const row of c.sources) assert.ok(detail.includes(row.amount + ' ' + row.resource + ' at ' + (building(s, row.storeId).kind === 'hearth' ? 'Hearth store' : 'Outpost ' + row.storeId.slice(1) + ' store')), 'Inspector names the actual source and reserved quantity');
    if (!c.sources.length) assert.ok(detail.includes('Sources: none.'));
    const next = c.state === 'cancelling' ? 'Return carried goods and recover onsite supplies.' : RES.some(r => sourceReserved[r]) ? 'Fetch reserved supplies.' : RES.some(r => carried[r]) ? 'Wait for deliveries.' : 'Install the delivered materials.';
    assert.ok(detail.includes('Next: ' + next));
    const selected = await p.locator('.unit-card[aria-pressed="true"]').evaluateAll(nodes => nodes.map(n => n.dataset.unit));
    const selectedText = detail.split('Selected: ')[1]; assert.ok(selectedText);
    for (const id of selected) { const u = actor(s, id); assert.ok(selectedText.includes(u.name + ' — ')); if (u.cargo) assert.ok(selectedText.includes(u.cargo + ' ' + u.resource)); else assert.ok(selectedText.includes(u.reason)); }
    if (!selected.length) assert.ok(selectedText.startsWith('none'));
    if (c.state === 'cancelling') { assert.ok(detail.includes('Released: ' + goods(c.released))); assert.ok(detail.includes('returned: ' + goods(c.returned))); }
    return detail;
  }
  async function assign(p, b, ids) { await select(p, ids); await clickMap(p, b.x + 1.1, b.y + 1.1, 'right'); }
  function waitingInstallers(s, id) {
    const b = building(s, id), c = site(s, id);
    return !b || b.done || c?.state !== 'active' ? [] : s.units.filter(u => u.order.kind === 'build' && u.order.target === id
      && !u.next && u.phase === 'construct' && !u.cargo && !u.path.length && atEdge(u, b) && u.reason === 'Waiting for site supplies');
  }
  function readySiteDeliveries(s, id) {
    const b = building(s, id);
    return s.units.filter(u => u.supply?.siteId === id && u.phase === 'supplyDeliver' && !u.path.length && atEdge(u, b));
  }
  async function installationStatusDOM(p, s, b, workers, expected) {
    await select(p, workers.map(u => u.id)); await inspect(p, b);
    const detail = await supplyText(p, s, b), selected = detail.split('Selected: ')[1];
    for (const u of workers) {
      const card = p.locator('[data-unit="' + u.id + '"]');
      assert.equal(await card.locator('small').innerText(), expected, 'The same worker card reports its actual installation state');
      assert.equal(await card.getAttribute('title'), expected, 'The same empty worker tooltip reports its actual installation state');
      assert.ok(selected.includes(u.name + ' — ' + expected), 'The selected-site text names the same worker and installation state');
    }
  }
  async function captureWaitingInstallation(p, s, id) {
    if (report.installationStatusWitness) return;
    const b = building(s, id), c = site(s, id), waiters = waitingInstallers(s, id);
    if (!waiters.length) return;
    const deliveries = readySiteDeliveries(s, id);
    if (!RES.every(r => c.staged[r] + deliveries.filter(u => u.resource === r).reduce((n, u) => n + u.cargo, 0) === COST[b.kind][r])) return;
    if (pendingStatusWitness?.scenario === active.label && pendingStatusWitness.site === id && pendingStatusWitness.time === s.time) return;
    const selected = await selectedIds(p), u = waiters[0];
    await installationStatusDOM(p, s, b, [u], 'Waiting for site supplies');
    const checkpoint = await capture(p, 'waiting-before-installation', s);
    pendingStatusWitness = {scenario: active.label, site: id, actor: u.id, time: s.time, checkpoint: checkpoint.file};
    await restoreSelection(p, selected); await inspect(p, b);
  }
  async function reload(p, label) {
    const before = await exported(p, label + '-before'); await events(p); await p.reload(); await p.locator('[data-unit="u0"]').waitFor();
    assert.equal(await p.locator('#pause').innerText(), 'Resume'); await p.clock.runFor(700);
    assert.equal((await exported(p, label + '-after')).raw, before.raw, 'Paused reload preserves exact physical custody and work');
  }
  async function open(label, raw) {
    const context = await browser.newContext({viewport: {width: 1440, height: 1100}}); contexts.push(context);
    context.setDefaultTimeout(5000);
    await context.addInitScript(() => { window.__constructionInputs = []; for (const type of ['pointerdown', 'pointerup', 'click', 'contextmenu', 'keydown', 'keyup', 'change']) document.addEventListener(type, e => window.__constructionInputs.push({type, target: e.target.closest?.('[data-unit]')?.dataset.unit || e.target.id || e.target.tagName, key: e.key || null, button: e.button, trusted: e.isTrusted}), true); });
    const p = await context.newPage(); active = {label, page: p}; p.on('pageerror', e => report.errors.push({scenario: label, error: e.message}));
    await p.clock.install({time: new Date('2026-01-01T00:00:00Z')}); await p.goto('http://127.0.0.1:' + server.address().port + '/hearth-rts.html');
    await p.locator('[data-unit="u0"]').waitFor(); if (await p.locator('#pause').innerText() === 'Pause') await p.locator('#pause').click();
    await p.clock.pauseAt(new Date('2026-01-01T01:00:00Z'));
    if (raw) {
      await p.locator('#journey').click(); p.once('dialog', d => d.accept());
      await p.locator('#file').setInputFiles({name: 'ordinary-earned-start.json', mimeType: 'application/json', buffer: Buffer.from(raw)});
      await p.locator('#dialog').waitFor({state: 'hidden'}); assert.equal((await exported(p, 'imported-earned-start')).raw, raw);
    }
    report.scenarios.push({label, binding, provenance: raw ? 'Exact ordinary earned Journey checkpoint replayed through native import; no authored state' : 'Fresh storage, ordinary UI only', inputSHA256: raw ? sha(raw) : null}); return p;
  }
  async function place(p, kind, x, y, ids, label) {
    await select(p, ids); const before = (await exported(p, label + '-before')).s;
    await p.locator('[data-build="' + kind + '"]').click(); await clickMap(p, x + .5, y + .5);
    if (await p.locator('#placement-confirm').isVisible()) await p.locator('#placement-confirm').click();
    const after = (await exported(p, label + '-reserved')).s, added = after.buildings.filter(b => !before.buildings.some(old => old.id === b.id));
    assert.equal(added.length, 1); const b = added[0], c = site(after, b.id); assert.ok(c);
    assert.equal(b.work, 0); assert.equal(b.done, false); assert.deepEqual(c.staged, zero());
    assert.deepEqual(before.stock, after.stock, 'Reservation keeps material at the actual source'); assert.deepEqual(before.spent, after.spent);
    assert.deepEqual(vector(r => c.sources.filter(p => p.resource === r).reduce((n, p) => n + p.amount, 0)), COST[kind]);
    for (const p of c.sources) assert.ok(after.storage.stores[p.storeId][p.resource] >= p.amount);
    await inspect(p, b); await supplyText(p, after, b);
    assert.equal(await p.locator('#site-cancel').innerText(), 'Cancel and recover supplies');
    return {b, before, after};
  }
  async function materialStep(p, before, after, id, label) {
    const delta = after.time - before.time; assert.ok(delta >= 0 && delta <= .100001, 'No unobserved physical material transition');
    const prior = site(before, id), next = site(after, id), b = building(before, id);
    const afterBuilding = building(after, id);
    if (afterBuilding) {
      const assigned = before.units.filter(u => u.order.kind === 'build' && u.order.target === id && !u.next).length;
      assert.ok(afterBuilding.work >= b.work && afterBuilding.work - b.work <= assigned * delta + .00001, 'Installation cannot exceed actual assigned worker-seconds');
      if (prior.state === 'cancelling') assert.equal(afterBuilding.work, b.work, 'Cancellation stops installation work');
      const eligible = before.units.filter(u => u.order.kind === 'build' && u.order.target === id && u.phase === 'construct' && !u.cargo && !u.next && u.path.length === 0 && atEdge(u, b)).length;
      const fullyStaged = RES.every(r => prior.staged[r] === COST[b.kind][r]);
      if (prior.state === 'active' && fullyStaged) assert.ok(Math.abs(afterBuilding.work - b.work - Math.min(WORK[b.kind] - b.work, eligible * delta)) < .00001,
        'Funded installation equals independently counted adjacent worker-seconds, including final cap');
      if (afterBuilding.work !== b.work) report.workProgress.push({binding, scenario: active.label, site: id, time: after.time,
        before: b.work, after: afterBuilding.work, deltaSeconds: delta, assigned, eligible, fullyStaged, stagedBefore: prior.staged});
    }
    assert.deepEqual(after.delivered, before.delivered, 'Supplying construction is not gathering');
    assert.deepEqual(after.storage.transferred, before.storage.transferred, 'Supplying construction is not transfer output');
    const changes = [];
    for (const u of after.units) {
      const old = actor(before, u.id); assert.ok(Math.hypot(u.x - old.x, u.y - old.y) <= 3 * delta + .00001, 'Carrier follows accepted 3 cells/second movement');
      if (!old.supply && u.supply?.siteId === id) {
        const origin = u.supply.origin; assert.equal(old.cargo, 0); assert.ok(u.cargo > 0 && u.cargo <= 5);
        if (origin) {
          const source = building(before, origin.storeId); assert.ok(source?.done && !source.retiring); assert.ok(atEdge(old, source) && atEdge(u, source));
          assert.deepEqual(origin, {storeId: source.id, kind: source.kind, x: source.x, y: source.y, resource: u.resource, amount: u.cargo});
          changes.push({kind: 'source-pickup', actor: u.id, source: origin, resource: u.resource, amount: u.cargo});
        } else { assert.equal(prior.state, 'cancelling'); assert.ok(atEdge(u, b)); changes.push({kind: 'recovery-pickup', actor: u.id, resource: u.resource, amount: u.cargo}); }
      }
      if (old.supply?.siteId === id && !u.supply) {
        assert.equal(u.cargo, 0); assert.deepEqual({x: u.x, y: u.y}, {x: old.x, y: old.y});
        if (old.phase === 'supplyDeliver') { assert.ok(atEdge(old, b)); changes.push({kind: 'site-receipt', actor: u.id, resource: old.resource, amount: old.cargo, source: old.supply.origin}); }
        else { const store = building(after, old.dropoff); assert.ok(store?.done && !store.retiring && atEdge(u, store)); changes.push({kind: 'store-return', actor: u.id, resource: old.resource, amount: old.cargo, destination: store.id}); }
      }
    }
    for (const r of RES) {
      const picked = changes.filter(c => c.kind === 'source-pickup' && c.resource === r).reduce((n, c) => n + c.amount, 0);
      const returned = changes.filter(c => c.kind === 'store-return' && c.resource === r).reduce((n, c) => n + c.amount, 0);
      assert.equal(after.stock[r] - before.stock[r], returned - picked, 'Actual stock changes only at source pickup or physical return');
      if (next) {
        const receipts = changes.filter(c => c.kind === 'site-receipt' && c.resource === r).reduce((n, c) => n + c.amount, 0);
        const recovered = changes.filter(c => c.kind === 'recovery-pickup' && c.resource === r).reduce((n, c) => n + c.amount, 0);
        assert.equal(next.staged[r] - prior.staged[r], receipts - recovered);
        assert.equal(after.spent[r], before.spent[r], 'Unfinished supply and recovery are not spent');
      } else if (building(after, id)?.done) assert.equal(after.spent[r] - before.spent[r], COST[b.kind][r]);
      else assert.equal(after.spent[r], before.spent[r]);
    }
    const expectedStores = clone(before.storage.stores);
    for (const c of changes) {
      if (c.kind === 'source-pickup') expectedStores[c.source.storeId][c.resource] -= c.amount;
      if (c.kind === 'store-return') expectedStores[c.destination][c.resource] += c.amount;
    }
    if (!next && building(after, id)?.done && b.kind === 'outpost') expectedStores[id] = zero();
    assert.deepEqual(after.storage.stores, expectedStores, 'Each load changes only its named actual source or return store');
    if (delta > 0 && prior.state === 'active' && next?.state === 'active' && afterBuilding && !afterBuilding.done && afterBuilding.work > b.work) {
      const deliveries = readySiteDeliveries(before, id);
      // Match the engine's sorted actor turns without trusting its reason string:
      // an earlier final receipt may fund a later waiting worker in the same tick.
      const installers = waitingInstallers(before, id).filter(u => RES.every(r => prior.staged[r]
        + deliveries.filter(carrier => carrier.id.localeCompare(u.id) < 0 && carrier.resource === r).reduce((n, carrier) => n + carrier.cargo, 0) === COST[b.kind][r]));
      if (installers.length) {
        const expected = 'Installing ' + b.kind, selected = await selectedIds(p);
        for (const old of installers) {
          const u = actor(after, old.id); assert.equal(u.order.kind, 'build'); assert.equal(u.order.target, id);
          assert.equal(u.phase, 'construct'); assert.equal(u.cargo, 0); assert.equal(u.path.length, 0); assert.equal(u.next, null);
          assert.equal(u.reason, expected, 'G01: an earlier waiting worker reports the installation work it actually performs');
        }
        await installationStatusDOM(p, after, afterBuilding, installers.map(u => actor(after, u.id)), expected);
        report.installationStatusTransitions.push({binding, scenario: active.label, site: id, actors: installers.map(u => u.id),
          beforeTime: before.time, afterTime: after.time, beforeWork: b.work, afterWork: afterBuilding.work, expected});
        if (!report.installationStatusWitness && pendingStatusWitness?.scenario === active.label && pendingStatusWitness.site === id
          && installers.some(u => u.id === pendingStatusWitness.actor)) {
          assert.equal(pendingStatusWitness.time, before.time, 'The PNG/Journey pair straddles this exact same-worker installation transition');
          const checkpoint = await capture(p, 'previous-waiter-now-installing', after);
          report.installationStatusWitness = {...pendingStatusWitness, binding, before: pendingStatusWitness.checkpoint, after: checkpoint.file,
            afterTime: after.time, beforeWork: b.work, afterWork: afterBuilding.work, expected,
            ui: ['worker card small', 'worker card title', 'site Selected text'], source: 'Same empty waiting worker; not the final carrier'};
        }
        await restoreSelection(p, selected); await inspect(p, afterBuilding);
      }
    }
    if (changes.length) {
      if (next) { await inspect(p, afterBuilding); await supplyText(p, after, afterBuilding); }
      const checkpoint = await capture(p, label + '-boundary', after);
      for (const change of changes) report.transitions.push({binding, scenario: active.label, site: id, time: after.time, checkpoint: checkpoint.file, ...change});
    }
    return changes;
  }
  async function physicalUntil(p, id, predicate, label, seconds = 450) {
    let s = (await exported(p, label + '-start')).s;
    for (let i = 0; !predicate(s) && i < seconds * 1000 / SAMPLE_MS; i++) { const before = s; await captureWaitingInstallation(p, before, id); s = await tick(p); await materialStep(p, before, s, id, label); }
    assert.ok(predicate(s), 'Physical transition timeout: ' + label); return s;
  }
  async function complete(p, id, label) {
    const s = await physicalUntil(p, id, s => building(s, id)?.done, label), b = building(s, id);
    assert.equal(b.work, WORK[b.kind]); assert.equal(site(s, id), undefined);
    if (b.kind === 'outpost') {
      assert.deepEqual(s.storage.stores[id], zero()); const c = s.reclaim.claims.find(c => c.id === id);
      assert.equal(c.basis.rule, 'delivered-construction'); assert.equal(c.basis.origin, 'physical-delivery');
      assert.deepEqual(vector(r => c.origin.filter(o => o.resource === r).reduce((n, o) => n + o.amount, 0)), COST.outpost);
    }
    await inspect(p, b); await capture(p, label + '-usable', s); return s;
  }
  async function craftComplete(p, workshop) {
    let s = (await exported(p, 'tools-labor-before')).s;
    for (let i = 0; !s.tools && i < Math.ceil(120000 / SAMPLE_MS); i++) {
      const before = s; s = await tick(p); const dt = s.time - before.time;
      assert.ok(dt >= 0 && dt <= .100001);
      const eligible = before.units.filter(u => u.order.kind === 'craft' && u.order.target === workshop.id && u.phase === 'craft' && !u.cargo && !u.next && u.path.length === 0 && atEdge(u, workshop)).length;
      const expected = Math.min(12 - before.knapping.work, eligible * dt), gained = s.knapping.work - before.knapping.work;
      assert.ok(Math.abs(gained - expected) < .00001, 'Tools018 work equals independent adjacent artisan-seconds, including final cap');
      report.toolWorkProgress.push({binding, scenario: active.label, time: s.time, before: before.knapping.work, after: s.knapping.work, dt, eligible});
    }
    assert.equal(s.tools, true); assert.ok(report.toolWorkProgress.some(row => row.eligible > 1 && row.after > row.before)); return s;
  }
  async function gather(p, id, predicate, label) {
    const s = (await exported(p, label + '-before')).s, d = s.deposits.find(d => d.id === id);
    await all(p); await p.locator('#gather').click(); await clickMap(p, d.x + .5, d.y + .5);
    await until(p, predicate, label, 500); await p.locator('#stop').click();
    return until(p, s => s.units.every(u => !u.cargo && u.phase === 'idle'), label + '-returned');
  }
  async function extractionProbe(p, label, expectedInterval) {
    let s = await until(p, v => { const u = actor(v, 'u0'), deposit = v.deposits.find(d => u.order.kind === 'gather' && d.id === u.order.target);
      return deposit && deposit.amount > 0 && u.phase === 'extract' && u.cargo === 0 && u.path.length === 0 && atEdge(u, deposit); }, label + '-start', 80, SAMPLE_MS);
    const samples = [{time: s.time, work: actor(s, 'u0').work, cargo: 0, phase: 'extract'}];
    for (let i = 0; i < Math.ceil(3500 / SAMPLE_MS) && actor(s, 'u0').cargo < 4; i++) {
      const before = s; s = await tick(p); assert.ok(s.time - before.time >= 0 && s.time - before.time <= .100001, 'Extraction samples observe at most one simulation tick');
      const u = actor(s, 'u0'); samples.push({time: s.time, work: u.work, cargo: u.cargo, phase: u.phase});
    }
    const boundaries = samples.filter((row, i) => i && row.cargo > samples[i - 1].cargo);
    assert.ok(boundaries.length >= 4, label + ': observe four actual item extractions');
    for (let i = 1; i < boundaries.length; i++) assert.ok(Math.abs(boundaries[i].time - boundaries[i - 1].time - expectedInterval) <= .100001,
      'Actual extraction interval agrees with ' + expectedInterval + ' seconds, within one simulation tick');
    assert.ok(Math.abs(boundaries.at(-1).time - boundaries[0].time - (boundaries.length - 1) * expectedInterval) <= .100001,
      'Cumulative item intervals agree with the extraction rate without charging travel as extraction');
    await capture(p, label + '-actual-extraction', s); return samples;
  }
  async function close(p) { await events(p); await p.context().close(); persist(); }
  try {
    server = http.createServer((req, res) => { if (req.url.split('?')[0] !== '/hearth-rts.html') { res.writeHead(404); return res.end(); } res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'}); res.end(html); });
    server.listen(0, '127.0.0.1'); await once(server, 'listening'); browser = await playwright.chromium.launch({headless: true, chromiumSandbox: true});
    const p = await open('fresh-main'); let s = (await exported(p, 'fresh')).s;
    assert.deepEqual(s.stock, {wood: 20, stone: 10, food: 0}); assert.equal(s.buildings.length, 1);
    await select(p, ['u0']); await p.locator('#gather').click(); await clickMap(p, 5.5, 6.5);
    const beforeToolExtraction = await extractionProbe(p, 'ordinary-pre-tools', .60);
    for (const id of ['d0', 'd2', 'd1']) s = await gather(p, id, v => v.deposits.find(d => d.id === id).amount === 0, 'earned-' + id);
    assert.deepEqual(s.stock, {wood: 116, stone: 70, food: 0});
    const earned = await capture(p, 'earned-west-116w70s', s);
    await moveAll(p, 25, 13); await moveAll(p, 6, 16);
    const sameStart = await capture(p, 'same-earned-scouted-start');
    await all(p); await p.locator('[data-build="outpost"]').click(); await p.locator('#command-cancel').click();
    assert.equal((await exported(p, 'placement-command-cancelled')).raw, sameStart.raw, 'Cancelling the armed placement command preserves the complete earned camp');
    // One first carrier isolates the visible five-wood/work-zero state; three peers
    // join once captured. The allocation comparison below uses all four immediately.
    const outpost = await place(p, 'outpost', 22, 11, ['u0'], 'east-outpost');
    const empty = await capture(p, 'east-empty-work0', outpost.after, outpost.b);
    s = await physicalUntil(p, outpost.b.id, v => site(v, outpost.b.id).staged.wood === 5, 'first-five-wood');
    assert.equal(building(s, outpost.b.id).work, 0); await inspect(p, outpost.b);
    const five = await capture(p, 'east-five-wood-work0', s, outpost.b);
    assert.notEqual(five.siteImage.sha256, empty.siteImage.sha256, 'Actual Canvas site pixels change when five wood is onsite at work zero');
    report.visualWitness = {empty: empty.file, fiveWood: five.file, sameWork: 0, cropBefore: empty.siteImage, cropAfter: five.siteImage,
      limit: 'PNG pair requires independent visual review; state assertions alone are not the art acceptance'};
    await reload(p, 'staged-five-reload'); await assign(p, outpost.b, ['u0', 'u1', 'u2', 'u3']);
    s = await complete(p, outpost.b.id, 'east-outpost');
    const outpostTransitions = report.transitions.filter(t => t.scenario === 'fresh-main' && t.site === outpost.b.id);
    for (const kind of ['source-pickup', 'site-receipt']) {
      const rows = outpostTransitions.filter(t => t.kind === kind); assert.equal(rows.length, 16); assert.ok(rows.every(t => t.amount === 5));
      assert.deepEqual(vector(r => rows.filter(t => t.resource === r).reduce((n, t) => n + t.amount, 0)), COST.outpost);
    }
    const depotBefore = clone(s.storage.stores[outpost.b.id]);
    s = await gather(p, 'd4', v => v.storage.stores[outpost.b.id].wood >= 50, 'useful-east-wood');
    assert.ok(s.storage.stores[outpost.b.id].wood > depotBefore.wood, 'Completed depot receives actual gathered wood');
    s = await gather(p, 'd6', v => v.storage.stores[outpost.b.id].stone >= 40, 'east-stone-for-workshop-and-tools');
    const workshop = await place(p, 'workshop', 26, 16, ['u0', 'u1', 'u2', 'u3'], 'east-workshop');
    assert.ok(site(workshop.after, workshop.b.id).sources.every(row => row.storeId === outpost.b.id), 'Nearby actual eastern store supplies the workshop');
    s = await complete(p, workshop.b.id, 'east-workshop');
    assert.equal(s.complete, true, 'Actual depletion, eastern usable outpost and finished workshop satisfy the opening');
    for (const kind of ['source-pickup', 'site-receipt']) {
      const rows = report.transitions.filter(t => t.scenario === 'fresh-main' && t.site === workshop.b.id && t.kind === kind);
      assert.equal(rows.length, 14); assert.ok(rows.every(t => t.amount === 5)); assert.deepEqual(vector(r => rows.filter(t => t.resource === r).reduce((n, t) => n + t.amount, 0)), COST.workshop);
    }
    await all(p); await inspect(p, workshop.b); const beforeTools = (await exported(p, 'before-tools018')).s;
    await p.locator('#craft-knapping').click(); const paid = (await exported(p, 'tools018-paid')).s;
    assert.deepEqual(paid.stock, vector(r => beforeTools.stock[r] - ({wood: 4, stone: 8, food: 0}[r])));
    assert.deepEqual(paid.spent, vector(r => beforeTools.spent[r] + ({wood: 4, stone: 8, food: 0}[r])));
    await p.locator('#craft-knapping').click(); assert.deepEqual((await exported(p, 'tools018-repeat')).s, paid);
    s = await craftComplete(p, workshop.b); assert.equal(s.knapping.work, 12);
    const usefulBefore = clone(s), elapsedStart = s.time; s = await gather(p, 'd4', v => v.delivered.wood >= usefulBefore.delivered.wood + 20, 'useful-post-tools-gathering');
    assert.ok(s.storage.stores[outpost.b.id].wood > usefulBefore.storage.stores[outpost.b.id].wood);
    report.tools = {beforeInterval: .60, afterInterval: .45, canonicalWork: 12, actualGatheredWood: s.delivered.wood - usefulBefore.delivered.wood,
      haulElapsedIncludingTravel: s.time - elapsedStart, beforeExtraction: beforeToolExtraction,
      extractionEvidence: 'Separate actual actor work/cargo item boundaries; haul elapsed includes travel'};
    await select(p, ['u0']); const remaining = s.deposits.find(d => d.id === 'd4'); await p.locator('#gather').click(); await clickMap(p, remaining.x + .5, remaining.y + .5);
    const extraction = await extractionProbe(p, 'ordinary-post-tools', .45);
    report.tools.extraction = extraction; await all(p); await p.locator('#stop').click(); s = await until(p, v => v.units.every(u => !u.cargo && u.phase === 'idle'), 'final-cargo-return');
    await capture(p, 'main-complete-useful-supply-line', s); await reload(p, 'complete-main-reload'); await close(p);

    // Same ordinary earned start: measure one-versus-four parallel construction.
    // The other three peers stay idle in the one-worker case. Common gathering,
    // scouting and prepositioning are reported separately from construction elapsed.
    for (const count of [1, 4]) {
      const q = await open('earned-allocation-' + count, sameStart.raw), start = (await exported(q, 'comparison-start')).s;
      const placed = await place(q, 'outpost', 22, 11, start.units.slice(0, count).map(u => u.id), 'comparison-outpost');
      const end = await complete(q, placed.b.id, 'comparison');
      report.scenarios.at(-1).comparison = {sameStartSHA256: sha(sameStart.raw), workers: count, startTime: start.time, endTime: end.time,
        commonEarnedGatheringAndScoutingTime: start.time, totalTimeSinceFresh: end.time,
        elapsedIncludingPrepositionTravelSupplyAndWork: end.time - start.time, materials: COST.outpost}; await close(q);
    }
    const allocations = report.scenarios.filter(s => s.comparison).map(s => s.comparison);
    assert.ok(report.workProgress.some(row => row.eligible === 1 && row.fullyStaged));
    assert.ok(report.workProgress.some(row => row.eligible > 1 && row.fullyStaged));
    report.allocationComparison = {sameStartSHA256: sha(sameStart.raw), cases: allocations,
      singleMinusFourElapsedSeconds: allocations[0].elapsedIncludingPrepositionTravelSupplyAndWork - allocations[1].elapsedIncludingPrepositionTravelSupplyAndWork,
      interpretation: 'Parallel construction speed with one versus four workers from the same earned camp; the other three workers are idle in the one-worker case. Common gathering/scouting/prepositioning and total clocks are retained. This does not measure an allocation opportunity cost, an alternative depot placement, or human pacing.'};

    // Earned interruption/cancellation branches, exact input exported by fresh-main.
    for (const mode of ['reserved-only', 'carried', 'onsite', 'partial-work']) {
      const q = await open('earned-cancel-' + mode, sameStart.raw), ids = mode === 'partial-work' ? ['u0', 'u1', 'u2', 'u3'] : ['u0'];
      const placed = await place(q, 'outpost', 11, 11, ids, 'cancel-' + mode); let state = placed.after;
      if (mode === 'carried') {
        state = await physicalUntil(q, placed.b.id, v => !!actor(v, 'u0').supply, 'carried-before-move'); const old = clone(actor(state, 'u0'));
        await move(q, 2, 3); const accepted = (await exported(q, 'immediate-loaded-move')).s, u = actor(accepted, 'u0');
        assert.equal(u.phase, 'carryMove'); assert.equal(u.next, null); assert.deepEqual(u.supply, old.supply); assert.equal(u.cargo, old.cargo);
        for (const field of ['x', 'y', 'work', 'resource']) assert.equal(u[field], old[field]);
        for (const field of ['stock', 'spent', 'delivered', 'construction']) assert.deepEqual(accepted[field], state[field]);
        await move(q, 2, 3); assert.deepEqual((await exported(q, 'repeated-loaded-move')).s, accepted, 'Repeated active Move does not change accepted custody');
        let first = accepted; for (let i = 0; i < 3 && first.time === accepted.time; i++) first = await tick(q);
        await materialStep(q, accepted, first, placed.b.id, 'first-move');
        assert.ok(Math.hypot(actor(first, 'u0').x - old.x, actor(first, 'u0').y - old.y) > 0, 'Loaded Move starts at the next tick');
        state = await physicalUntil(q, placed.b.id, v => actor(v, 'u0').phase === 'idle', 'held-move'); assert.equal(actor(state, 'u0').cargo, 5); await reload(q, 'held-construction-reload');
        const held = clone(state); await select(q, ['u0']); await q.locator('#stop').click();
        state = await physicalUntil(q, placed.b.id, v => !actor(v, 'u0').supply, 'active-site-stop-and-return');
        assert.deepEqual(state.stock, vector(r => held.stock[r] + (r === old.resource ? old.cargo : 0)));
        assert.equal(reserved(state, old.resource), reserved(held, old.resource) + old.cargo, 'Active-site physical return reserves the load again');
        assert.deepEqual(state.delivered, held.delivered); assert.equal(actor(state, 'u0').order.kind, 'idle');
        const stopped = clone(state); state = await tick(q, 1000); assert.deepEqual(actor(state, 'u0'), actor(stopped, 'u0'), 'Idle manual worker is not captured again by the site');
        await assign(q, placed.b, ['u0']); state = await physicalUntil(q, placed.b.id, v => !!actor(v, 'u0').supply, 'refetched-returned-reservation');
        await move(q, 2, 3); state = await physicalUntil(q, placed.b.id, v => actor(v, 'u0').phase === 'idle', 'held-again-before-cancel');
      } else if (mode === 'onsite') state = await physicalUntil(q, placed.b.id, v => site(v, placed.b.id).staged.wood === 5, 'onsite-before-cancel');
      else if (mode === 'partial-work') state = await physicalUntil(q, placed.b.id, v => building(v, placed.b.id).work > 0, 'partial-paid-work-before-cancel');
      const beforeCancel = clone(state); await inspect(q, placed.b); await q.locator('#site-cancel').click(); const cancelled = (await exported(q, 'cancel-accepted')).s;
      assert.deepEqual(cancelled.stock, beforeCancel.stock, 'Cancellation releases reserved goods without adding store stock'); assert.deepEqual(cancelled.spent, beforeCancel.spent);
      if (mode === 'reserved-only') assert.equal(building(cancelled, placed.b.id), undefined);
      else {
        assert.equal(site(cancelled, placed.b.id).state, 'cancelling'); assert.deepEqual(site(cancelled, placed.b.id).sources, []);
        assert.deepEqual(site(cancelled, placed.b.id).released, vector(r => site(beforeCancel, placed.b.id).sources.filter(row => row.resource === r).reduce((n, row) => n + row.amount, 0)));
        await inspect(q, placed.b); assert.equal(await q.locator('#site-cancel').isDisabled(), true);
        await supplyText(q, cancelled, building(cancelled, placed.b.id));
        await capture(q, 'cancel-recovery-world-cue', cancelled, placed.b);
        assert.deepEqual((await exported(q, 'cancel-repeat-prevented')).s, cancelled, 'Disabled repeat action preserves the accepted cancellation');
        if (mode === 'carried') { assert.deepEqual(actor(cancelled, 'u0'), actor(beforeCancel, 'u0'), 'Cancel does not seize manually held cargo'); await select(q, ['u0']); await q.locator('#stop').click(); }
        else { await all(q); await q.locator('#stop').click(); await inspect(q, placed.b); assert.equal(await q.locator('#site-recover').innerText(), 'Resume supply recovery with selected villagers'); await q.locator('#site-recover').click(); }
        await reload(q, 'cancel-recovery-reload'); state = await physicalUntil(q, placed.b.id, v => !building(v, placed.b.id), 'recover-all-cancelled-material');
      }
      state = (await exported(q, 'cancel-settled')).s; assert.deepEqual(state.stock, placed.before.stock); assert.deepEqual(state.spent, placed.before.spent);
      assert.ok(state.units.every(u => !u.supply && !u.supplyPickup));
      // A fresh useful replacement must actually fetch, deliver and install after cancellation.
      const replacement = await place(q, 'outpost', 22, 11, ['u0', 'u1', 'u2', 'u3'], 'resumed-replacement');
      state = await complete(q, replacement.b.id, 'resumed-replacement');
      await gather(q, 'd4', v => v.storage.stores[replacement.b.id].wood >= 5, 'replacement-useful-haul'); await capture(q, 'replacement-used'); await close(q);
    }

    // Existing reclaim capital joins actual storage, then the new physical supply path.
    const q = await open('earned-west-reclaim-relocate', earned.raw); await moveAll(q, 6, 16);
    const west = await place(q, 'outpost', 11, 11, ['u0', 'u1', 'u2', 'u3'], 'west-investment'); await complete(q, west.b.id, 'west-investment');
    await all(q); await inspect(q, west.b); await q.locator('#outpost-reclaim').click();
    const reclaimed = await until(q, v => !building(v, west.b.id), 'existing-reclaim-to-stores', 300, 100);
    assert.deepEqual(reclaimed.stock, {wood: 116, stone: 70, food: 0}); assert.deepEqual(reclaimed.reclaim.recovered, COST.outpost);
    await capture(q, 'reclaimed-capital-in-actual-store', reclaimed); await moveAll(q, 25, 13); await moveAll(q, 6, 16);
    const relocated = await place(q, 'outpost', 22, 11, ['u0', 'u1', 'u2', 'u3'], 'reclaimed-newsite');
    await complete(q, relocated.b.id, 'reclaimed-newsite'); await gather(q, 'd4', v => v.storage.stores[relocated.b.id].wood >= 5, 'relocated-useful-haul');
    await capture(q, 'reclaimed-relocated-and-used'); await close(q);

    // SUPPLEMENTARY migration, from genuine separately earned pinned-v5 bytes.
    // Never project current schema into a historical source or seed the main journey.
    // Required witness report fields are documented by the assertions below.
    if (process.env.LEGACY_CONSTRUCTION_WITNESS || process.env.LEGACY_CONSTRUCTION_WITNESS_REPORT) {
      assert.ok(process.env.LEGACY_CONSTRUCTION_WITNESS && process.env.LEGACY_CONSTRUCTION_WITNESS_REPORT && process.env.OLD_BASE_DIR,
        'The genuine legacy witness requires both provenance report and pinned old source/build directory');
      const raw = fs.readFileSync(process.env.LEGACY_CONSTRUCTION_WITNESS, 'utf8');
      const proofRaw = fs.readFileSync(process.env.LEGACY_CONSTRUCTION_WITNESS_REPORT, 'utf8'), proof = JSON.parse(proofRaw), old = JSON.parse(raw);
      assert.equal(proof.status, 'passed'); assert.equal(proof.sourceCommit, LEGACY_BASE);
      const oldRoot = path.resolve(process.env.OLD_BASE_DIR), oldHTML = fs.readFileSync(path.join(oldRoot, 'dist/hearth-rts.html'));
      for (const file of ['src/hearth-rts/engine.js', 'src/hearth-rts/view.js', 'src/hearth-rts/shell.html', 'src/hearth-rts/styles.css', 'build.mjs']) {
        const bytes = fs.readFileSync(path.join(oldRoot, file)); assert.equal(proof.sourceHashes[file], sha(bytes)); assert.equal(sha(bytes), LEGACY_HASHES[file]);
        if (file.endsWith('engine.js') || file.endsWith('view.js')) assert.ok(oldHTML.toString().includes(bytes.toString()));
      }
      assert.deepEqual(proof.builtHTML, {sha256: sha(oldHTML), bytes: oldHTML.length});
      assert.deepEqual(proof.sourceHashes, LEGACY_HASHES, 'Provenance is pinned to reviewed baseline bytes, not a claimed commit string');
      const producer = fs.readFileSync(path.join(ROOT, 'tests/browser/hearth-construction-legacy.cjs'));
      assert.equal(proof.harnessSHA256, sha(producer), 'Old witness uses the exact immutable producer dispatched with this candidate');
      assert.equal(proof.binding, sha(JSON.stringify({source: proof.sourceHashes, build: proof.builtHTML, harness: proof.harnessSHA256})));
      const evidenceRoot = path.dirname(path.resolve(process.env.LEGACY_CONSTRUCTION_WITNESS_REPORT));
      assert.equal(proof.producerFile, 'producer-source.cjs'); assert.equal(sha(fs.readFileSync(path.join(evidenceRoot, proof.producerFile))), sha(producer));
      const expectedChain = ['fresh-pinned-v5', 'earned-d0', 'earned-d2', 'earned-d1', 'before-paid-placement', 'paid-reserved-before-work', 'legacy-unfinished-v5'];
      assert.deepEqual(proof.checkpoints.map(c => c.file), expectedChain.map(name => name + '.json'));
      let eventEnd = 0;
      const chain = proof.checkpoints.map((c, i) => {
        assert.equal(c.binding, proof.binding); assert.equal(path.basename(c.file), c.file);
        const bytes = fs.readFileSync(path.join(evidenceRoot, c.file)); assert.equal(sha(bytes), c.sha256); assert.equal(bytes.length, c.bytes);
        assert.equal(c.screenshot.file, expectedChain[i] + '.png'); assert.equal(sha(fs.readFileSync(path.join(evidenceRoot, c.screenshot.file))), c.screenshot.sha256);
        assert.equal(c.eventRange.start, eventEnd); assert.ok(c.eventRange.end > c.eventRange.start && c.eventRange.end <= proof.events.length); eventEnd = c.eventRange.end;
        const inputs = proof.events.slice(c.eventRange.start, c.eventRange.end); assert.ok(inputs.every(e => e.binding === proof.binding));
        assert.ok(inputs.some(e => e.trusted && e.target === 'export'));
        if (i >= 1 && i <= 3) for (const target of ['select-all', 'gather', 'world', 'pause']) assert.ok(inputs.some(e => e.trusted && e.target === target), 'Earned transition has actual controls: ' + target);
        const snapshot = JSON.parse(bytes); assert.equal(snapshot.version, 5); assert.equal(snapshot.construction, undefined);
        assert.deepEqual(vector(r => snapshot.stock[r] + snapshot.spent[r] + snapshot.units.filter(u => u.resource === r).reduce((n, u) => n + u.cargo, 0) + snapshot.deposits.filter(d => d.kind === r).reduce((n, d) => n + d.amount, 0)), TOTAL);
        assert.equal(snapshot.time, c.time); return snapshot;
      });
      assert.equal(eventEnd, proof.events.length);
      assert.deepEqual(chain[0].stock, {wood: 20, stone: 10, food: 0}); assert.deepEqual(chain[0].spent, zero()); assert.equal(chain[0].buildings.length, 1);
      const earnings = [{wood: 48, stone: 0, food: 0}, {wood: 48, stone: 60, food: 0}, {wood: 96, stone: 60, food: 0}];
      for (let i = 1; i <= 3; i++) {
        assert.deepEqual(chain[i].delivered, earnings[i - 1]); assert.deepEqual(chain[i].stock, vector(r => chain[0].stock[r] + earnings[i - 1][r]));
        assert.deepEqual(chain[i].spent, zero()); assert.deepEqual(chain[i].buildings, chain[0].buildings); assert.ok(chain[i].time > chain[i - 1].time);
        assert.ok(chain[i].units.every(u => !u.cargo && u.phase === 'idle')); assert.equal(chain[i].depleted, i);
        for (const d of chain[i].deposits) assert.equal(d.amount, chain[0].deposits.find(p => p.id === d.id).amount - (['d0', 'd2', 'd1'].slice(0, i).includes(d.id) ? d.initial : 0));
      }
      assert.deepEqual(chain[4], chain[3], 'Selecting a builder after earned gathering does not author a new state');
      assert.deepEqual(chain[5].stock, {wood: 56, stone: 50, food: 0}); assert.deepEqual(chain[5].spent, COST.outpost);
      assert.deepEqual(chain[5].deposits, chain[4].deposits); assert.deepEqual(chain[5].delivered, chain[4].delivered);
      assert.equal(chain[5].buildings.length, 2); assert.equal(chain[5].buildings.find(b => b.kind === 'outpost').work, 0);
      assert.deepEqual(chain[6], old); assert.equal(proof.checkpoints.at(-1).sha256, sha(raw));
      assert.ok(chain[6].time > chain[5].time); for (const field of ['stock', 'spent', 'delivered', 'deposits']) assert.deepEqual(chain[6][field], chain[5][field]);
      const f = proof.legacyFixture; assert.ok(f); assert.equal(f.rawSha256, sha(raw)); assert.equal(f.bytes, Buffer.byteLength(raw));
      assert.equal(f.sourceCommit, LEGACY_BASE); assert.equal(f.earnedBeforeAnyConstructionCode, true);
      for (const flag of ['synthetic', 'projectedSchema', 'sourceInjected']) assert.equal(f[flag], false);
      assert.ok(proof.events.some(e => e.trusted && e.target === 'world'));
      assert.ok(proof.events.some(e => e.trusted && e.target === 'export'));
      assert.equal(old.version, 5); assert.equal(old.construction, undefined); assert.equal(old.reclaim.profile, 'accepted-opening.outpost-reclaim.v1');
      const unfinished = old.buildings.find(b => b.id === f.buildingId); assert.ok(unfinished && !unfinished.done && unfinished.work > 0 && unfinished.work < WORK[unfinished.kind]);
      assert.ok(old.storage.reservations[unfinished.id]); assert.ok(old.units.some(u => u.order.kind === 'build' && u.order.target === unfinished.id));
      assert.ok(old.units.every(u => !u.supply && !u.supplyPickup));
      const oldBill = COST[unfinished.kind]; assert.deepEqual(vector(r => old.storage.reservations[unfinished.id].sources.filter(o => o.resource === r).reduce((n, o) => n + o.amount, 0)), oldBill);
      for (const action of ['complete', 'cancel']) {
        const l = await open('genuine-v5-unfinished-' + action); await l.locator('#journey').click(); l.once('dialog', d => d.accept());
        await l.locator('#file').setInputFiles({name: 'genuine-v5-unfinished.json', mimeType: 'application/json', buffer: Buffer.from(raw)});
        await l.locator('#dialog').waitFor({state: 'hidden'}); let adopted = (await exported(l, 'genuine-v5-adopted')).s;
        assert.deepEqual(adopted, {...old, version: 6, construction: {profile: PROFILE, sites: []}}, 'Certified-v5 adoption adds only an empty construction ledger');
        assert.equal(await l.evaluate(key => localStorage.getItem(key + '.import-before-v6'), KEY), raw, 'Exact old paid source remains downloadable after adoption');
        await reload(l, 'genuine-v5-unfinished-reload');
        if (action === 'complete') {
          adopted = await until(l, v => building(v, unfinished.id)?.done, 'genuine-legacy-paid-completion', 100, 100);
          assert.deepEqual(adopted.stock, old.stock); assert.deepEqual(adopted.spent, old.spent);
          assert.ok(adopted.units.every(u => !u.supply && !u.supplyPickup)); assert.deepEqual(adopted.construction.sites, []);
          assert.equal(building(adopted, unfinished.id).work, WORK[unfinished.kind]);
        } else {
          await inspect(l, unfinished); assert.match(await l.locator('#site-cancel').innerText(), /refund|cancel/i); await l.locator('#site-cancel').click();
          adopted = (await exported(l, 'genuine-legacy-full-refund')).s; assert.equal(building(adopted, unfinished.id), undefined);
          assert.deepEqual(adopted.stock, vector(r => old.stock[r] + oldBill[r])); assert.deepEqual(adopted.spent, vector(r => old.spent[r] - oldBill[r]));
          assert.deepEqual(adopted.construction.sites, []); assert.ok(adopted.units.every(u => !u.supply && !u.supplyPickup));
        }
        await capture(l, 'genuine-v5-' + action + '-without-second-bill', adopted); await close(l);
      }
      report.legacyUnfinished = {status: 'passed', sourceCommit: LEGACY_BASE, rawSHA256: sha(raw), reportSHA256: sha(proofRaw), builtSHA256: sha(oldHTML), producerSHA256: sha(producer), producerBinding: proof.binding,
        checkedCheckpointChain: expectedChain, independentCoordinatorArtifactReview: 'Required separately; hashes bind the returned files and do not authenticate self-authored reports', buildingId: unfinished.id};
    }
    assert.ok(report.events.some(e => e.trusted && e.type === 'pointerdown' && e.target === 'world'));
    for (const id of ['gather', 'move', 'stop', 'pause', 'command-cancel']) assert.ok(report.events.some(e => e.trusted && e.target === id), 'Required real UI input: ' + id);
    assert.ok(report.installationStatusTransitions.length > 0 && report.installationStatusWitness, 'Observe and capture at least one actual same-worker Waiting-to-Installing UI transition');
    assert.deepEqual(report.errors, []); report.earnedJourneyStatus = 'passed'; report.status = report.legacyUnfinished.status === 'passed' ? 'passed' : 'pending-legacy-witness';
    report.wallSeconds = (Date.now() - started) / 1000; guard(); persist();
    if (report.status !== 'passed') process.exitCode = 2;
    console.log(report.status.toUpperCase() + ' physical construction: fresh earned 16/14-load supply, source and onsite custody, work-zero Canvas PNG pair, Tools018/useful haul, cancellation/replacement and reclaim reuse. Binding ' + binding);
  } catch (error) {
    report.status = 'failed'; report.failure = {message: String(error), stack: error.stack};
    if (active?.page && !active.page.isClosed()) {
      await active.page.screenshot({path: path.join(DIR, 'failure.png'), fullPage: true}).catch(() => {});
      report.failure.body = await active.page.locator('body').innerText().catch(() => null); report.failure.lastSaved = await saved(active.page).catch(() => null); await events(active.page).catch(() => {});
    }
    persist(); throw error;
  } finally { for (const context of contexts) await context.close().catch(() => {}); if (browser) await browser.close(); if (server) await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
