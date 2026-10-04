/* Supplementary Spark-only allocation comparison. Author/read on M6; execute only
 * in the separately queued immutable Spark candidate. No engine import, grants,
 * authored camp, storage writes, hidden Camp, source patches or network dependency.
 * Fresh ordinary UI earns one checkpoint; each branch imports its exact Journey
 * bytes. Native Pause saves are observations, verified by Journey at custody and
 * policy boundaries. Clock control measures mechanics, not human pacing or fun.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const http = require('node:http'), zlib = require('node:zlib'), {once} = require('node:events');
const playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const ROOT = path.resolve(__dirname, '../..');
const DIR = path.join(ROOT, 'artifacts/hearth-construction-allocation');
const KEY = 'singularity-clicker.hearth-rts.v1';
const PROFILE = 'accepted-opening.physical-construction.v1';
const RES = ['wood', 'stone', 'food'], ORIGINAL = ['u0', 'u1', 'u2', 'u3'];
const TOTAL = {wood: 416, stone: 220, food: 225}, BILL = {wood: 60, stone: 20, food: 0};
const vector = fn => Object.fromEntries(RES.map(r => [r, fn(r)]));
const zero = () => vector(() => 0), copy = x => JSON.parse(JSON.stringify(x));
const sha = x => crypto.createHash('sha256').update(x).digest('hex');
const actor = (s, id) => s.units.find(u => u.id === id);
const building = (s, id) => s.buildings.find(b => b.id === id);
const site = (s, id) => s.construction.sites.find(c => c.buildingId === id);
const deposit = (s, id) => s.deposits.find(d => d.id === id);
const cargo = (s, r) => s.units.filter(u => u.resource === r).reduce((n, u) => n + u.cargo, 0);
const reserved = (s, r, id) => s.construction.sites.reduce((n, c) => n + c.sources
  .filter(p => p.resource === r && (!id || p.storeId === id)).reduce((m, p) => m + p.amount, 0), 0);
const freeFood = s => s.storage.stores.b0.food - reserved(s, 'food', 'b0');
function adjacent(u, b) {
  const size = b.kind === 'hearth' ? 3 : b.kind === 'outpost' ? 2 : 1;
  const near = (a, v) => Math.abs(a - v) < .00001;
  for (let i = 0; i < size; i++) if (near(u.x, b.x - 1) && near(u.y, b.y + i)
    || near(u.x, b.x + size) && near(u.y, b.y + i)
    || near(u.y, b.y - 1) && near(u.x, b.x + i)
    || near(u.y, b.y + size) && near(u.x, b.x + i)) return true;
  return false;
}
function matter(s) {
  assert.equal(s.version, 6); assert.equal(s.construction.profile, PROFILE);
  assert.deepEqual(s.storage.transfers, []); assert.deepEqual(s.storage.transferred, zero());
  assert.deepEqual(s.reclaim.recovered, zero()); assert.equal(s.tools, false);
  assert.deepEqual(s.stock, vector(r => Object.values(s.storage.stores).reduce((n, v) => n + v[r], 0)));
  assert.deepEqual(vector(r => s.deposits.filter(d => d.kind === r).reduce((n, d) => n + d.amount, 0)
    + s.stock[r] + cargo(s, r) + s.spent[r]
    + s.construction.sites.reduce((n, c) => n + c.staged[r], 0)), TOTAL,
  'Finite wild resources + actual stores + cargo + onsite supplies + spent are conserved');
  for (const u of s.units) {
    assert.ok(Number.isInteger(u.cargo) && u.cargo >= 0 && u.cargo <= 5);
    assert.ok(!u.transfer && !u.reclaim, 'Comparison does not borrow transfer or reclaim output');
  }
  for (const c of s.construction.sites) {
    assert.equal(c.state, 'active'); assert.equal(building(s, c.buildingId).kind, 'outpost');
    assert.deepEqual(c.released, zero()); assert.deepEqual(c.returned, zero());
    assert.deepEqual(vector(r => c.sources.filter(p => p.resource === r).reduce((n, p) => n + p.amount, 0)
      + c.staged[r] + s.units.filter(u => u.supply?.siteId === c.buildingId && u.resource === r)
        .reduce((n, u) => n + u.cargo, 0)), BILL);
    assert.deepEqual(vector(r => c.origins.filter(p => p.resource === r).reduce((n, p) => n + p.amount, 0)), c.staged);
    if (building(s, c.buildingId).work > 0) assert.deepEqual(c.staged, BILL);
  }
  for (const [id, v] of Object.entries(s.storage.stores)) for (const r of RES) assert.ok(v[r] >= reserved(s, r, id));
}
function inventory(s) {
  return {stock: copy(s.stock), stores: copy(s.storage.stores), spent: copy(s.spent), delivered: copy(s.delivered),
    reserved: vector(r => reserved(s, r)), staged: vector(r => s.construction.sites.reduce((n, c) => n + c.staged[r], 0)),
    cargo: vector(r => cargo(s, r)), deposits: s.deposits.map(d => ({id: d.id, resource: d.kind, remaining: d.amount})),
    actors: s.units.map(u => ({id: u.id, x: u.x, y: u.y, phase: u.phase, order: u.order, next: u.next,
      cargo: u.cargo, resource: u.resource, dropoff: u.dropoff || null, supply: u.supply || null}))};
}

(async () => {
  fs.mkdirSync(DIR, {recursive: true});
  const started = Date.now(), deadline = started + 870000;
  const manifest = {source: {}, build: {}};
  for (const file of ['src/hearth-rts/engine.js', 'src/hearth-rts/view.js', 'src/hearth-rts/shell.html',
    'src/hearth-rts/styles.css', 'build.mjs', 'tests/browser/hearth-construction-allocation.cjs']) {
    manifest.source[file] = sha(fs.readFileSync(path.join(ROOT, file)));
  }
  const html = fs.readFileSync(path.join(ROOT, 'dist/hearth-rts.html'), 'utf8');
  manifest.build['dist/hearth-rts.html'] = sha(html);
  for (const file of ['src/hearth-rts/engine.js', 'src/hearth-rts/view.js']) {
    assert.ok(html.includes(fs.readFileSync(path.join(ROOT, file), 'utf8')), 'Build contains exact candidate source: ' + file);
  }
  const binding = sha(JSON.stringify(manifest));
  const report = {status: 'running', manifest, binding, sourceCommit: process.env.ALLOCATION_SOURCE_COMMIT || null,
    bounds: {wallSeconds: 870, branchSimulationSeconds: 600, materialSampleSeconds: .100001, branchClockPulseMilliseconds: 80},
    method: 'Fresh ordinary earned/scouted UI camp; exact native Journey imports; trusted UI commands; controlled clock; combined per-actor material audit',
    protocol: {
      start: '116 wood, 70 stone, 0 food; d0/d1/d2 exhausted; d3 has 75 food; original four idle at the same western positions; east scouted',
      endpoint: 'First observed usable outpost at (22,11), five villagers, actual Hearth recruitment expenditure 25 food, and at least 20 newly gathered wood received into that named eastern store',
      A: 'Original four build; on completion gather western food; first Hearth food >=25 recruits u4; immediately all five gather eastern wood',
      B: 'u0 builds while u1-u3 gather western food; first Hearth food >=25 recruits u4; immediately u1-u4 join the same site while u0 continues; on completion all five gather eastern wood',
      C: 'Original four gather western food; first Hearth food >=25 recruits u4; immediately place same site with all five; on completion all five gather eastern wood',
      reactions: 'First observed 0.1-second simulation boundary, equal for every branch; commands and evidence collection are paused and add zero simulation time',
      cargo: 'Changing ordinary work uses native return-first behavior; no Stop/empty-cargo barrier or forced endpoint returns in a branch',
      winner: 'No ranking asserted in advance; report measured times together with finite resources, overshoot and outstanding cargo'
    }, setup: null, branches: [], checkpoints: [], actions: [], transitions: [], errors: [],
    limits: ['Supplementary mechanics comparison, not a human pacing, enjoyment, balance or full-campaign acceptance claim',
      'Worker-time categories describe observed 0.1-second state intervals; a final completion tick can include sub-tick order clearing',
      'Journal hashes bind evidence files, not independent authentication; coordinator must review returned artifacts']};
  const persist = () => fs.writeFileSync(path.join(DIR, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  const guard = () => assert.ok(Date.now() < deadline, '870-second internal deadline exceeded');
  const tracePath = path.join(DIR, 'observations.jsonl.gz');
  const traceFile = fs.createWriteStream(tracePath), trace = zlib.createGzip();
  trace.pipe(traceFile);
  let traceFailure = null;
  trace.on('error', e => { traceFailure = e; }); traceFile.on('error', e => { traceFailure = e; });
  let chain = binding, recordCount = 0, sequence = 0, active, browser, server;
  const contexts = [];
  async function journal(kind, value) {
    if (traceFailure) throw traceFailure;
    const row = {sequence: ++recordCount, previousSHA256: chain, binding, scenario: active?.label || null, kind, ...value};
    const serialized = JSON.stringify(row); chain = sha(serialized);
    if (!trace.write(JSON.stringify({...row, sha256: chain}) + '\n')) await once(trace, 'drain');
  }
  async function inputs(p) {
    const rows = await p.evaluate(() => window.__allocationInputs.splice(0));
    if (rows.length) {
      for (const e of rows) {
        const key = e.type + ':' + e.target + ':' + e.trusted;
        active.inputCounts[key] = (active.inputCounts[key] || 0) + 1;
      }
      await journal('trusted-input-observation', {events: rows});
    }
  }
  async function saved(p, why) {
    const raw = await p.evaluate(key => localStorage.getItem(key), KEY), s = JSON.parse(raw);
    matter(s); await inputs(p); await journal('native-pause-save', {why, time: s.time, raw, rawSHA256: sha(raw)});
    return s;
  }
  async function exported(p, label, expected, screenshot = false) {
    guard(); assert.equal(await p.locator('#pause').innerText(), 'Resume');
    await p.locator('#journey').click(); const waiting = p.waitForEvent('download'); await p.locator('#export').click();
    const download = await waiting, file = String(++sequence).padStart(4, '0') + '-' + active.label + '-' + label + '.json';
    await download.saveAs(path.join(DIR, file)); await download.delete(); await p.locator('#close').click();
    const raw = fs.readFileSync(path.join(DIR, file), 'utf8'), s = JSON.parse(raw); matter(s);
    if (expected) assert.deepEqual(s, expected, 'Downloaded Journey equals the observed native save');
    assert.equal(await p.evaluate(key => localStorage.getItem(key), KEY), raw, 'Native save and Journey bytes are identical');
    const row = {binding, scenario: active.label, label, file, sha256: sha(raw), time: s.time, inventory: inventory(s)};
    if (screenshot) {
      // Flush a paused drawing frame so PNG depicts the exported state, without simulation time.
      await p.clock.runFor(120); const image = file.replace(/\.json$/, '.png');
      await p.screenshot({path: path.join(DIR, image), fullPage: true});
      row.screenshot = {file: image, sha256: sha(fs.readFileSync(path.join(DIR, image)))};
      assert.equal(await p.evaluate(key => localStorage.getItem(key), KEY), raw);
    }
    report.checkpoints.push(row); await inputs(p); await journal('journey-checkpoint', {file, rawSHA256: row.sha256, time: s.time});
    persist(); return {raw, s, file};
  }
  async function tick(p, milliseconds = 80) {
    guard(); await p.locator('#pause').click(); await p.clock.runFor(milliseconds); await p.locator('#pause').click();
    return saved(p, 'controlled-' + milliseconds + 'ms');
  }
  async function clickMap(p, x, y, button = 'left') {
    await p.locator('#world').scrollIntoViewIfNeeded(); const box = await p.locator('#world').boundingBox();
    const t = await p.locator('#world').evaluate(c => ({width: c.width, height: c.height,
      x: Number(c.dataset.cameraX || 0), y: Number(c.dataset.cameraY || 0), scale: Number(c.dataset.cameraScale || 1)}));
    const point = {x: box.x + (x * 32 * t.scale + t.x) / t.width * box.width,
      y: box.y + (y * 32 * t.scale + t.y) / t.height * box.height};
    assert.equal(await p.evaluate(q => document.elementFromPoint(q.x, q.y)?.id, point), 'world');
    await p.mouse.click(point.x, point.y, {button});
  }
  async function select(p, ids) {
    for (let i = 0; i < ids.length; i++) await p.locator('[data-unit="' + ids[i] + '"]').click({modifiers: i ? ['Shift'] : []});
  }
  function unchangedMaterials(before, after) {
    assert.equal(after.time, before.time);
    for (const key of ['stock', 'spent', 'delivered', 'deposits', 'construction', 'storage']) assert.deepEqual(after[key], before[key]);
    for (const u of before.units) {
      const v = actor(after, u.id);
      assert.deepEqual([v.x, v.y, v.cargo, v.resource, v.supply], [u.x, u.y, u.cargo, u.resource, u.supply]);
    }
  }
  function assertOrders(s, ids, order) {
    for (const id of ids) {
      const u = actor(s, id); assert.deepEqual(u.next || u.order, order, 'Accepted ordinary work for ' + id);
      if (u.cargo) { assert.equal(u.phase, 'return'); assert.deepEqual(u.next, order); }
    }
  }
  async function gather(p, before, ids, target, label) {
    const d = deposit(before, target); assert.ok(d.amount > 0);
    await select(p, ids); await p.locator('#gather').click(); await clickMap(p, d.x + .5, d.y + .5);
    const after = await saved(p, label); unchangedMaterials(before, after);
    assertOrders(after, ids, {kind: 'gather', target});
    report.actions.push({scenario: active.label, time: after.time, kind: 'gather', ids, target, label,
      loadedBefore: before.units.filter(u => ids.includes(u.id) && u.cargo).map(u => ({id: u.id, cargo: u.cargo, resource: u.resource}))});
    return after;
  }
  async function place(p, before, ids) {
    await select(p, ids); await p.locator('[data-build="outpost"]').click(); await clickMap(p, 22.5, 11.5);
    if (await p.locator('#placement-confirm').isVisible()) await p.locator('#placement-confirm').click();
    const after = await saved(p, 'site-placed'), added = after.buildings.filter(b => !building(before, b.id));
    assert.equal(after.time, before.time); assert.equal(added.length, 1);
    const b = added[0], c = site(after, b.id);
    assert.deepEqual([b.kind, b.x, b.y, b.done, b.work], ['outpost', 22, 11, false, 0]);
    assert.deepEqual(after.stock, before.stock); assert.deepEqual(after.spent, before.spent); assert.deepEqual(after.delivered, before.delivered);
    assert.deepEqual(c.staged, zero()); assert.deepEqual(c.sources, [
      {storeId: 'b0', resource: 'wood', amount: 60}, {storeId: 'b0', resource: 'stone', amount: 20}]);
    for (const u of before.units) {
      const v = actor(after, u.id); assert.deepEqual([v.x, v.y, v.cargo, v.resource], [u.x, u.y, u.cargo, u.resource]);
    }
    assertOrders(after, ids, {kind: 'build', target: b.id});
    active.branch.siteId = b.id; active.branch.milestones.sitePlaced = after.time;
    report.actions.push({scenario: active.label, time: after.time, kind: 'place', ids, siteId: b.id, x: 22, y: 11});
    await exported(p, 'site-reserved', after, true); return after;
  }
  async function joinBuild(p, before, ids) {
    const b = building(before, active.branch.siteId), continuing = copy(actor(before, 'u0'));
    assert.equal(b.done, false, 'Split strategy reaches food threshold while first builder still works');
    await select(p, ids); await clickMap(p, b.x + 1.1, b.y + 1.1, 'right');
    const after = await saved(p, 'join-site'); unchangedMaterials(before, after);
    assert.deepEqual(actor(after, 'u0'), continuing, 'Existing first builder continues without a new order');
    assertOrders(after, ids, {kind: 'build', target: b.id});
    report.actions.push({scenario: active.label, time: after.time, kind: 'join-build', ids, siteId: b.id}); return after;
  }
  async function recruit(p, before) {
    assert.equal(before.units.length, 4); assert.ok(freeFood(before) >= 25);
    active.branch.milestones.foodThreshold = before.time;
    await exported(p, 'food-threshold', before, true); await p.locator('#train').click();
    const after = await saved(p, 'native-invite-paid'); assert.equal(after.time, before.time); assert.equal(after.units.length, 5);
    assert.deepEqual(after.units.slice(0, 4), before.units);
    assert.deepEqual(after.spent, {...before.spent, food: before.spent.food + 25});
    const stores = copy(before.storage.stores); stores.b0.food -= 25; assert.deepEqual(after.storage.stores, stores);
    assert.deepEqual(after.stock, {...before.stock, food: before.stock.food - 25}); assert.deepEqual(after.delivered, before.delivered);
    const newcomer = actor(after, 'u4'); assert.ok(newcomer && adjacent(newcomer, building(after, 'b0')));
    const payment = after.storage.payments.find(v => v.kind === 'recruitment'); assert.ok(payment);
    assert.deepEqual(payment.sources, [{storeId: 'b0', resource: 'food', amount: 25}]);
    active.branch.milestones.recruited = after.time;
    active.branch.recruitment = {time: after.time, hearthFoodBefore: before.storage.stores.b0.food,
      hearthFoodAfter: after.storage.stores.b0.food, payment: copy(payment), position: {x: newcomer.x, y: newcomer.y}};
    report.actions.push({scenario: active.label, time: after.time, kind: 'invite', newActor: 'u4', paid: 25, store: 'b0'});
    await exported(p, 'fifth-villager-paid', after); return after;
  }
  function category(u, s) {
    const work = u.supply || u.supplyPickup || u.order.kind === 'build' ? 'construction'
      : u.resource === 'food' || u.order.target === 'd3' ? 'food' : u.order.target === 'd4' ? 'eastWood' : u.order.kind;
    if (u.phase === 'idle') return 'idle';
    if (u.path.length) return work + 'Travel';
    if (u.phase === 'extract') return work + 'Extraction';
    if (u.phase === 'construct') {
      const c = site(s, u.order.target);
      return c && RES.every(r => c.staged[r] === BILL[r]) ? 'installationReady' : 'siteSupplyWait';
    }
    return work + 'Boundary';
  }
  function combinedStep(before, after) {
    const branch = active.branch, dt = after.time - before.time;
    assert.ok(dt >= 0 && dt <= .100001, 'At most one physical simulation tick between observations');
    assert.equal(after.units.length, before.units.length, 'Recruitment occurs only at an audited native Invite');
    if (!dt) { assert.deepEqual(after, before); branch.zeroTickSamples++; return []; }
    const stores = copy(before.storage.stores), delivered = copy(before.delivered), spent = copy(before.spent);
    const deposits = Object.fromEntries(before.deposits.map(d => [d.id, d.amount])), changes = [];
    const priorSite = site(before, branch.siteId), nextSite = site(after, branch.siteId);
    const oldBuilding = building(before, branch.siteId), newBuilding = building(after, branch.siteId);
    const staged = priorSite ? copy(priorSite.staged) : null;
    const sources = priorSite ? copy(priorSite.sources) : [];
    let expectedWork = oldBuilding?.work || 0;
    const foodWorkers = before.units.filter(u => u.phase !== 'idle' && u.order.kind === 'gather' && u.order.target === 'd3' && !u.next);
    const builders = before.units.filter(u => u.phase !== 'idle' && u.order.kind === 'build' && !u.next);
    if (foodWorkers.length && builders.length) branch.concurrentFoodAndConstructionSeconds += dt;
    for (const old of [...before.units].sort((a, b) => a.id.localeCompare(b.id))) {
      const u = actor(after, old.id), distance = Math.hypot(u.x - old.x, u.y - old.y);
      assert.ok(distance <= 3 * dt + .00001, 'Physical movement bound for ' + u.id);
      const account = branch.workerTime[u.id] ||= {seconds: 0, distanceCells: 0, categories: {}, phases: {},
        extracted: zero(), received: zero(), constructionPicked: zero(), siteDelivered: zero(), installationWorkerSeconds: 0};
      const bucket = category(old, before); account.seconds += dt; account.distanceCells += distance;
      account.categories[bucket] = (account.categories[bucket] || 0) + dt;
      account.phases[old.phase] = (account.phases[old.phase] || 0) + dt;
      if (!old.supply && u.supply) {
        const source = building(before, u.supply.origin?.storeId);
        assert.ok(source?.done && !source.retiring && adjacent(old, source) && adjacent(u, source));
        assert.equal(old.phase, 'supplyPickup'); assert.equal(old.path.length, 0); assert.equal(old.cargo, 0);
        assert.equal(u.supply.siteId, branch.siteId); assert.equal(u.cargo, 5);
        assert.deepEqual(u.supply.origin, {storeId: source.id, kind: source.kind, x: source.x, y: source.y, resource: u.resource, amount: 5});
        stores[source.id][u.resource] -= u.cargo;
        const row = sources.find(v => v.storeId === source.id && v.resource === u.resource); assert.ok(row && row.amount >= u.cargo); row.amount -= u.cargo;
        account.constructionPicked[u.resource] += u.cargo;
        changes.push({kind: 'construction-source-pickup', actor: u.id, resource: u.resource, amount: u.cargo, source: source.id});
      } else if (old.supply && !u.supply) {
        assert.equal(old.phase, 'supplyDeliver'); assert.equal(old.path.length, 0); assert.ok(adjacent(old, oldBuilding));
        assert.equal(u.cargo, 0); assert.equal(distance, 0); assert.equal(old.supply.siteId, branch.siteId);
        staged[old.resource] += old.cargo; account.siteDelivered[old.resource] += old.cargo;
        changes.push({kind: 'construction-site-receipt', actor: u.id, resource: old.resource, amount: old.cargo,
          destination: branch.siteId, origin: old.supply.origin});
      } else if (u.cargo > old.cargo) {
        assert.ok(!old.supply && !u.supply); assert.equal(old.phase, 'extract'); assert.equal(old.path.length, 0);
        const d = deposit(before, old.order.target); assert.ok(d && adjacent(old, d)); assert.equal(u.cargo - old.cargo, 1);
        assert.equal(u.resource, d.kind); assert.equal(distance, 0); deposits[d.id]--; account.extracted[d.kind]++;
        changes.push({kind: 'extraction', actor: u.id, resource: d.kind, amount: 1, source: d.id});
      } else if (u.cargo < old.cargo) {
        assert.ok(!old.supply && !u.supply); assert.equal(old.phase, 'return'); assert.equal(old.path.length, 0);
        const destination = building(before, old.dropoff);
        assert.ok(destination?.done && !destination.retiring && adjacent(old, destination));
        assert.equal(u.cargo, 0); assert.equal(distance, 0);
        assert.equal(old.order.kind, 'gather');
        assert.equal(old.order.target, old.resource === 'food' ? 'd3' : 'd4', 'Gathered receipts come from the assigned finite deposit');
        stores[destination.id][old.resource] += old.cargo; delivered[old.resource] += old.cargo;
        account.received[old.resource] += old.cargo;
        changes.push({kind: 'gathered-store-receipt', actor: u.id, resource: old.resource, amount: old.cargo,
          sourceDeposit: old.order.target, destination: destination.id, queuedNextOrder: old.next});
        if (destination.id === branch.siteId && old.resource === 'wood') branch.eastWoodReceipts += old.cargo;
      } else {
        assert.equal(u.cargo, old.cargo); assert.equal(u.resource, old.resource);
        assert.deepEqual(u.supply, old.supply);
      }
      // Actor order matters: an earlier carrier can finish staging before a later
      // adjacent builder installs in this same tick. This also handles mixed food
      // receipts and construction pickups at Hearth without net-delta ambiguity.
      if (priorSite && old.phase === 'construct' && old.order.target === branch.siteId && !old.path.length
        && !old.cargo && !old.next && adjacent(old, oldBuilding) && RES.every(r => staged[r] === BILL[r])) {
        const gain = Math.min(24 - expectedWork, dt); expectedWork += gain; account.installationWorkerSeconds += gain;
      }
    }
    assert.deepEqual(after.delivered, delivered, 'Only ordinary gathered receipts advance gathered counters');
    assert.deepEqual(Object.fromEntries(after.deposits.map(d => [d.id, d.amount])), deposits, 'Per-actor extraction explains every finite deposit change');
    if (priorSite) {
      assert.ok(Math.abs(newBuilding.work - expectedWork) < .00001, 'Installation equals eligible adjacent actor-seconds after physical staging');
      if (nextSite) {
        assert.deepEqual(nextSite.staged, staged); assert.deepEqual(nextSite.sources, sources.filter(v => v.amount));
      } else {
        assert.ok(newBuilding.done); assert.equal(newBuilding.work, 24); assert.deepEqual(staged, BILL);
        for (const r of RES) spent[r] += BILL[r]; stores[branch.siteId] = zero();
        const claim = after.reclaim.claims.find(v => v.id === branch.siteId);
        assert.equal(claim.basis.rule, 'delivered-construction'); assert.equal(claim.basis.origin, 'physical-delivery');
        assert.deepEqual(vector(r => claim.origin.filter(v => v.resource === r).reduce((n, v) => n + v.amount, 0)), BILL);
        branch.milestones.usableEast = after.time;
        changes.push({kind: 'outpost-usable', destination: branch.siteId, work: 24});
      }
      const gain = newBuilding.work - oldBuilding.work;
      branch.installationWorkerSeconds += gain;
      if (gain) changes.push({kind: 'installation', siteId: branch.siteId, gain, work: newBuilding.work});
    }
    assert.deepEqual(after.storage.stores, stores, 'Named stores equal combined construction pickups and ordinary food/wood receipts');
    assert.deepEqual(after.spent, spent, 'Only fully installed construction spends materials during simulation');
    assert.equal(after.storage.stores[branch.siteId]?.wood || 0, branch.eastWoodReceipts, 'Eastern stock is traced to new gathered wood receipts');
    for (const change of changes) report.transitions.push({scenario: active.label, time: after.time, ...change});
    branch.sampledSeconds += dt; branch.tickSamples++;
    return changes;
  }
  async function phase(p, start, name, predicate) {
    let s = start, samples = 0;
    while (!predicate(s)) {
      guard(); assert.ok(s.time - active.branch.startTime < 600, 'Bounded branch timeout: ' + name);
      assert.ok(++samples <= 6500, 'Clock made insufficient progress: ' + name);
      const before = s; s = await tick(p); const changes = combinedStep(before, s);
      const custody = changes.filter(v => ['construction-source-pickup', 'construction-site-receipt', 'gathered-store-receipt', 'outpost-usable'].includes(v.kind));
      if (custody.length) {
        const checkpoint = await exported(p, name + '-custody', s);
        await journal('combined-custody-audit', {time: s.time, checkpoint: checkpoint.file, changes});
      }
    }
    active.branch.phases.push({name, startTime: start.time, endTime: s.time, elapsed: s.time - start.time, outcome: inventory(s)});
    await exported(p, name + '-complete', s, true); return s;
  }
  async function setupUntil(p, start, predicate, name) {
    let s = start;
    for (let n = 0; !predicate(s) && n < 500; n++) s = await tick(p, 1000);
    assert.ok(predicate(s), 'Fresh ordinary setup timeout: ' + name);
    await exported(p, name, s); return s;
  }
  async function setupMove(p, before, x, y) {
    await select(p, ORIGINAL); await p.locator('#move').click(); await clickMap(p, x + .5, y + .5);
    const accepted = await saved(p, 'setup-move'); unchangedMaterials(before, accepted);
    return setupUntil(p, accepted, s => s.units.every(u => !u.cargo && u.phase === 'idle'), 'scout-' + x + '-' + y);
  }
  async function open(label, raw) {
    const context = await browser.newContext({viewport: {width: 1440, height: 1100}}); contexts.push(context);
    context.setDefaultTimeout(5000);
    await context.addInitScript(() => {
      window.__allocationInputs = [];
      for (const type of ['pointerdown', 'pointerup', 'click', 'contextmenu', 'keydown', 'keyup', 'change']) {
        document.addEventListener(type, e => window.__allocationInputs.push({type, trusted: e.isTrusted,
          target: e.target.closest?.('[data-unit]')?.dataset.unit || e.target.id || e.target.tagName,
          key: e.key || null, button: e.button, browserTime: performance.now()}), true);
      }
    });
    const p = await context.newPage(); active = {label, page: p, inputCounts: {}, branch: null};
    p.on('pageerror', e => report.errors.push({scenario: label, error: e.message}));
    await p.clock.install({time: new Date('2026-01-01T00:00:00Z')});
    await p.goto('http://127.0.0.1:' + server.address().port + '/hearth-rts.html');
    await p.locator('[data-unit="u0"]').waitFor();
    if (await p.locator('#pause').innerText() === 'Pause') await p.locator('#pause').click();
    await p.clock.pauseAt(new Date('2026-01-01T01:00:00Z'));
    if (raw) {
      await p.locator('#journey').click(); p.once('dialog', d => d.accept());
      await p.locator('#file').setInputFiles({name: 'ordinary-earned-scouted-start.json', mimeType: 'application/json', buffer: Buffer.from(raw)});
      await p.locator('#dialog').waitFor({state: 'hidden'});
      assert.equal((await exported(p, 'exact-import')).raw, raw, 'Every branch imports byte-identical fresh earned Journey');
    }
    return p;
  }
  async function close(p) {
    await inputs(p);
    for (const target of ['world', 'pause', 'gather', 'export']) assert.ok(Object.keys(active.inputCounts)
      .some(key => key === 'pointerdown:' + target + ':true' || key === 'click:' + target + ':true'), 'Trusted native input: ' + target);
    if (active.branch) {
      assert.ok(active.inputCounts['click:train:true']);
      assert.ok(!active.inputCounts['click:stop:true'], 'A branch never introduces a Stop/return barrier');
      active.branch.inputCounts = copy(active.inputCounts);
    } else report.setup.inputCounts = copy(active.inputCounts);
    await p.context().close(); persist();
  }
  try {
    server = http.createServer((req, res) => {
      if (req.url.split('?')[0] !== '/hearth-rts.html') { res.writeHead(404); return res.end(); }
      res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'}); res.end(html);
    });
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    browser = await playwright.chromium.launch({headless: true, chromiumSandbox: true});
    const p = await open('fresh-setup'), fresh = await exported(p, 'fresh', null, true); let s = fresh.s;
    assert.deepEqual(s.stock, {wood: 20, stone: 10, food: 0}); assert.equal(s.units.length, 4); assert.equal(s.buildings.length, 1);
    const setupPhases = [];
    for (const id of ['d0', 'd2', 'd1']) {
      const start = s.time; s = await gather(p, s, ORIGINAL, id, 'earn-' + id);
      s = await setupUntil(p, s, v => deposit(v, id).amount === 0, 'exhausted-' + id);
      await select(p, ORIGINAL); await p.locator('#stop').click();
      s = await saved(p, 'setup-stop-and-return');
      s = await setupUntil(p, s, v => v.units.every(u => !u.cargo && u.phase === 'idle'), 'earned-and-returned-' + id);
      setupPhases.push({name: 'earn-' + id, startTime: start, endTime: s.time, elapsed: s.time - start, inventory: inventory(s)});
    }
    assert.deepEqual(s.stock, {wood: 116, stone: 70, food: 0});
    const scoutStart = s.time; s = await setupMove(p, s, 25, 13); s = await setupMove(p, s, 6, 16);
    assert.deepEqual(s.stock, {wood: 116, stone: 70, food: 0}); assert.deepEqual(s.spent, zero());
    assert.deepEqual(s.delivered, {wood: 96, stone: 60, food: 0});
    assert.deepEqual(['d0', 'd1', 'd2'].map(id => deposit(s, id).amount), [0, 0, 0]); assert.equal(deposit(s, 'd3').amount, 75);
    assert.equal(deposit(s, 'd4').amount, 180); assert.equal(s.buildings.length, 1);
    assert.ok(s.units.every(u => !u.cargo && u.phase === 'idle' && u.order.kind === 'idle' && u.x < 18));
    assert.ok(s.seen.includes(11 * 36 + 22) && s.seen.includes(6 * 36 + 26));
    const sameStart = await exported(p, 'same-earned-scouted-start', s, true);
    setupPhases.push({name: 'east-scout-and-west-return', startTime: scoutStart, endTime: s.time, elapsed: s.time - scoutStart, inventory: inventory(s)});
    report.setup = {freshCheckpoint: fresh.file, freshTime: fresh.s.time, sameStartCheckpoint: sameStart.file,
      sameStartSHA256: sha(sameStart.raw), startTime: s.time, elapsed: s.time - fresh.s.time,
      originalWorkerSeconds: 4 * (s.time - fresh.s.time), phases: setupPhases, sameStartInventory: inventory(s)};
    await close(p);

    for (const strategy of ['A', 'B', 'C']) {
      const q = await open('strategy-' + strategy, sameStart.raw);
      const branch = {strategy, sameStartSHA256: sha(sameStart.raw), startTime: sameStart.s.time, siteId: null,
        milestones: {}, phases: [], workerTime: {}, eastWoodReceipts: 0, installationWorkerSeconds: 0,
        concurrentFoodAndConstructionSeconds: 0, sampledSeconds: 0, tickSamples: 0, zeroTickSamples: 0};
      report.branches.push(branch); active.branch = branch; s = (await exported(q, 'common-start', sameStart.s, true)).s;
      if (strategy === 'A') {
        s = await place(q, s, ORIGINAL);
        s = await phase(q, s, 'build-first', v => building(v, branch.siteId).done);
        s = await gather(q, s, ORIGINAL, 'd3', 'original-four-food');
        s = await phase(q, s, 'food-after-build', v => freeFood(v) >= 25);
        s = await recruit(q, s);
      } else if (strategy === 'B') {
        s = await place(q, s, ['u0']); s = await gather(q, s, ['u1', 'u2', 'u3'], 'd3', 'three-food-one-builder');
        s = await phase(q, s, 'split-food-and-build', v => freeFood(v) >= 25);
        s = await recruit(q, s); s = await joinBuild(q, s, ['u1', 'u2', 'u3', 'u4']);
        assert.equal(s.time, branch.milestones.recruited, 'Fifth worker receives productive construction work immediately');
        branch.milestones.fifthUsefulOrder = s.time;
        await exported(q, 'return-first-join', s, true);
        s = await phase(q, s, 'joined-build', v => building(v, branch.siteId).done);
      } else {
        s = await gather(q, s, ORIGINAL, 'd3', 'food-before-site');
        s = await phase(q, s, 'food-first', v => freeFood(v) >= 25);
        s = await recruit(q, s); s = await place(q, s, [...ORIGINAL, 'u4']);
        assert.equal(s.time, branch.milestones.recruited, 'Fifth worker receives productive construction work immediately');
        branch.milestones.fifthUsefulOrder = s.time;
        s = await phase(q, s, 'five-build-after-food', v => building(v, branch.siteId).done);
      }
      s = await gather(q, s, [...ORIGINAL, 'u4'], 'd4', 'all-five-use-east-store');
      if (strategy === 'A') {
        assert.equal(s.time, branch.milestones.recruited, 'Fifth worker receives productive gathering work immediately');
        branch.milestones.fifthUsefulOrder = s.time;
      }
      await exported(q, 'all-five-useful-work', s, true);
      s = await phase(q, s, 'useful-east-wood', v => building(v, branch.siteId).done && v.units.length === 5
        && v.spent.food === 25 && branch.eastWoodReceipts >= 20 && v.storage.stores[branch.siteId].wood >= 20);
      branch.milestones.twentyNewEastWood = s.time;
      assert.deepEqual(s.spent, {wood: 60, stone: 20, food: 25}); assert.equal(s.units.length, 5);
      assert.ok(Math.abs(branch.installationWorkerSeconds - 24) < .00001);
      assert.ok(Math.abs(Object.values(branch.workerTime).reduce((n, v) => n + v.installationWorkerSeconds, 0) - 24) < .00001);
      if (strategy === 'B') assert.ok(branch.concurrentFoodAndConstructionSeconds > 0, 'Split branch actually runs food work and construction concurrently');
      assert.ok(branch.workerTime.u4.distanceCells > 0, 'Fifth villager actually travels for its assigned useful work');
      assert.ok(Math.abs(branch.sampledSeconds - (s.time - branch.startTime)) < .00001);
      const end = await exported(q, 'common-endpoint', s, true);
      const receipts = report.transitions.filter(v => v.scenario === active.label && v.kind === 'gathered-store-receipt');
      const foodReceipts = receipts.filter(v => v.resource === 'food').reduce((n, v) => n + v.amount, 0);
      assert.equal(foodReceipts, s.delivered.food - sameStart.s.delivered.food);
      const picked = report.transitions.filter(v => v.scenario === active.label && v.kind === 'construction-source-pickup');
      const onsite = report.transitions.filter(v => v.scenario === active.label && v.kind === 'construction-site-receipt');
      for (const rows of [picked, onsite]) {
        assert.equal(rows.length, 16); assert.deepEqual(vector(r => rows.filter(v => v.resource === r).reduce((n, v) => n + v.amount, 0)), BILL);
      }
      const expectedWorkerSeconds = 4 * (s.time - branch.startTime) + (s.time - branch.milestones.recruited);
      assert.ok(Math.abs(Object.values(branch.workerTime).reduce((n, v) => n + v.seconds, 0) - expectedWorkerSeconds) < .00001);
      branch.result = {endCheckpoint: end.file, endSHA256: sha(end.raw), endTime: s.time,
        elapsed: s.time - branch.startTime, commonSetupSeconds: report.setup.elapsed,
        totalTimeSinceFresh: s.time - fresh.s.time, engineClockSinceZero: s.time,
        totalWorkerSecondsInBranch: expectedWorkerSeconds,
        totalWorkerSecondsIncludingCommonSetup: expectedWorkerSeconds + report.setup.originalWorkerSeconds,
        freshWoodReceivedInNamedEastStore: branch.eastWoodReceipts, extraEastWoodBeyond20: branch.eastWoodReceipts - 20,
        foodDelivered: foodReceipts, deliveredFoodOvershootBeyond25: foodReceipts - 25,
        westernFoodRemaining: deposit(s, 'd3').amount, foodExtracted: 75 - deposit(s, 'd3').amount,
        extractedFoodBeyond25: 50 - deposit(s, 'd3').amount, outstandingFoodCargo: cargo(s, 'food'),
        inventory: inventory(s), milestoneElapsed: Object.fromEntries(Object.entries(branch.milestones).map(([key, value]) => [key, value - branch.startTime]))};
      await close(q);
    }
    const ranked = [...report.branches].sort((a, b) => a.result.elapsed - b.result.elapsed);
    report.comparison = {orderedByObservedElapsed: ranked.map(v => ({strategy: v.strategy, elapsed: v.result.elapsed,
      differenceFromFastest: v.result.elapsed - ranked[0].result.elapsed, foodOvershoot: v.result.deliveredFoodOvershootBeyond25,
      westernFoodRemaining: v.result.westernFoodRemaining, outstandingCargo: v.result.inventory.cargo,
      eastWood: v.result.freshWoodReceivedInNamedEastStore})),
    explanation: 'Compare completion, recruitment and useful wood milestones together with food remaining, overshoot and live cargo. All travel, physical supply, return-first cargo settlement and fifth-worker travel remain inside each branch clock; shared earning and scouting are included in totalTimeSinceFresh.'};
    assert.deepEqual(report.errors, []); guard(); report.status = 'passed';
  } catch (error) {
    report.status = 'failed'; report.failure = {message: String(error), stack: error.stack};
    if (active?.page && !active.page.isClosed()) {
      await active.page.screenshot({path: path.join(DIR, 'failure.png'), fullPage: true}).catch(() => {});
      report.failure.body = await active.page.locator('body').innerText().catch(() => null);
      report.failure.rawSaved = await active.page.evaluate(key => localStorage.getItem(key), KEY).catch(() => null);
      await inputs(active.page).catch(() => {});
    }
    process.exitCode = 1;
  } finally {
    for (const context of contexts) await context.close().catch(() => {});
    if (browser) await browser.close(); if (server) await new Promise(resolve => server.close(resolve));
    const finished = once(traceFile, 'finish'); trace.end(); await finished;
    if (traceFailure) { report.status = 'failed'; report.traceFailure = String(traceFailure); process.exitCode = 1; }
    report.observationJournal = {file: 'observations.jsonl.gz', sha256: sha(fs.readFileSync(tracePath)), records: recordCount,
      firstPreviousSHA256: binding, finalRecordSHA256: chain,
      format: 'Gunzip JSONL; remove sha256 from each row and SHA256(JSON.stringify(row)); previousSHA256 chains to the preceding row. Native-save records retain exact raw save strings; custody/phase checkpoints are exact ordinary Journey downloads.'};
    report.wallSeconds = (Date.now() - started) / 1000; persist();
  }
  console.log(report.status.toUpperCase() + ' allocation comparison; artifact binding ' + binding);
  if (report.status !== 'passed') process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
