/* Spark-only candidate browser regression. Authoring/review on M6 must not execute this file.
 * Run after the coordinator's candidate build:
 * LEGACY_RECLAIM_WITNESS=/absolute/path/legacy-exhausted-v4.json \
 * PLAYWRIGHT_MODULE=/absolute/path/to/playwright node tests/browser/hearth-reclaim.cjs
 * The adjacent report.json (or LEGACY_RECLAIM_WITNESS_REPORT) is mandatory provenance.
 * Primary rescue and fresh relocation use ordinary controls, synchronous Pause-save
 * snapshots, and Journey downloads at every physical pickup/receipt boundary.
 * Storage faults/seeding and the synthetic completed Cave host are isolated and labelled.
 * No engine import, exposed Camp, game patch, hidden grant or primary storage injection.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const http = require('node:http');
const {once} = require('node:events');
const playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const ROOT = path.resolve(__dirname, '../..');
const DIR = path.join(ROOT, 'artifacts/hearth-reclaim');
const KEY = 'singularity-clicker.hearth-rts.v1';
const BASE = 'b365ae01e4315bfd183a14438175c19c6396b11d';
const CONTRACT = '948de6f34217a04f38102c7f15f713a34e8b758295c19952904828d59cc84e96';
const PROFILE = 'accepted-opening.outpost-reclaim.v1';
const RES = ['wood', 'stone', 'food'];
const TOTAL = {wood: 416, stone: 220, food: 225};
const BILL = {wood: 60, stone: 20, food: 0};
const OLD_HASHES = {
  'src/hearth-rts/engine.js': 'ea412f31690fd5b398263dfd5cdaeb1c81aef23a21bdc2ab3dab4ceb9ec4cb55',
  'src/hearth-rts/view.js': 'ed8fe4dc1a9f2025c667acbc9c2f1a003c53fe58ac094f0ae5b49dc40bfc2c0c',
  'src/hearth-rts/shell.html': '124046ab8f67f79b72eecb7a771e61dae8416e396449b79e84e8e6d751250ebd',
  'src/hearth-rts/styles.css': '3054d93950fbf881a06ebbd0f15235286479628da74137df3bce7a279b94d535',
  'build.mjs': 'cc3a45bc20f08dff82c01aceadefe3e4b7c2c5ea924aaba5da3561c05b119d47'
};
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const copy = value => JSON.parse(JSON.stringify(value));
const zero = () => ({wood: 0, stone: 0, food: 0});
const vector = fn => Object.fromEntries(RES.map(r => [r, fn(r)]));
const sumCargo = (s, r, id) => s.units.filter(u => u.resource === r &&
  (id === undefined || u.reclaim?.claimId === id)).reduce((n, u) => n + u.cargo, 0);
const claim = (s, id) => s.reclaim?.claims.find(c => c.id === id);
const liveReferences = (s, id) => s.units.filter(u => u.reclaim?.claimId === id ||
  [u.order, u.next].some(o => o?.kind === 'reclaim' && o.target === id));
const writeJSON = (name, value) => fs.writeFileSync(path.join(DIR, name), JSON.stringify(value, null, 2) + '\n');
function openingFacts(s) {
  assert.ok(s.depleted > 0, 'Opening has an actually depleted finite deposit');
  assert.ok(s.buildings.some(b => b.kind === 'outpost' && b.done && !b.retiring && b.x > 20),
    'Opening has an actual completed usable outpost east of x=20');
  assert.ok(s.buildings.some(b => b.kind === 'workshop' && b.done), 'Opening has an actual completed workshop');
  assert.equal(s.complete, true, 'Cached completion agrees with independent opening facts');
}

// Independent physical inventory and fixed recipe arithmetic, never the product validator.
function matter(s) {
  assert.deepEqual(vector(r => s.deposits.filter(d => d.kind === r).reduce((n, d) => n + d.amount, 0)
    + Object.values(s.storage.stores).reduce((n, store) => n + store[r], 0)
    + sumCargo(s, r) + s.spent[r]), TOTAL, 'Finite matter = wild + actual stores + ALL cargo + spent');
  assert.deepEqual(vector(r => Object.values(s.storage.stores).reduce((n, store) => n + store[r], 0)), s.stock);
  for (const values of [s.stock, s.spent, s.delivered, ...Object.values(s.storage.stores)]) {
    for (const r of RES) assert.ok(Number.isInteger(values[r]) && values[r] >= 0 && values[r] < 10000000);
  }
  for (const u of s.units) assert.ok(Number.isInteger(u.cargo) && u.cargo >= 0 && u.cargo <= 5);
  if (s.version !== 5) return;
  assert.equal(s.reclaim.profile, PROFILE);
  for (const c of s.reclaim.claims) {
    assert.deepEqual(vector(r => c.unreleased[r] + sumCargo(s, r, c.id) + c.receipted[r]), BILL,
      'Every claim is finite unreleased capital + physical tagged cargo + cumulative receipts');
    assert.ok(s.buildings.some(b => b.id === c.id && b.kind === 'outpost'));
  }
  assert.deepEqual(vector(r => s.reclaim.settled[r] + s.reclaim.claims.reduce((n, c) => n + c.receipted[r], 0)),
    s.reclaim.recovered, 'Recovered summary is attribution, not extra inventory');
  const paid = vector(r => s.reclaim.claims.reduce((n, c) => n + c.unreleased[r], 0)
    + s.buildings.filter(b => b.kind === 'workshop').length * ({wood: 40, stone: 30, food: 0}[r])
    + (s.knapping ? {wood: 4, stone: 8, food: 0}[r] : 0)
    + (r === 'food' ? 25 * (s.units.length - 4) : 0));
  assert.deepEqual(s.spent, paid, 'Remaining paid obligations, including unfinished ones, back spent');
}

function witness(raw, provenance) {
  const s = JSON.parse(raw);
  assert.equal(provenance.status, 'passed', 'The genuine old executable run must have passed');
  assert.equal(provenance.sourceCommit, BASE);
  assert.equal(provenance.contractSha256, CONTRACT);
  for (const [file, expected] of Object.entries(OLD_HASHES)) assert.equal(provenance.sourceHashes[file], expected);
  const f = provenance.legacyFixture;
  assert.ok(f, 'The old run must identify its earned export');
  assert.equal(f.rawSha256, sha(raw));
  assert.equal(f.bytes, Buffer.byteLength(raw));
  assert.equal(f.sourceCommit, BASE);
  assert.equal(f.earnedBeforeAnyReclaimCode, true);
  assert.equal(f.synthetic, false); assert.equal(f.projectedSchema, false); assert.equal(f.sourceInjected, false);
  assert.equal(f.builtHTML.sha256, provenance.builtHTML.sha256);
  assert.equal(provenance.negativeControl.status, 'expected-unavailable-observed');
  assert.equal(provenance.negativeControl.eastBuildRejected, true);
  assert.equal(s.version, 4); assert.equal(s.units.length, 4);
  assert.deepEqual(s.stock, {wood: 16, stone: 70, food: 0});
  assert.deepEqual(s.spent, {wood: 400, stone: 150, food: 0});
  assert.deepEqual(s.delivered, {wood: 396, stone: 210, food: 0});
  assert.equal(s.depleted, 6); assert.equal(s.tools, false); assert.equal(s.knapping, null);
  assert.equal(s.buildings.filter(b => b.kind === 'outpost' && b.done && b.x <= 20).length, 6);
  assert.equal(s.buildings.filter(b => b.kind === 'workshop' && b.done).length, 1);
  assert.ok(s.units.every(u => !u.cargo && u.phase === 'idle' && u.order.kind === 'idle'));
  assert.ok(s.deposits.every(d => d.kind === 'food' ? d.amount === d.initial : d.amount === 0));
  matter(s); return s;
}

fs.mkdirSync(DIR, {recursive: true});
(async () => {
  const started = Date.now(), deadline = started + 780000;
  const report = {status: 'running', contractSha256: CONTRACT, legacyBase: BASE,
    method: 'Ordinary trusted controls; synchronous Pause-save snapshots with every pickup/receipt cross-checked by Journey download; controlled browser clock',
    bounds: {wallSeconds: 780, primaryClockStepMilliseconds: 50, maximumObservedSimulationStep: .1,
      perWaitSimulatedSeconds: 500},
    scenarios: [], checkpoints: [], observations: [], transitions: [], events: [], pageErrors: [], sourceHashes: {},
    limits: ['Headless Chromium desktop only; no physical device or assistive technology acceptance',
      'Clock-controlled regression does not establish real-time pacing, clarity, choice, maintenance or enjoyment',
      'Fresh relocation demonstrates mechanics only; a separate real-time human session must judge usefulness',
      'Storage failure fixtures and synthetic completed Cave navigation host are isolated, not earned-play evidence',
      'Engine suites own exhaustive v1-v4, topology, numeric headroom, all work switches and bounded-history matrices',
      'This increment does not complete L01-C, H2, First Furrow or full campaign handoff'], failure: null};
  let server, browser, active, lastObserved, fixtureRaw, legacy, rescuedRaw, carryMoveRaw;
  const contexts = [];
  const checkDeadline = () => assert.ok(Date.now() < deadline, '780-second browser regression budget exceeded; preserve failure evidence');
  const persistReport = () => writeJSON('report.json', report);

  async function drain(p) {
    report.events.push(...await p.evaluate(() => window.__reclaimInput?.splice(0) || []));
  }
  async function storage(p) {
    // Storage snapshots are used only for persistence evidence, never to inspect primary live state.
    return p.evaluate(prefix => Object.fromEntries(Array.from({length: localStorage.length}, (_, i) => localStorage.key(i))
      .filter(k => k.startsWith(prefix)).sort().map(k => [k, window.__reclaimStorageProbe
        ? window.__reclaimStorageProbe.nativeGet.call(localStorage, k) : localStorage.getItem(k)])), KEY);
  }
  async function download(p, selector, name) {
    checkDeadline();
    const waiting = p.waitForEvent('download'); await p.locator(selector).click();
    const item = await waiting, file = path.join(DIR, name + '.json'); await item.saveAs(file);
    const raw = fs.readFileSync(file, 'utf8'); await item.delete(); return raw;
  }
  async function exported(p, name = 'latest-export', close = true) {
    if (!await p.locator('#dialog').evaluate(d => d.open)) await p.locator('#journey').click();
    const raw = await download(p, '#export', name);
    if (close) await p.locator('#close').click();
    lastObserved = {scenario: active.label, raw}; return raw;
  }
  async function read(p, name) {
    const s = JSON.parse(await exported(p, name)); matter(s); return s;
  }
  async function checkpoint(p, label, s) {
    const raw = await exported(p, label); if (s) assert.deepEqual(JSON.parse(raw), s);
    await p.screenshot({path: path.join(DIR, label + '.png'), fullPage: true}); await drain(p);
    report.checkpoints.push({scenario: active.label, label, sha256: sha(raw), bytes: Buffer.byteLength(raw)});
    persistReport(); return JSON.parse(raw);
  }
  async function mapClick(p, x, y, button = 'left') {
    await p.locator('#world').scrollIntoViewIfNeeded();
    const box = await p.locator('#world').boundingBox(); assert.ok(box);
    const t = await p.locator('#world').evaluate(c => ({width: c.width, height: c.height,
      x: Number(c.dataset.cameraX || 0), y: Number(c.dataset.cameraY || 0), scale: Number(c.dataset.cameraScale || 1)}));
    const point = {x: box.x + (x * 32 * t.scale + t.x) / t.width * box.width,
      y: box.y + (y * 32 * t.scale + t.y) / t.height * box.height};
    assert.equal(await p.evaluate(q => document.elementFromPoint(q.x, q.y)?.id, point), 'world',
      'Trusted map pointer must hit the visible canvas rather than an overlay');
    await p.mouse.click(point.x, point.y, {button});
  }
  async function select(p, ids) {
    for (let i = 0; i < ids.length; i++) await p.locator('[data-unit="' + ids[i] + '"]').click({modifiers: i ? ['Shift'] : []});
    assert.equal(await p.locator('.unit-card[aria-pressed="true"]').count(), ids.length);
  }
  async function inspect(p, b) {
    // The interior offset avoids a worker standing just outside the footprint winning hit testing.
    await mapClick(p, b.x + 1.1, b.y + 1.1);
    await p.locator('#outpost-reclaim').waitFor();
  }
  async function advance(p, ms, label) {
    checkDeadline(); assert.equal(await p.locator('#pause').innerText(), 'Resume');
    await p.locator('#pause').click(); await p.clock.runFor(ms); await p.locator('#pause').click();
    assert.equal(await p.locator('#pause').innerText(), 'Resume');
    // The real Pause handler synchronously serializes the current camp. This is
    // read-only observation of that control's save, not an autosave timing guess.
    const raw = await p.evaluate(key => localStorage.getItem(key), KEY), s = JSON.parse(raw);
    assert.ok(raw); matter(s); lastObserved = {scenario: active.label, raw};
    report.observations.push({scenario: active.label, time: s.time, stock: s.stock, spent: s.spent,
      gathered: s.delivered, recovered: s.reclaim?.recovered, actors: s.units.map(u => ({id: u.id,
        x: u.x, y: u.y, phase: u.phase, cargo: u.cargo, resource: u.resource, order: u.order,
        reclaim: u.reclaim || null}))});
    if (label) report.scenarios.push({observation: label, simulatedTime: s.time}); return s;
  }
  async function until(p, predicate, label, seconds = 100, step = 1000) {
    assert.ok(seconds <= 500); let s = await read(p);
    for (let elapsed = 0; !predicate(s) && elapsed < seconds * 1000; elapsed += step) s = await advance(p, step);
    assert.ok(predicate(s), 'Timed out through ordinary controls: ' + label); return s;
  }
  async function reloadExact(p, label) {
    const before = await exported(p, label + '-before'); await drain(p); await p.reload();
    await p.locator('[data-unit="u0"]').waitFor();
    assert.equal(await p.locator('#pause').innerText(), 'Resume'); await p.clock.runFor(300);
    assert.equal(await exported(p, label + '-after'), before, 'Paused v5 reload must not reissue capital or change custody');
  }
  async function importText(p, raw, label, success = true) {
    if (!await p.locator('#dialog').evaluate(d => d.open)) await p.locator('#journey').click();
    p.once('dialog', dialog => dialog.accept());
    await p.locator('#file').setInputFiles({name: label + '.json', mimeType: 'application/json', buffer: Buffer.from(raw)});
    if (success) await p.locator('#dialog').waitFor({state: 'hidden'});
    else await p.locator('#save-status').filter({hasText: 'Import could not be saved'}).waitFor();
  }
  async function moveAll(p, x, y) {
    await p.locator('#select-all').click(); await p.locator('#move').click(); await mapClick(p, x + .5, y + .5);
    return until(p, s => s.units.every(u => u.phase === 'idle' && !u.cargo), 'settled group Move');
  }
  async function build(p, kind, x, y, label) {
    const before = await read(p); await p.locator('#select-all').click();
    const builderCount = await p.locator('.unit-card[aria-pressed="true"]').count();
    assert.equal(builderCount, before.units.length, 'Select all supplies the actual existing builder group');
    await p.locator('[data-build="' + kind + '"]').click(); await mapClick(p, x + .5, y + .5);
    const placed = await read(p), added = placed.buildings.filter(b => !before.buildings.some(v => v.id === b.id));
    assert.equal(added.length, 1, 'Ordinary placement must create exactly one paid site: ' + label);
    const b = added[0]; assert.equal(b.kind, kind); assert.equal(b.done, false); assert.equal(b.work, 0);
    assert.deepEqual({x: b.x, y: b.y}, {x, y}, 'Placement honors the ordinary requested map location');
    const cost = kind === 'outpost' ? BILL : {wood: 40, stone: 30, food: 0};
    assert.deepEqual(placed.stock, vector(r => before.stock[r] - cost[r]));
    assert.deepEqual(placed.spent, vector(r => before.spent[r] + cost[r]));
    await checkpoint(p, label + '-paid', placed);
    const done = await until(p, s => s.buildings.find(v => v.id === b.id)?.done, label + ' actual work');
    const requiredWork = kind === 'outpost' ? 24 : 32;
    assert.equal(done.buildings.find(v => v.id === b.id).work, requiredWork);
    assert.deepEqual({x: done.buildings.find(v => v.id === b.id).x, y: done.buildings.find(v => v.id === b.id).y}, {x, y});
    assert.ok(done.time - placed.time + .000001 >= requiredWork / builderCount,
      'Actual paid-to-completed time includes at least canonical work / selected builder count');
    await checkpoint(p, label + '-built', done); return b.id;
  }

  function physicalStep(before, after, id, label) {
    matter(after);
    assert.deepEqual(after.delivered, before.delivered, 'Recovery is not gathering');
    assert.deepEqual(after.storage.transferred, before.storage.transferred, 'Recovery is not a store transfer');
    assert.deepEqual(after.deposits, before.deposits); assert.equal(after.depleted, before.depleted);
    assert.equal(after.tools, before.tools); assert.deepEqual(after.knapping, before.knapping);
    assert.ok(after.time - before.time <= .100001 && after.time >= before.time,
      'Every sample spans at most one ordinary 0.1-second simulation boundary');
    for (const u of after.units) {
      const previous = before.units.find(v => v.id === u.id);
      assert.ok(Math.hypot(u.x - previous.x, u.y - previous.y) <= 3 * (after.time - before.time) + .000001,
        'Physical carriers obey the accepted movement rate of 3 cells/second');
    }
    const picked = vector(r => before.spent[r] - after.spent[r]);
    const received = vector(r => after.stock[r] - before.stock[r]);
    for (const r of RES) {
      const pickups = after.units.filter(u => u.reclaim?.claimId === id && u.resource === r &&
        !before.units.find(v => v.id === u.id)?.reclaim);
      const receipts = before.units.filter(u => u.reclaim?.claimId === id && u.resource === r &&
        !after.units.find(v => v.id === u.id)?.reclaim);
      assert.equal(picked[r], pickups.reduce((n, u) => n + u.cargo, 0), 'Only named physical pickups reduce spent');
      assert.equal(received[r], receipts.reduce((n, u) => n + u.cargo, 0), 'Only actual receipts increase stock');
      assert.equal(after.reclaim.recovered[r] - before.reclaim.recovered[r], received[r]);
      for (const u of pickups) {
        assert.equal(u.cargo, 5, '60W20S consists of twelve full wood and four full stone loads');
        const site = before.buildings.find(b => b.id === id), prior = before.units.find(v => v.id === u.id);
        const edge = [{x: site.x - 1, y: site.y}, {x: site.x - 1, y: site.y + 1},
          {x: site.x + 2, y: site.y}, {x: site.x + 2, y: site.y + 1},
          {x: site.x, y: site.y - 1}, {x: site.x + 1, y: site.y - 1},
          {x: site.x, y: site.y + 2}, {x: site.x + 1, y: site.y + 2}];
        assert.ok(edge.some(q => Math.abs(u.x - q.x) < .001 && Math.abs(u.y - q.y) < .001), 'Pickup requires real edge adjacency');
        assert.equal(prior.cargo, 0); assert.equal(prior.order.kind, 'reclaim'); assert.equal(prior.order.target, id);
        assert.deepEqual({x: u.x, y: u.y}, {x: prior.x, y: prior.y}, 'Pickup is a separate transition after edge travel');
        if (r === 'stone') assert.equal(claim(before, id).unreleased.wood, 0, 'Wood is picked before stone');
        report.transitions.push({scenario: active.label, label, kind: 'pickup', time: after.time, actor: u.id,
          resource: r, amount: u.cargo, position: {x: u.x, y: u.y}, spent: copy(after.spent)});
      }
      for (const u of receipts) {
        const reached = after.units.find(v => v.id === u.id);
        assert.deepEqual({x: reached.x, y: reached.y}, {x: u.x, y: u.y}, 'Receipt is a separate transition after travel');
        const stores = after.buildings.filter(b => b.done && !b.retiring && ['hearth', 'outpost'].includes(b.kind));
        const atStore = b => {
          const n = b.kind === 'hearth' ? 3 : 2;
          return ((Math.abs(reached.x - (b.x - 1)) < .001 || Math.abs(reached.x - (b.x + n)) < .001)
            && reached.y >= b.y && reached.y < b.y + n)
            || ((Math.abs(reached.y - (b.y - 1)) < .001 || Math.abs(reached.y - (b.y + n)) < .001)
            && reached.x >= b.x && reached.x < b.x + n);
        };
        const destination = stores.find(b => b.id === u.dropoff);
        assert.ok(destination && atStore(destination), 'Receipt occurs at the named actual non-retiring store edge');
        report.transitions.push({scenario: active.label, label, kind: 'receipt', time: after.time, actor: u.id,
          resource: r, amount: u.cargo, store: destination.id, position: {x: reached.x, y: reached.y}, stock: copy(after.stock)});
      }
      for (const [storeId, stock] of Object.entries(after.storage.stores)) {
        assert.equal(stock[r] - before.storage.stores[storeId][r],
          receipts.filter(u => u.dropoff === storeId).reduce((n, u) => n + u.cargo, 0),
          'Only the reached receiving store is credited, once');
      }
    }
    if (!claim(after, id)) {
      assert.equal(after.buildings.some(b => b.id === id), false);
      assert.deepEqual(liveReferences(after, id), [], 'Final receipt clears every live marker and assignment');
    }
    return RES.some(r => picked[r] || received[r]);
  }
  async function physicalUntil(p, id, predicate, label, seconds = 180) {
    let s = await read(p);
    // 100ms of wall clock can cover seven 16ms animation frames plus accumulator
    // residue. Use 50ms to prevent two ordinary ticks from hiding a zero-walk
    // pickup and receipt in one observation; physicalStep checks the actual delta.
    for (let elapsed = 0; !predicate(s) && elapsed < seconds * 1000; elapsed += 50) {
      const next = await advance(p, 50), transitioned = physicalStep(s, next, id, label); s = next;
      if (transitioned) {
        const boundary = active.label + '-physical-' + report.transitions.length;
        assert.deepEqual(JSON.parse(await exported(p, boundary)), s,
          'Every actual pickup/receipt Pause-save snapshot agrees with the ordinary Journey export');
        await p.screenshot({path: path.join(DIR, boundary + '.png'), fullPage: true});
      }
    }
    assert.ok(predicate(s), 'Timed out observing physical recovery: ' + label); return s;
  }
  async function holdWithMove(p, siteId, label) {
    const before = await read(p), carrier = before.units.find(u => u.id === 'u0');
    assert.equal(carrier.cargo, 5); assert.equal(carrier.reclaim.claimId, siteId);
    await select(p, ['u0']); await p.locator('#move').click(); await mapClick(p, 5.5, 16.5);
    const moving = await read(p), admitted = moving.units.find(u => u.id === 'u0');
    assert.equal(admitted.phase, 'carryMove'); assert.deepEqual(admitted.order, {kind: 'move', x: 5, y: 16});
    for (const field of ['x', 'y', 'cargo', 'resource', 'work', 'reclaim']) {
      assert.deepEqual(admitted[field], carrier[field], 'Move admission preserves actual custody/work/position: ' + field);
    }
    assert.equal(moving.time, before.time); assert.deepEqual(moving.stock, before.stock); assert.deepEqual(moving.spent, before.spent);
    assert.deepEqual(claim(moving, siteId).unreleased, claim(before, siteId).unreleased);
    assert.deepEqual(claim(moving, siteId).assigned, [], 'Loaded Move revokes future recovery pickup authority');
    const raw = await exported(p, label + '-accepted-carryMove');
    const first = await physicalUntil(p, siteId, s => s.time > moving.time, label + ' first actual movement tick', 2);
    const firstCarrier = first.units.find(u => u.id === 'u0');
    const distance = Math.hypot(firstCarrier.x - admitted.x, firstCarrier.y - admitted.y);
    assert.ok(distance > 0 && distance <= 3 * (first.time - moving.time) + .000001,
      'Loaded Move begins real bounded travel on its first actual simulation tick');
    const held = await physicalUntil(p, siteId, s => s.units.find(u => u.id === 'u0').phase === 'idle', label + ' arrival', 40);
    const arrived = held.units.find(u => u.id === 'u0');
    assert.deepEqual({x: arrived.x, y: arrived.y}, {x: 5, y: 16}, 'Held load reaches the exact commanded destination');
    assert.equal(arrived.cargo, carrier.cargo); assert.equal(arrived.resource, carrier.resource);
    assert.deepEqual(arrived.reclaim, carrier.reclaim);
    return {state: held, raw};
  }
  async function open(label, origin, {seed = null, fault = null, instrumentation = false, route = 'hearth-rts.html'} = {}) {
    const context = await browser.newContext({viewport: {width: 1440, height: 1200},
      recordVideo: {dir: path.join(DIR, 'video', label), size: {width: 1440, height: 1200}}});
    contexts.push(context);
    await context.addInitScript(({label, seed, fault, instrumentation}) => {
      window.__reclaimInput = [];
      window.addEventListener('storage', e => window.__reclaimInput.push({scenario: label,
        name: 'storage', target: e.key, trusted: e.isTrusted}));
      for (const name of ['pointerdown', 'pointerup', 'contextmenu', 'keydown', 'keyup', 'click', 'change']) {
        document.addEventListener(name, e => window.__reclaimInput.push({scenario: label, name,
          target: e.target.id || e.target.closest?.('[data-unit]')?.dataset.unit || e.target.tagName,
          key: e.key || null, button: e.button, trusted: e.isTrusted}), true);
      }
      if (!instrumentation) return;
      // Explicit Storage fault instrumentation only; no game object or engine API is touched.
      const get = Storage.prototype.getItem, set = Storage.prototype.setItem;
      const remove = Storage.prototype.removeItem, clear = Storage.prototype.clear;
      const flag = '__reclaim-storage-fixture-seeded', config = '__reclaim-storage-fault';
      if (!get.call(sessionStorage, flag)) {
        for (const [key, raw] of Object.entries(seed || {})) set.call(localStorage, key, raw);
        set.call(sessionStorage, config, JSON.stringify(fault)); set.call(sessionStorage, flag, 'yes');
      }
      const probe = window.__reclaimStorageProbe = {nativeGet: get, fault: JSON.parse(get.call(sessionStorage, config)), calls: [],
        arm(value) { this.fault = value; set.call(sessionStorage, config, JSON.stringify(value)); },
        clear() { this.arm(null); }};
      for (const [method, original] of [['getItem', get], ['setItem', set], ['removeItem', remove], ['clear', clear]]) {
        Storage.prototype[method] = function (...args) {
          if (this !== localStorage) return Reflect.apply(original, this, args);
          const failed = probe.fault?.method === method && args[0] === probe.fault.key;
          probe.calls.push({method, key: args[0] ?? null, failed});
          if (failed) throw new DOMException('Labelled reclaim QA Storage failure', 'QuotaExceededError');
          return Reflect.apply(original, this, args);
        };
      }
    }, {label, seed, fault, instrumentation});
    const p = await context.newPage(); active = {label, page: p, context};
    p.setDefaultTimeout(15000); p.setDefaultNavigationTimeout(30000);
    p.on('pageerror', e => report.pageErrors.push({scenario: label, message: e.message}));
    await p.clock.install({time: new Date('2026-01-01T00:00:00Z')});
    const response = await p.goto(origin + '/' + route); assert.ok(response?.ok());
    assert.equal(sha(await response.body()), report.built[route].sha256, 'Serve exactly the coordinator-built artifact');
    if (route === 'hearth-rts.html') {
      await p.locator('[data-unit="u0"]').waitFor();
      if (await p.locator('#pause').innerText() === 'Pause') await p.locator('#pause').click();
    }
    await p.clock.pauseAt(new Date('2026-01-01T01:00:00Z'));
    report.scenarios.push({label, instrumentation: instrumentation ? 'Labelled isolated Storage seed/fault fixture' : 'Ordinary controls only'});
    return p;
  }
  async function close(p) {
    await drain(p); if (await p.evaluate(() => !!window.__reclaimStorageProbe)) {
      writeJSON(active.label + '-storage-calls.json', await p.evaluate(() => window.__reclaimStorageProbe.calls));
    }
    await p.context().close(); persistReport();
  }

  try {
    assert.ok(process.env.LEGACY_RECLAIM_WITNESS,
      'LEGACY_RECLAIM_WITNESS is REQUIRED: dispatch the genuine pinned old-browser witness first; never synthesize or skip it');
    const witnessFile = path.resolve(process.env.LEGACY_RECLAIM_WITNESS);
    const provenanceFile = process.env.LEGACY_RECLAIM_WITNESS_REPORT || path.join(path.dirname(witnessFile), 'report.json');
    fixtureRaw = fs.readFileSync(witnessFile, 'utf8');
    const provenance = JSON.parse(fs.readFileSync(provenanceFile, 'utf8')); legacy = witness(fixtureRaw, provenance);
    report.witness = {file: witnessFile, report: provenanceFile, sha256: sha(fixtureRaw), provenanceSha256: sha(fs.readFileSync(provenanceFile))};
    fs.writeFileSync(path.join(DIR, 'genuine-legacy-input.json'), fixtureRaw);
    report.built = Object.fromEntries(['hearth-rts.html', 'index.html'].map(name => {
      const bytes = fs.readFileSync(path.join(ROOT, 'dist', name)); return [name, {bytes: bytes.length, sha256: sha(bytes)}];
    }));
    for (const file of [...Object.keys(OLD_HASHES), 'src/campaign-navigation/adapter.cjs',
      'src/campaign-navigation/browser.js', 'src/view.js', 'tests/browser/hearth-reclaim.cjs']) {
      report.sourceHashes[file] = sha(fs.readFileSync(path.join(ROOT, file)));
    }
    for (const [built, sources] of [['hearth-rts.html', ['src/hearth-rts/engine.js', 'src/hearth-rts/view.js']],
      ['index.html', ['src/hearth-rts/engine.js', 'src/campaign-navigation/adapter.cjs', 'src/campaign-navigation/browser.js', 'src/view.js']]]) {
      const html = fs.readFileSync(path.join(ROOT, 'dist', built), 'utf8');
      for (const file of sources) assert.ok(html.includes(fs.readFileSync(path.join(ROOT, file), 'utf8')),
        'Coordinator build must embed the dispatched source exactly: ' + built + ' / ' + file);
    }
    server = http.createServer((req, res) => {
      const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
      const name = pathname === '/' ? 'index.html' : pathname.slice(1);
      if (!['index.html', 'hearth-rts.html'].includes(name)) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'}); res.end(fs.readFileSync(path.join(ROOT, 'dist', name)));
    });
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const origin = 'http://127.0.0.1:' + server.address().port;
    browser = await playwright.chromium.launch({headless: true, chromiumSandbox: true});

    // PRIMARY: actual old-executable export, imported unchanged through the file control.
    {
      const p = await open('genuine-old-world-rescue', origin);
      await importText(p, fixtureRaw, 'genuine-old-world');
      let s = await read(p); assert.equal(s.version, 5); assert.equal(s.reclaim.claims.length, 6);
      for (const field of ['stock', 'spent', 'delivered', 'deposits', 'units', 'time', 'tools', 'knapping']) {
        assert.deepEqual(s[field], legacy[field], 'Adoption does not invent play: ' + field);
      }
      assert.equal((await storage(p))[KEY + '.import-before-v5'], fixtureRaw);
      await checkpoint(p, 'primary-imported-old-world', s);
      const site = s.buildings.find(b => b.kind === 'outpost' && b.x === 0 && b.y === 8);
      assert.ok(site, 'The actual witness must contain its ordinary-controls western recovery target');
      await inspect(p, site);
      assert.equal(await p.locator('#outpost-reclaim').innerText(), 'Recover this outpost');
      assert.equal(await p.locator('#outpost-reclaim').isDisabled(), true);
      assert.match(await p.locator('#reclaim-status').innerText(), /select|villagers/i);
      assert.deepEqual(await read(p), s, 'An invalid empty selection/quote has no economic mutation');
      await select(p, ['u0']); await inspect(p, site); await p.locator('#outpost-reclaim').click();
      const committed = await read(p); assert.deepEqual(committed.stock, legacy.stock); assert.deepEqual(committed.spent, legacy.spent);
      assert.deepEqual(claim(committed, site.id).unreleased, BILL);
      assert.equal(committed.buildings.find(b => b.id === site.id).retiring, true);
      assert.equal(committed.storage.stores[site.id], undefined);
      assert.equal(await p.locator('#outpost-reclaim').innerText(), 'Resume recovery with selected villagers');
      assert.match(await p.locator('#reclaim-capital').innerText(), /Still in structure:.*60 wood.*20 stone/);
      for (let i = 0; i < 3; i++) await p.locator('#outpost-reclaim').click();
      assert.deepEqual(await read(p), committed, 'Repeated paused confirmation creates no additional pickup or allocation');
      await p.clock.runFor(5000); assert.deepEqual(await read(p), committed, 'Pause has no physical transitions');
      await reloadExact(p, 'primary-pre-pickup-reload');
      s = await physicalUntil(p, site.id, v => !!v.units[0].reclaim, 'first real load');
      assert.equal(s.units[0].cargo, 5); assert.equal(s.units[0].resource, 'wood');
      await checkpoint(p, 'primary-first-pickup', s); await reloadExact(p, 'primary-carry-reload');
      await p.locator('#select-all').click(); await inspect(p, site);
      const invalidBefore = await exported(p); await inspect(p, site);
      assert.equal(await p.locator('#outpost-reclaim').isDisabled(), true);
      assert.match(await p.locator('#reclaim-status').innerText(), /Stop and Return|loads|empty/i);
      assert.equal(await exported(p), invalidBefore, 'A mixed loaded/empty invalid group preserves all prior orders');
      const moved = await holdWithMove(p, site.id, 'primary-first-loaded-move');
      carryMoveRaw = moved.raw; s = moved.state;
      assert.equal(s.units[0].cargo, 5); assert.equal(s.units[0].reclaim.claimId, site.id);
      const held = copy(s); await reloadExact(p, 'primary-held-move-reload');
      s = await physicalUntil(p, site.id, v => v.time >= held.time + 1, 'held cargo remains held', 5);
      assert.deepEqual(s.spent, held.spent); assert.deepEqual(s.stock, held.stock); assert.equal(s.units[0].cargo, 5);
      await select(p, ['u0']); await p.locator('#stop').click();
      s = await physicalUntil(p, site.id, v => !v.units[0].reclaim, 'Stop and Return receipt');
      assert.equal(s.units[0].order.kind, 'idle'); assert.deepEqual(claim(s, site.id).assigned, []);
      assert.deepEqual(s.reclaim.recovered, {wood: 5, stone: 0, food: 0});
      await reloadExact(p, 'primary-after-receipt-reload');
      const interrupted = copy(s);
      s = await physicalUntil(p, site.id, v => v.time >= interrupted.time + 1, 'no abandoned-assignment recapture', 5);
      assert.deepEqual(claim(s, site.id).unreleased, claim(interrupted, site.id).unreleased);
      await select(p, ['u0']); await inspect(p, site); await p.locator('#outpost-reclaim').click();
      s = await physicalUntil(p, site.id, v => claim(v, site.id) && RES.every(r => claim(v, site.id).unreleased[r] === 0),
        'final load picked up', 180);
      assert.equal(s.units[0].cargo, 5); assert.equal(s.units[0].resource, 'stone');
      s = (await holdWithMove(p, site.id, 'primary-final-loaded-move')).state;
      assert.ok(s.buildings.some(b => b.id === site.id)); assert.ok(claim(s, site.id));
      await reloadExact(p, 'primary-final-held-load');
      await select(p, ['u0']); await p.locator('#stop').click();
      s = await physicalUntil(p, site.id, v => !v.buildings.some(b => b.id === site.id), 'last actual receipt settles footprint');
      assert.deepEqual(s.stock, {wood: 76, stone: 90, food: 0});
      assert.deepEqual(s.spent, {wood: 340, stone: 130, food: 0});
      assert.deepEqual(s.reclaim.recovered, BILL); assert.deepEqual(s.delivered, legacy.delivered);
      assert.equal(s.reclaim.settledSites, 1); assert.deepEqual(liveReferences(s, site.id), []);
      const observed = report.transitions.filter(t => t.scenario === active.label);
      for (const kind of ['pickup', 'receipt']) for (const r of ['wood', 'stone']) {
        assert.equal(observed.filter(t => t.kind === kind && t.resource === r).length, r === 'wood' ? 12 : 4,
          'Observe every one of the sixteen distinct physical ' + kind + ' transitions');
      }
      await checkpoint(p, 'primary-recovered-60w20s', s);
      await moveAll(p, 6, 16); const easternId = await build(p, 'outpost', 22, 11, 'primary-eastern-outpost');
      s = await read(p); openingFacts(s);
      assert.deepEqual(s.stock, {wood: 16, stone: 70, food: 0});
      assert.deepEqual(s.spent, {wood: 400, stone: 150, food: 0});
      assert.deepEqual(s.delivered, legacy.delivered); assert.equal(s.tools, false); assert.equal(s.knapping, null);
      await p.locator('#select-all').click(); await inspect(p, s.buildings.find(b => b.id === easternId));
      assert.equal(await p.locator('#outpost-reclaim').isDisabled(), true);
      assert.match(await p.locator('#reclaim-status').innerText(), /one usable eastern outpost|eastern.*goal/i);
      rescuedRaw = await exported(p, 'primary-completed-opening');
      await checkpoint(p, 'primary-opening-goal-complete', s); await close(p);
    }

    // Separate fresh, ordinary useful-relocation mechanics session; not the six-outpost stress witness.
    {
      const p = await open('fresh-useful-relocation', origin); let s = await read(p);
      assert.equal(s.version, 5); assert.equal(s.buildings.length, 1);
      for (const id of ['d0', 'd2', 'd1']) {
        const d = s.deposits.find(v => v.id === id); await p.locator('#select-all').click();
        await mapClick(p, d.x + .5, d.y + .5, 'right');
        s = await until(p, v => !v.deposits.find(v => v.id === id).amount && v.units.every(u => !u.cargo && u.phase === 'idle'),
          'fresh finite gathering ' + id, 500, 2000);
      }
      assert.deepEqual(s.stock, {wood: 116, stone: 70, food: 0});
      await moveAll(p, 6, 16); const westId = await build(p, 'outpost', 11, 11, 'fresh-local-outpost');
      await moveAll(p, 25, 13); await moveAll(p, 6, 16); s = await read(p);
      const priorGathered = copy(s.delivered); await select(p, ['u0']);
      await inspect(p, s.buildings.find(b => b.id === westId)); await p.locator('#outpost-reclaim').click();
      s = await physicalUntil(p, westId, v => !v.buildings.some(b => b.id === westId), 'fresh reposition capital');
      assert.deepEqual(s.stock, {wood: 116, stone: 70, food: 0}); assert.deepEqual(s.delivered, priorGathered);
      await moveAll(p, 6, 16); await build(p, 'outpost', 22, 11, 'fresh-eastern-replacement');
      await moveAll(p, 6, 16); await build(p, 'workshop', 12, 16, 'fresh-required-workshop');
      s = await read(p); openingFacts(s); assert.deepEqual(s.reclaim.recovered, BILL);
      await checkpoint(p, 'fresh-useful-relocation-complete', s); await close(p);
    }

    // SUPPLEMENTARY: explicit Storage failures. No result here is primary earned-play evidence.
    for (const fault of [{method: 'getItem', key: KEY}, {method: 'getItem', key: KEY + '.before-v5'},
      {method: 'setItem', key: KEY + '.before-v5'}, {method: 'setItem', key: KEY}]) {
      const label = 'startup-' + fault.method + '-' + (fault.key === KEY ? 'main' : 'backup');
      const p = await open(label, origin, {seed: {[KEY]: fixtureRaw}, fault, instrumentation: true});
      assert.ok(await p.evaluate(fault => window.__reclaimStorageProbe.calls.some(c =>
        c.failed && c.method === fault.method && c.key === fault.key), fault), 'The intended startup fault boundary was reached');
      const calls = await p.evaluate(() => window.__reclaimStorageProbe.calls);
      assert.equal(calls.some(c => c.method === 'setItem' && c.key === KEY && !c.failed), false,
        'Failed startup performs no successful main write');
      if (fault.method === 'getItem') assert.equal(calls.some(c => c.method === 'setItem'), false,
        'Resolve every required startup read before writing any preservation record');
      assert.equal((await storage(p))[KEY], fixtureRaw, 'Failed startup preserves exact original KEY bytes');
      assert.equal(await p.locator('#stop').isDisabled(), true);
      if (fault.method === 'getItem' && fault.key === KEY) assert.equal(await p.locator('#export').isDisabled(), true);
      else assert.equal(await exported(p, label + '-original'), fixtureRaw, 'Failed adoption exports original, never uncommitted candidate');
      await p.clock.runFor(2500); assert.equal((await storage(p))[KEY], fixtureRaw);
      await p.screenshot({path: path.join(DIR, label + '.png'), fullPage: true});
      await p.evaluate(() => window.__reclaimStorageProbe.clear()); await drain(p); await p.reload();
      await p.locator('[data-unit="u0"]').waitFor(); const recovered = await read(p, label + '-recovered');
      assert.equal(recovered.version, 5); assert.equal(await p.locator('#stop').isDisabled(), false);
      assert.equal((await storage(p))[KEY + '.before-v5'], fixtureRaw);
      await close(p);
    }
    for (const dedup of [false, true]) {
      const seed = {[KEY]: fixtureRaw, [KEY + '.before-v5']: fixtureRaw + ' '};
      if (dedup) seed[KEY + '.before-v5.1'] = fixtureRaw;
      const p = await open('startup-collision-' + (dedup ? 'dedup' : 'append'), origin, {seed, instrumentation: true});
      const saved = await storage(p); assert.equal(saved[KEY + '.before-v5'], fixtureRaw + ' ');
      assert.equal(saved[KEY + '.before-v5.1'], fixtureRaw); assert.equal(saved[KEY + '.before-v5.2'], undefined);
      assert.equal((await read(p)).version, 5); await close(p);
    }
    let retainedForNavigation;
    const importFaults = ['.import-before-v5', '.outgoing-before-import-v5', '.stored-before-import-v5', '']
      .flatMap(suffix => ['getItem', 'setItem'].map(method => ({method, key: KEY + suffix})));
    for (const fault of importFaults) {
      const label = 'import-' + fault.method + '-' + (fault.key === KEY ? 'main' : fault.key.slice(KEY.length + 1));
      const p = await open(label, origin, {instrumentation: true});
      // A real 0.5 seconds of unsaved live play: Resume saved the prior durable camp,
      // Journey pauses frames without saving, so the two required outgoing copies differ.
      await p.locator('#pause').click(); await p.clock.runFor(500); await p.locator('#journey').click();
      const outgoing = await exported(p, label + '-outgoing-live', false), prior = (await storage(p))[KEY];
      assert.notEqual(outgoing, prior, 'Test outgoing LIVE camp newer than its prior durable autosave');
      const faultAt = await p.evaluate(fault => {
        window.__reclaimStorageProbe.arm(fault); return window.__reclaimStorageProbe.calls.length;
      }, fault);
      await importText(p, fixtureRaw, label, false);
      assert.ok(await p.evaluate(fault => window.__reclaimStorageProbe.calls.some(c =>
        c.failed && c.method === fault.method && c.key === fault.key), fault), 'The intended import fault boundary was reached');
      const calls = await p.evaluate(start => window.__reclaimStorageProbe.calls.slice(start), faultAt);
      assert.equal(calls.some(c => c.method === 'setItem' && c.key === KEY && !c.failed), false,
        'Failed import performs no successful main write');
      if (fault.method === 'getItem') assert.equal(calls.some(c => c.method === 'setItem'), false,
        'Resolve every required import read before writing any preservation record');
      assert.equal((await storage(p))[KEY], prior, 'Failed incoming adoption preserves prior durable source exactly');
      assert.equal(await exported(p, label + '-failed-original', false), outgoing, 'Failed import retains outgoing LIVE export exactly');
      assert.equal(await p.locator('#pause').innerText(), 'Resume');
      assert.match(await p.locator('#save-status').innerText(), /previous camp|previous.*unchanged/i);
      await p.screenshot({path: path.join(DIR, label + '.png'), fullPage: true});
      await p.locator('#close').click(); await p.clock.runFor(2500);
      assert.equal((await storage(p))[KEY], prior, 'Closing failure does not overwrite the prior durable source');
      await p.evaluate(() => window.__reclaimStorageProbe.clear());
      await importText(p, fixtureRaw, label + '-retry'); const s = await read(p);
      assert.equal(s.version, 5); assert.deepEqual(s.stock, legacy.stock);
      const kept = await storage(p);
      assert.equal(kept[KEY + '.import-before-v5'], fixtureRaw);
      assert.equal(kept[KEY + '.outgoing-before-import-v5'], outgoing);
      assert.equal(kept[KEY + '.stored-before-import-v5'], prior);
      retainedForNavigation = kept; await close(p);
    }
    {
      const p = await open('import-collision-dedup', origin, {instrumentation: true});
      await importText(p, fixtureRaw, 'collision-a'); await importText(p, fixtureRaw, 'collision-a-again');
      assert.equal((await storage(p))[KEY + '.import-before-v5.1'], undefined);
      const second = '\n' + fixtureRaw + ' ', third = ' \n' + fixtureRaw + '\n ';
      await importText(p, second, 'collision-b'); const before = await exported(p), prior = (await storage(p))[KEY];
      await p.evaluate(key => window.__reclaimStorageProbe.arm({method: 'setItem', key}), KEY);
      await importText(p, third, 'collision-c-fails-main', false);
      const saved = await storage(p); assert.equal(saved[KEY], prior);
      assert.equal(saved[KEY + '.import-before-v5'], fixtureRaw);
      assert.equal(saved[KEY + '.import-before-v5.1'], second); assert.equal(saved[KEY + '.import-before-v5.2'], third);
      assert.equal(saved[KEY + '.import-before-v5.3'], undefined);
      assert.equal(await exported(p, 'collision-c-retains-live'), before);
      await p.evaluate(() => window.__reclaimStorageProbe.clear()); await importText(p, third, 'collision-c-retry');
      assert.equal((await storage(p))[KEY + '.import-before-v5.3'], undefined);
      retainedForNavigation = {...retainedForNavigation, ...await storage(p)}; await close(p);
    }

    // Isolated rejected-source custody regression. A genuine second browser tab
    // replaces/deletes durable KEY after startup has retained unsupported A in
    // its recovery exporter. Neither B nor deletion may discard that original A.
    for (const replacement of ['different-source', 'deleted-key']) {
      const originalA = ' \n' + JSON.stringify({...legacy, version: 6}) + '\n';
      const durableB = replacement === 'different-source' ? '\n' + fixtureRaw + ' ' : null;
      const label = 'rejected-original-external-tab-' + replacement;
      const p = await open(label, origin, {seed: {[KEY]: originalA}, instrumentation: true});
      assert.equal(await p.locator('#stop').isDisabled(), true);
      assert.equal(await exported(p, label + '-original-a'), originalA);
      const other = await p.context().newPage(); await other.goto(origin + '/index.html');
      await other.evaluate(({key, raw}) => {
        if (raw === null) localStorage.removeItem(key); else localStorage.setItem(key, raw);
      }, {key: KEY, raw: durableB});
      await p.waitForFunction(key => window.__reclaimInput.some(e => e.name === 'storage' && e.target === key && e.trusted), KEY);
      assert.equal((await storage(p))[KEY] ?? null, durableB);
      assert.equal(await exported(p, label + '-still-original-a'), originalA,
        'External durable change does not change the rejected source still offered for export');
      await importText(p, fixtureRaw, label + '-incoming-c');
      const current = await read(p); assert.equal(current.version, 5); assert.deepEqual(current.stock, legacy.stock);
      const saved = await storage(p), originals = Object.entries(saved)
        .filter(([key]) => key === KEY + '.stored-before-import-v5' || key.startsWith(KEY + '.stored-before-import-v5.'));
      assert.equal(originals.filter(([, raw]) => raw === originalA).length, 1,
        'Successful C import durably preserves exact previously rejected A before clearing recovery state');
      if (durableB !== null) assert.equal(originals.filter(([, raw]) => raw === durableB).length, 1,
        'Distinct current durable B is preserved separately from A');
      assert.equal(saved[KEY + '.import-before-v5'], fixtureRaw);
      assert.deepEqual(JSON.parse(saved[KEY]), current);
      writeJSON(label + '-retained-originals.json', originals);
      await checkpoint(p, label + '-committed-c', current); await other.close(); await close(p);
    }

    // Compatible edited-source negative control: old reader accepts an altered initial
    // quantity, but canonical capital must not be certified or silently repaired.
    const uncertified = copy(legacy); uncertified.deposits[0].initial++;
    const uncertifiedRaw = ' \n' + JSON.stringify(uncertified, null, 2) + '\n';
    {
      const p = await open('compatible-uncertified-legacy', origin,
        {seed: {[KEY]: uncertifiedRaw}, instrumentation: true});
      let s = await read(p); assert.equal(s.version, 4); assert.equal(s.reclaim, undefined);
      assert.deepEqual(s.deposits, uncertified.deposits); assert.equal((await storage(p))[KEY + '.before-v5'], uncertifiedRaw);
      await select(p, ['u0']); await inspect(p, s.buildings.find(b => b.kind === 'outpost'));
      assert.equal(await p.locator('#outpost-reclaim').isDisabled(), true);
      assert.match(await p.locator('#reclaim-status').innerText(), /unavailable.*canonical|finite source|original/i);
      await moveAll(p, 6, 17); s = await read(p); assert.equal(s.version, 4);
      assert.ok(s.time > legacy.time, 'Certification failure preserves ordinary legacy play');
      await checkpoint(p, 'uncertified-legacy-still-playable', s); await close(p);
    }

    // SUPPLEMENTARY native navigation host: controlled completed Cave fixture only.
    // The built page mounts its own navigation; no helper mount or game API is called.
    const cave = {version: 1, rng: 17, tradition: 0, claimed: [false, false, false], campaignMs: 0,
      campaignActions: 0, everCompleted: true, baseline: null, records: [], discovered: {}, settings: {reducedMotion: false},
      run: {food: [{kind: 'plant', amount: 18}], water: 18, innovation: 1200, fibers: 0, stones: [], searches: 0,
        bedding: 0, route: false, signals: false, slots: 0,
        counts: {forage: 0, scavenge: 0, water: 0, stone: 0, fiber: 0, grunt: 0, gesture: 0},
        lastExpression: null, phase: 0, runMs: 0, actions: 0, event: 4, complete: true, routinesPaused: false}};
    for (const [kind, incoming] of [['certified-v5', rescuedRaw], ['certified-carryMove-v5', carryMoveRaw],
      ['uncertified-v4', uncertifiedRaw]]) {
      const seed = {...retainedForNavigation, [KEY]: incoming, [KEY + '.before-v5']: fixtureRaw,
        [KEY + '.before-v5.1']: uncertifiedRaw, 'singularity-clicker.cave.v1': JSON.stringify(cave)};
      const p = await open('native-navigation-' + kind, origin, {seed, instrumentation: true, route: 'index.html'});
      const before = await storage(p);
      // Host startup and fixture seeding are complete. Bound the read-only native
      // inspection/export window before intentional pagehide/destination saves.
      const navigationAt = await p.evaluate(() => window.__reclaimStorageProbe.calls.length);
      await p.locator('#event-action').click();
      await p.locator('[data-navigation-action="open-hearth"]:enabled').waitFor();
      assert.match(await p.locator('[data-navigation-status]').innerText(), /Continue.*Hearth opening/);
      await p.locator('[data-navigation-backups] summary').click();
      const families = {rtsBackupV5: '.before-v5', rtsImportBackupV5: '.import-before-v5',
        rtsOutgoingBackupV5: '.outgoing-before-import-v5', rtsStoredBackupV5: '.stored-before-import-v5'};
      for (const [family, suffix] of Object.entries(families)) {
        assert.equal(await download(p, '[data-navigation-action="export:' + family + '"]', kind + '-' + family), before[KEY + suffix]);
      }
      assert.equal(await download(p, '[data-navigation-action="export:rts"]', kind + '-current-navigation-original'), incoming);
      for (const suffix of ['.before-v5.1', '.import-before-v5.1', '.import-before-v5.2']) {
        assert.equal(await download(p, '[data-navigation-action="export-backup:' + KEY + suffix + '"]', kind + '-extra-' + suffix.slice(1)), before[KEY + suffix]);
      }
      assert.deepEqual(await storage(p), before, 'Native navigation and original backup exports are read-only for all RTS sources');
      const navigationCalls = await p.evaluate(start => window.__reclaimStorageProbe.calls.slice(start), navigationAt);
      const mutations = navigationCalls.filter(c => ['setItem', 'removeItem', 'clear'].includes(c.method));
      assert.deepEqual(mutations, [],
        'Native inspection/exports make zero Storage mutations, including identical writes and transient create/delete');
      writeJSON('navigation-' + kind + '-read-only-window.json', navigationCalls);
      await p.screenshot({path: path.join(DIR, 'navigation-' + kind + '-backups.png'), fullPage: true});
      await drain(p); await p.locator('[data-navigation-action="open-hearth"]').click();
      await p.waitForURL('**/hearth-rts.html'); await p.locator('[data-unit="u0"]').waitFor();
      const s = await read(p, kind + '-actual-destination'); assert.equal(s.version, kind === 'uncertified-v4' ? 4 : 5);
      assert.equal(await p.locator('#pause').innerText(), 'Resume');
      if (kind !== 'uncertified-v4') {
        assert.equal(await exported(p), incoming);
        if (kind === 'certified-carryMove-v5') {
          assert.equal(s.units[0].phase, 'carryMove'); assert.equal(s.units[0].cargo, 5);
          assert.equal(s.units[0].reclaim.claimId, JSON.parse(carryMoveRaw).units[0].reclaim.claimId);
        }
      }
      else {
        assert.equal(s.reclaim, undefined); assert.deepEqual(s.deposits, uncertified.deposits);
        assert.ok(Object.values(await storage(p)).includes(uncertifiedRaw), 'Exact uncertified original survives actual destination');
      }
      await close(p);
    }

    assert.deepEqual(report.pageErrors, []);
    const primaryEvents = report.events.filter(e => e.scenario === 'genuine-old-world-rescue');
    for (const target of ['world', 'pause', 'outpost-reclaim', 'stop', 'move', 'export']) {
      assert.ok(primaryEvents.some(e => e.trusted && e.target === target), 'Trusted primary input evidence for ' + target);
    }
    assert.ok(report.events.some(e => e.scenario === 'fresh-useful-relocation' && e.trusted && e.name === 'contextmenu'));
    report.status = 'passed';
    console.log('PASS candidate reclaim browser gates: genuine legacy rescue, 16 observed loads, held custody, eastern construction, fresh relocation, persistence faults, and native navigation. Clock-controlled regression is not human enjoyment acceptance.');
  } catch (error) {
    report.status = 'failed'; report.failure = {message: String(error), stack: error.stack || null, scenario: active?.label || 'required-witness-preflight'};
    if (active?.page && !active.page.isClosed()) {
      const p = active.page;
      await p.screenshot({path: path.join(DIR, 'failure.png'), fullPage: true, timeout: 10000}).catch(() => {});
      report.failure.body = await p.locator('body').innerText({timeout: 5000}).catch(() => 'unavailable');
      report.failure.storage = await storage(p).catch(() => null); await drain(p).catch(() => {});
      if (await p.locator('#export:enabled').count().catch(() => 0)) {
        await exported(p, 'failure-live-export').catch(() => {});
      }
    }
    if (lastObserved) fs.writeFileSync(path.join(DIR, 'failure-last-observed-export.json'), lastObserved.raw);
    throw error;
  } finally {
    report.elapsedWallSeconds = (Date.now() - started) / 1000; persistReport();
    for (const context of contexts) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    if (server) await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {console.error(error); process.exitCode = 1;});
