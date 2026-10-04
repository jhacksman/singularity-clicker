const test = require('node:test');
const assert = require('node:assert/strict');
const { Camp, valid, certifyLegacy } = require('../src/hearth-rts/engine.js');

// Supplementary declared-state fixtures, never the required old-executable witness.
// These values come from the frozen contract, independently of COST/fresh()/migration.
const PROFILE = 'accepted-opening.outpost-reclaim.v1';
const RES = ['wood', 'stone', 'food'];
const TOTAL = { wood: 416, stone: 220, food: 225 };
const BILL = { wood: 60, stone: 20, food: 0 };
const zero = () => ({ wood: 0, stone: 0, food: 0 });
const copy = value => structuredClone(value);
const snapshot = g => JSON.parse(g.serialize());
const unit = (i, x, y) => ({ id: 'u' + i, name: ['Aru', 'Nara', 'Tavi', 'Uma', 'Sela', 'Kori', 'Luma', 'Oru'][i], x, y,
  order: { kind: 'idle' }, phase: 'idle', cargo: 0, resource: null, work: 0, path: [], reason: 'Ready for orders', next: null });
const building = (id, kind, x, y, done = true, work = kind === 'outpost' ? 24 : 32) => ({ id, kind, x, y, done, work,
  cost: kind === 'outpost' ? { wood: 60, stone: 20 } : { wood: 40, stone: 30 } });

function legacy({ version = 4, buildings = [building('b1', 'outpost', 11, 11)], workers = 4, knapping = null } = {}) {
  const deposits = [
    ['wood', 5, 6, 48], ['wood', 10, 5, 48], ['stone', 12, 10, 60], ['food', 5, 18, 75],
    ['wood', 26, 6, 180], ['wood', 30, 9, 120], ['stone', 29, 15, 150], ['food', 24, 19, 150]
  ].map(([kind, x, y, initial], i) => ({ id: 'd' + i, kind, x, y, initial, amount: kind === 'food' ? initial : 0 }));
  const spent = { wood: 0, stone: 0, food: 25 * (workers - 4) };
  for (const b of buildings) for (const r of RES) spent[r] += b.cost[r] || 0;
  if (knapping) { spent.wood += 4; spent.stone += 8; }
  let recruitedFood = spent.food;
  for (const d of deposits.filter(d => d.kind === 'food')) { const n = Math.min(recruitedFood, d.amount); d.amount -= n; recruitedFood -= n; }
  const stock = { wood: 416 - spent.wood, stone: 220 - spent.stone, food: 0 };
  const positions = [[10, 11], [6, 14], [7, 14], [8, 14], [9, 14], [10, 14], [11, 14], [12, 14]];
  const s = { version, tools: !!knapping?.done, knapping: copy(knapping), time: 1000.125, stock, deposits,
    buildings: [{ id: 'b0', kind: 'hearth', x: 7, y: 11, done: true, work: 0, cost: {} }, ...copy(buildings)],
    units: positions.slice(0, workers).map(([x, y], i) => unit(i, x, y)), seen: Array.from({ length: 864 }, (_, i) => i),
    nextId: Math.max(0, ...buildings.map(b => Number(b.id.slice(1)))) + 1, spent,
    delivered: { wood: 396, stone: 210, food: spent.food }, depleted: 6,
    complete: buildings.some(b => b.kind === 'outpost' && b.done && b.x > 20) && buildings.some(b => b.kind === 'workshop' && b.done) };
  const sources = cost => RES.filter(r => cost[r]).map(resource => ({ storeId: 'b0', resource, amount: cost[resource] }));
  s.storage = { version: 1, stores: Object.fromEntries(s.buildings.filter(b => b.done && ['hearth', 'outpost'].includes(b.kind)).map(b => [b.id, b.id === 'b0' ? copy(stock) : zero()])),
    transfers: [], nextId: 1, transferred: zero(), payments: [], reservations: {} };
  for (const b of buildings.filter(b => !b.done)) s.storage.reservations[b.id] = { sources: sources(b.cost) };
  if (knapping && !knapping.done) s.storage.reservations.knapping = { sources: sources({ wood: 4, stone: 8 }) };
  if (version < 3) delete s.storage;
  if (version === 1) { delete s.tools; delete s.knapping; }
  return s;
}

function camp(options) {
  const source = legacy(options), bytes = JSON.stringify(source);
  assert.equal(certifyLegacy(source).ok, true, certifyLegacy(source).reason);
  const g = new Camp(source);
  assert.equal(JSON.stringify(source), bytes, 'Adoption must not modify its input');
  assert.equal(g.s.version, 6);
  assert.deepEqual(g.s.construction, { profile: 'accepted-opening.physical-construction.v1', sites: [] });
  assert.equal(g.s.reclaim.profile, PROFILE);
  check(g);
  return g;
}

function world(g) {
  // Aggregate stock and attribution counters are intentionally not inventory inputs.
  return Object.fromEntries(RES.map(r => [r,
    g.s.deposits.filter(d => d.kind === r).reduce((n, d) => n + d.amount, 0)
    + Object.values(g.s.storage.stores).reduce((n, stock) => n + stock[r], 0)
    + g.s.units.filter(u => u.resource === r).reduce((n, u) => n + u.cargo, 0)
    + (g.s.construction?.sites || []).reduce((n, c) => n + c.staged[r], 0)
    + g.s.spent[r]
  ]));
}

function check(g) {
  assert.equal(valid(g.s), true, 'Every physical checkpoint must remain loadable');
  assert.deepEqual(world(g), TOTAL);
  for (const r of RES) assert.equal(Object.values(g.s.storage.stores).reduce((n, stock) => n + stock[r], 0), g.s.stock[r]);
  for (const c of g.s.reclaim.claims) {
    const holders = g.s.units.filter(u => u.reclaim?.claimId === c.id);
    for (const r of RES) assert.equal(c.unreleased[r] + c.receipted[r] + holders.filter(u => u.resource === r).reduce((n, u) => n + u.cargo, 0), BILL[r], 'Claim partition for ' + c.id + '/' + r);
    assert.equal(new Set(c.assigned).size, c.assigned.length);
    if (RES.every(r => c.unreleased[r] === 0)) assert.ok(c.assigned.every(id => g.s.units.find(u => u.id === id)?.cargo > 0), 'Empty workers release exhausted pickup assignments');
  }
}

function ticks(g, n) { for (let i = 0; i < n; i++) { g.tick(.1); check(g); } }
function until(g, predicate, label = 'physical transition', limit = 12000) {
  for (let i = 0; i < limit && !predicate(); i++) { g.tick(.1); check(g); }
  assert.ok(predicate(), 'Expected ' + label + ' within test bound');
}
const claim = (g, id = 'b1') => g.s.reclaim.claims.find(c => c.id === id);
const exists = (g, id = 'b1') => g.s.buildings.some(b => b.id === id);
function begin(g, ids = ['u0'], id = 'b1') {
  const result = g.reclaim(ids, id);
  assert.equal(result.error, undefined, result.error);
  assert.equal(result.id, id);
  return result;
}
function refused(g, ids, id, pattern) {
  const before = g.serialize(), q = g.reclaimQuote(ids, id);
  assert.equal(q.ok, false);
  assert.ok(q.reason);
  if (pattern) assert.match(q.reason, pattern);
  assert.equal(g.serialize(), before, 'Quote is read-only');
  assert.ok(g.reclaim(ids, id).error);
  assert.equal(g.serialize(), before, 'Rejected group preserves every serialized field');
}

test('synthetic exhausted v1-v4 six-western-outpost worlds certify without payment history', () => {
  const sites = [[2, 2], [7, 2], [12, 2], [2, 8], [12, 8], [12, 15]].map(([x, y], i) => building('b' + (i + 1), 'outpost', x, y));
  sites.push(building('b7', 'workshop', 3, 21));
  for (const version of [1, 2, 3, 4]) {
    const source = legacy({ version, buildings: sites }), raw = JSON.stringify(source), g = camp({ version, buildings: sites });
    assert.deepEqual(g.s.stock, { wood: 16, stone: 70, food: 0 });
    assert.deepEqual(g.s.spent, { wood: 400, stone: 150, food: 0 });
    assert.equal(g.s.reclaim.claims.length, 6);
    for (const c of g.s.reclaim.claims) { assert.deepEqual(c.unreleased, BILL); assert.deepEqual(c.receipted, zero()); assert.deepEqual(c.assigned, []); }
    assert.equal(g.reclaimQuote(['u0'], 'b1').ok, true);
    assert.equal(JSON.stringify(source), raw);
    begin(g); until(g, () => !exists(g));
    assert.deepEqual(g.s.stock, { wood: 76, stone: 90, food: 0 });
    assert.deepEqual(g.s.spent, { wood: 340, stone: 130, food: 0 });
    assert.deepEqual(g.s.reclaim.recovered, BILL);
  }
});

test('legacy certification preserves unfinished paid obligations, recruits, work and tool entitlement', () => {
  for (const version of [1, 2, 3, 4]) {
    for (const done of [false, true]) {
      const options = { version, workers: 6, buildings: [building('b1', 'outpost', 11, 11, false, 2.375), building('b2', 'workshop', 11, 16, true, 0)] };
      if (version > 1) options.knapping = { workshop: 'b2', work: done ? 12 : 3.125, done };
      const source = legacy(options), g = camp(options);
      assert.equal(g.s.time, source.time);
      assert.deepEqual(g.s.buildings, source.buildings);
      assert.deepEqual(g.s.units, source.units);
      assert.equal(g.s.tools, version > 1 && done);
      assert.deepEqual(g.s.knapping, version > 1 ? source.knapping : null);
      assert.deepEqual(claim(g).unreleased, BILL);
      refused(g, ['u0'], 'b1', /complet|finish|construction/i);
      const before = copy(g.s.stock);
      assert.equal(g.cancel('b1'), true);
      assert.equal(claim(g), undefined);
      assert.equal(g.s.stock.wood, before.wood + 60);
      assert.equal(g.s.stock.stone, before.stone + 20);
      assert.equal(g.cancel('b1'), false);
      check(g);
    }
  }
});

test('certification ignores legacy unknown recovery authority and accepts semantic zero cost fields', () => {
  const s = legacy(); s.buildings[1].cost = { food: 0, stone: 20, wood: 60 }; s.buildings[1].work = .125;
  s.reclaim = { profile: PROFILE, claims: [{ id: 'forged', unreleased: { wood: 999 } }], recovered: { wood: 999 } };
  s.buildings[1].retiring = true; s.units[0].reclaim = { claimId: 'forged' };
  const raw = JSON.stringify(s), g = new Camp(s);
  assert.equal(g.s.version, 6); assert.equal(JSON.stringify(s), raw);
  assert.equal(g.s.reclaim.claims.length, 1); assert.equal(claim(g).id, 'b1');
  assert.deepEqual(claim(g).unreleased, BILL); assert.deepEqual(g.s.reclaim.recovered, zero());
  assert.notEqual(g.s.buildings[1].retiring, true); assert.equal(g.s.units[0].reclaim, undefined);
  assert.equal(g.s.buildings[1].work, .125); check(g);
});

test('playable legacy deviations fail optional certification without losing their exact input', () => {
  const mutations = [
    s => s.deposits[0].initial++, s => s.deposits[0].x++, s => s.deposits[0].id = 'edited-deposit',
    s => s.buildings[0].x++, s => s.buildings[1].cost.wood++, s => s.buildings[1].cost.wood--,
    s => s.buildings[1].cost.food = 1, s => s.buildings[1].cost.wood = 60.5,
    s => { s.stock.wood++; s.storage.stores.b0.wood++; },
    s => { s.spent.wood++; s.stock.wood--; s.storage.stores.b0.wood--; },
    s => { s.stock.wood -= .5; s.storage.stores.b0.wood -= .5; s.deposits[0].amount = .5; },
    s => s.nextId = 1, s => s.nextId = 2.5,
    s => { s.buildings[1].id = 'custom-site'; s.storage.stores['custom-site'] = s.storage.stores.b1; delete s.storage.stores.b1; },
    s => s.units.pop()
  ];
  for (const mutate of mutations) {
    const s = legacy(); mutate(s); const raw = JSON.stringify(s);
    assert.equal(valid(s), true, 'Negative control must remain playable under the supported reader');
    const certification = certifyLegacy(s);
    assert.equal(certification.ok, false); assert.ok(certification.reason);
    assert.equal(JSON.stringify(s), raw);
    const g = new Camp(s);
    assert.equal(g.s.version, 4); assert.ok(g.reclaimIssue);
    assert.equal(JSON.stringify(s), raw);
    for (const key of ['stock', 'spent', 'deposits', 'buildings', 'units', 'time']) assert.deepEqual(g.s[key], s[key]);
    refused(g, ['u0'], s.buildings[1].id);
    assert.doesNotThrow(() => new Camp(JSON.parse(g.serialize())));
  }
});

test('partial and split canonical payments are assertions, while duplicate or conflicting assertions reject certification', () => {
  const payment = () => ({ kind: 'construction', target: 'b1', refunded: false,
    sources: [{ storeId: 'b0', resource: 'wood', amount: 20 }, { storeId: 'b0', resource: 'wood', amount: 40 }, { storeId: 'b0', resource: 'stone', amount: 20 }] });
  const s = legacy({ buildings: [building('b1', 'outpost', 11, 11), building('b2', 'workshop', 11, 16)] });
  s.storage.payments = [payment()]; const raw = JSON.stringify(s);
  assert.equal(certifyLegacy(s).ok, true); assert.equal(new Camp(s).s.version, 6); assert.equal(JSON.stringify(s), raw);
  for (const mutate of [
    p => p.kind = 'unknown', p => p.target = 'b0', p => p.target = 'missing', p => p.refunded = true,
    p => p.sources[0].amount++, p => p.sources[0].resource = 'food'
  ]) {
    const bad = copy(s); mutate(bad.storage.payments[0]); const before = JSON.stringify(bad);
    assert.equal(certifyLegacy(bad).ok, false); assert.equal(JSON.stringify(bad), before);
  }
  const duplicate = copy(s); duplicate.storage.payments.push(payment()); assert.equal(certifyLegacy(duplicate).ok, false);
  const recruits = legacy(); recruits.storage.payments.push({ kind: 'recruitment', target: null, refunded: false, sources: [{ storeId: 'b0', resource: 'food', amount: 25 }] });
  assert.equal(certifyLegacy(recruits).ok, false);
  const conflicting = legacy({ buildings: [building('b1', 'outpost', 11, 11, false, 2), building('b2', 'outpost', 2, 8)] });
  conflicting.storage.payments.push(payment());
  conflicting.storage.payments[0].sources.forEach(p => p.storeId = 'b2');
  assert.equal(valid(conflicting), true);
  assert.equal(certifyLegacy(conflicting).ok, false, 'A present payment cannot contradict the live refund origins');
});

test('legacy pending and manually held transfer goods are counted once and preserved during adoption', () => {
  for (const version of [3, 4]) for (const held of [false, true]) {
    const s = legacy({ version }), u = s.units[0];
    s.storage.nextId = 2;
    s.storage.transfers.push({ id: 't1', from: 'b0', to: 'b1', resource: 'wood', amount: 5,
      remaining: held ? 0 : 5, delivered: 0, recovered: 0, cancelled: 0,
      workers: ['u0'], requested: 'u0', pending: { u0: held ? 0 : 5 } });
    if (held) {
      s.stock.wood -= 5; s.storage.stores.b0.wood -= 5;
      u.cargo = 5; u.resource = 'wood'; u.transfer = 't1'; u.work = .125;
    } else { u.order = { kind: 'transfer', target: 't1' }; u.phase = 'pickup'; }
    const raw = JSON.stringify(s), g = new Camp(s);
    assert.equal(certifyLegacy(s).ok, true); assert.equal(g.s.version, 6);
    assert.deepEqual(g.s.storage, s.storage); assert.deepEqual(g.s.units, s.units); assert.equal(JSON.stringify(s), raw);
    refused(g, ['u1'], 'b1', /transfer|incoming|settle|load/i); check(g);
    assert.deepEqual(new Camp(snapshot(g)).s, g.s);
  }
});

test('fractional live refund origins keep a balanced supported v4 camp playable but uncertified', () => {
  const s = legacy({ buildings: [building('b1', 'outpost', 11, 11), building('b2', 'outpost', 2, 8, false, 1)] });
  s.storage.reservations.b2.sources = [
    { storeId: 'b0', resource: 'wood', amount: .5 },
    { storeId: 'b1', resource: 'wood', amount: 59.5 },
    { storeId: 'b0', resource: 'stone', amount: 20 }
  ];
  const raw = JSON.stringify(s);
  assert.equal(valid(s), true, 'The existing v4 reader accepts fractional refund origins');
  assert.deepEqual(world({ s }), TOTAL);
  assert.equal(certifyLegacy(s).ok, false);
  const g = new Camp(s); assert.equal(g.s.version, 4); assert.equal(g.s.reclaim, undefined); assert.ok(g.reclaimIssue);
  assert.deepEqual(g.s, s); assert.equal(JSON.stringify(s), raw); refused(g, ['u0'], 'b1');
  assert.deepEqual(new Camp(snapshot(g)).s, s);
});

test('legacy transfer settlement headroom certifies its last safe boundary and otherwise keeps playable v4', () => {
  for (const held of [false, true]) {
    const source = legacy(), u = source.units[0];
    source.storage.nextId = 2;
    source.storage.transfers.push({ id: 't1', from: 'b0', to: 'b1', resource: 'wood', amount: 5,
      remaining: held ? 0 : 5, delivered: 0, recovered: 0, cancelled: 0,
      workers: ['u0'], requested: 'u0', pending: { u0: held ? 0 : 5 } });
    if (held) {
      source.stock.wood -= 5; source.storage.stores.b0.wood -= 5;
      u.cargo = 5; u.resource = 'wood'; u.transfer = 't1';
    } else { u.order = { kind: 'transfer', target: 't1' }; u.phase = 'pickup'; }
    for (const transferred of [9999994, 9999995, 9999998]) {
      const s = copy(source); s.storage.transferred.wood = transferred; const raw = JSON.stringify(s);
      assert.equal(valid(s), true, 'The legacy reader accepts this bounded attribution counter');
      assert.deepEqual(world({ s }), TOTAL, 'Transfer attribution is not additional inventory');
      const certified = transferred === 9999994;
      assert.equal(certifyLegacy(s).ok, certified);
      const g = new Camp(s); assert.equal(g.s.version, certified ? 6 : 4);
      assert.equal(JSON.stringify(s), raw, 'Optional certification must preserve exact incoming data');
      assert.deepEqual(g.s.storage, s.storage); assert.deepEqual(g.s.units, s.units); assert.deepEqual(world(g), TOTAL);
      if (certified) {
        check(g);
        for (const overflow of [9999995, 9999998]) {
          const bad = snapshot(g); bad.storage.transferred.wood = overflow; const before = JSON.stringify(bad);
          assert.equal(valid(bad), false, 'Claim-bearing v5 must reserve the same pending or carried settlement range');
          assert.throws(() => new Camp(bad)); assert.equal(JSON.stringify(bad), before);
        }
      } else {
        assert.equal(g.s.reclaim, undefined); assert.ok(g.reclaimIssue);
        assert.deepEqual(g.s, s, 'Insufficient optional headroom must not turn a playable legacy camp into a rejected save');
        assert.deepEqual(new Camp(snapshot(g)).s, s);
      }
    }
  }
});

test('quote, commitment and repeated confirmation cannot themselves pick up or receive materials', () => {
  const g = camp(), before = g.serialize(), stock = copy(g.s.stock), spent = copy(g.s.spent);
  for (let i = 0; i < 20; i++) { assert.equal(g.reclaimQuote(['u0'], 'b1').ok, true); assert.equal(g.serialize(), before); }
  begin(g); const committed = g.serialize();
  assert.equal(g.s.buildings.find(b => b.id === 'b1').retiring, true);
  assert.deepEqual(g.s.stock, stock); assert.deepEqual(g.s.spent, spent); assert.equal(g.s.units[0].cargo, 0);
  for (let i = 0; i < 20; i++) { begin(g); assert.equal(g.serialize(), committed); }
  assert.equal(new Camp(snapshot(g)).serialize(), committed);
  check(g);
});

test('shared pickup/receipt edge takes separate transitions and exactly twelve wood plus four stone loads', () => {
  const g = camp(), u = g.s.units[0], stored = copy(g.s.stock), spent = copy(g.s.spent), produced = copy(g.s.delivered), transferred = copy(g.s.storage.transferred), depleted = g.s.depleted;
  assert.deepEqual({ x: u.x, y: u.y }, { x: 10, y: 11 }); begin(g);
  const loads = [], receipts = [];
  for (let i = 0; i < 2000 && exists(g); i++) {
    const cargo = u.cargo, stock = copy(g.s.stock), paid = copy(g.s.spent);
    g.tick(.1); check(g);
    if (u.cargo > cargo) {
      loads.push([u.resource, u.cargo - cargo]);
      assert.equal(u.cargo, 5); assert.equal(u.reclaim.claimId, 'b1');
      assert.deepEqual(g.s.stock, stock, 'A pickup is never also a receipt');
      assert.equal(paid[u.resource] - g.s.spent[u.resource], 5);
    }
    for (const r of RES) if (g.s.stock[r] > stock[r]) { receipts.push([r, g.s.stock[r] - stock[r]]); assert.equal(u.cargo, 0); assert.deepEqual(g.s.spent, paid); }
    assert.deepEqual(g.s.delivered, produced); assert.deepEqual(g.s.storage.transferred, transferred); assert.equal(g.s.depleted, depleted);
  }
  assert.equal(exists(g), false);
  assert.deepEqual(loads, [...Array.from({ length: 12 }, () => ['wood', 5]), ...Array.from({ length: 4 }, () => ['stone', 5])]);
  assert.deepEqual(receipts, loads);
  assert.deepEqual(g.s.stock, { wood: stored.wood + 60, stone: stored.stone + 20, food: stored.food });
  assert.deepEqual(g.s.spent, { wood: spent.wood - 60, stone: spent.stone - 20, food: spent.food });
  assert.equal(u.reclaim, undefined); assert.equal(claim(g), undefined); assert.equal(u.order.kind, 'idle');
});

test('repeated confirmation, reload and stable actor ordering preserve the same full-tranche recovery', () => {
  const a = camp(), b = new Camp(snapshot(a)), ids = ['u3', 'u1', 'u0', 'u2'];
  begin(a, ids); begin(b, ids);
  assert.deepEqual(claim(a).assigned, ['u0', 'u1', 'u2', 'u3']);
  for (let i = 0; i < 2400 && exists(a); i++) {
    const before = b.serialize(); b.reclaim(ids, 'b1'); assert.equal(b.serialize(), before);
    a.tick(.1); b.tick(.1); check(a); check(b); assert.deepEqual(b.s, a.s);
    const roundtrip = new Camp(snapshot(b)); assert.deepEqual(roundtrip.s, b.s);
    b.s = roundtrip.s;
    for (const u of a.s.units.filter(u => u.reclaim)) assert.equal(u.cargo, 5, 'Do not divide full tranches among workers');
  }
  assert.equal(exists(a), false); assert.deepEqual(a.s.reclaim.recovered, BILL);
});

test('simultaneous pickups choose full wood then stone tranches in stable actor-ID order', () => {
  const g = camp(), u0 = g.s.units[0], u1 = g.s.units[1]; begin(g);
  until(g, () => claim(g).unreleased.wood === 5 && u0.cargo === 0, 'eleven wood receipts');
  assert.equal(g.command(['u0'], { kind: 'idle' }), 1);
  assert.equal(g.command(['u1'], { kind: 'move', x: 10, y: 12 }), 1);
  until(g, () => u1.phase === 'idle');
  begin(g, ['u1', 'u0']);
  assert.equal(u0.path.length, 0); assert.equal(u1.path.length, 0);
  g.tick(.1); check(g);
  assert.equal(u0.resource, 'wood'); assert.equal(u0.cargo, 5);
  assert.equal(u1.resource, 'stone'); assert.equal(u1.cargo, 5);
  assert.deepEqual(claim(g).unreleased, { wood: 0, stone: 15, food: 0 });
});

test('whole-group admission rejects unknown IDs, loaded members and incompatible transfers atomically', () => {
  const g = camp();
  for (const ids of [[], ['missing'], ['u0', 'missing'], null]) refused(g, ids, 'b1');
  refused(g, ['u0'], 'b0', /hearth|outpost/i); refused(g, ['u0'], 'missing');
  const workshop = camp({ buildings: [building('b1', 'outpost', 11, 11), building('b2', 'workshop', 11, 16)] }); refused(workshop, ['u0'], 'b2', /workshop|outpost/i);
  assert.equal(g.command(['u1'], { kind: 'gather', target: 'd3' }), 1); until(g, () => g.s.units[1].cargo > 0);
  refused(g, ['u0', 'u1'], 'b1', /empty|carry|cargo|load/i);
  const t = camp(); assert.ok(t.transfer(['u1'], 'b0', 'b1', 'wood').id); refused(t, ['u0', 'u1'], 'b1');
});

test('actual stock, durable incoming transfer endpoints and live refund origins block retirement', () => {
  const incoming = camp(); assert.ok(incoming.transfer(['u1'], 'b0', 'b1', 'wood').id); refused(incoming, ['u0'], 'b1', /transfer|incoming|settle|load/i);
  until(incoming, () => !!incoming.s.units[1].transfer);
  incoming.command(['u1'], { kind: 'move', x: 14, y: 8 }); until(incoming, () => incoming.s.units[1].phase === 'idle');
  assert.equal(incoming.s.units[1].dropoff, undefined); assert.ok(incoming.s.units[1].transfer);
  refused(incoming, ['u0'], 'b1', /transfer|incoming|settle|load/i);
  incoming.command(['u1'], { kind: 'idle' }); until(incoming, () => !incoming.s.units[1].cargo);
  if (incoming.store('b1').stock.wood) refused(incoming, ['u0'], 'b1', /stock|empty|goods/i);
  const refundable = legacy({ buildings: [building('b1', 'outpost', 11, 11), building('b2', 'workshop', 11, 16, false, 1)] });
  refundable.storage.reservations.b2.sources.forEach(p => p.storeId = 'b1');
  const g = new Camp(refundable); assert.equal(g.s.version, 6); refused(g, ['u0'], 'b1', /refund|reservation|construction|settle|source|paid|suppl|cancel/i);
  assert.equal(g.cancel('b2'), true); refused(g, ['u0'], 'b1', /stock|empty|goods/i); check(g);
});

test('historical completed payment origin is not a live retirement blocker', () => {
  const s = legacy({ buildings: [building('b1', 'outpost', 11, 11), building('b2', 'workshop', 11, 16)] });
  s.storage.payments.push({ kind: 'construction', target: 'b2', refunded: false,
    sources: [{ storeId: 'b1', resource: 'wood', amount: 40 }, { storeId: 'b1', resource: 'stone', amount: 30 }] });
  const g = new Camp(s); assert.equal(g.s.version, 6); begin(g); until(g, () => !exists(g)); check(g);
  assert.doesNotThrow(() => new Camp(snapshot(g)));
});

test('retiring store is excluded immediately from transfer, receipt and local funding admission', () => {
  const g = camp(); begin(g);
  assert.equal(g.store('b1'), null);
  assert.equal(g.stores().some(b => b.id === 'b1'), false);
  assert.notEqual(g.nearestStore({ x: 13, y: 11, kind: 'workshop' })?.id, 'b1');
  assert.ok(g.transfer(['u1'], 'b0', 'b1', 'wood').error);
  assert.ok(g.transfer(['u1'], 'b1', 'b0', 'wood').error);
  const u = g.s.units[1]; g.command([u.id], { kind: 'gather', target: 'd3' }); until(g, () => u.cargo > 0);
  g.command([u.id], { kind: 'idle' }); assert.notEqual(u.dropoff, 'b1'); check(g);
});

test('same-edge continuity rejects a trapped actor even when another pickup edge reaches a receiver', () => {
  const g = camp({ buildings: [building('b1', 'outpost', 3, 3), building('b2', 'workshop', 2, 1), building('b3', 'workshop', 0, 3), building('b4', 'workshop', 1, 4)] });
  const u = g.s.units[0]; u.x = 2; u.y = 3;
  const source = g.s.buildings.find(b => b.id === 'b1'), hearth = g.s.buildings[0];
  assert.deepEqual(g.path(u, g.around(source)), []);
  assert.ok(g.around(source).some(p => !g.blocked(p.x, p.y) && g.path(p, g.around(hearth))));
  assert.equal(g.path(u, g.around(hearth)), null);
  refused(g, ['u0', 'u1'], 'b1', /route|path|reach/i);
  begin(g, ['u1']); until(g, () => !exists(g));
});

test('retiring a receiver preserves another unsettled site whose usable edge depends on it', () => {
  const g = camp({ buildings: [building('b1', 'outpost', 0, 0), building('b2', 'outpost', 2, 2), building('b3', 'workshop', 2, 0), building('b4', 'workshop', 0, 4)] });
  Object.assign(g.s.units[0], { x: 0, y: 2 }); Object.assign(g.s.units[1], { x: 4, y: 2 });
  begin(g, ['u0'], 'b1');
  assert.ok(g.path(g.s.units[1], g.around(g.s.buildings[0])));
  refused(g, ['u1'], 'b2', /route|receiv|recovery|recover|depend|unsettled/i);
  until(g, () => !exists(g)); check(g);
});

test('pickup rechecks a route that disappears after commitment and keeps all unreleased capital', () => {
  const g = camp({ buildings: [building('b1', 'outpost', 18, 11), building('b2', 'workshop', 15, 17)] });
  const u = g.s.units[0], wall = g.s.buildings.find(b => b.id === 'b2'); Object.assign(u, { x: 20, y: 11 });
  begin(g); assert.equal(u.path.length, 0);
  // Controlled external topology change: move a paid blocker into the lower ford.
  // Normal construction is tested separately and must prevent this condition.
  wall.x = 18; wall.y = 13;
  const before = { spent: copy(g.s.spent), stock: copy(g.s.stock), unreleased: copy(claim(g).unreleased) };
  g.tick(.1); check(g);
  assert.equal(u.cargo, 0); assert.deepEqual(g.s.spent, before.spent); assert.deepEqual(g.s.stock, before.stock);
  assert.deepEqual(claim(g).unreleased, before.unreleased); assert.match(u.reason, /route|path|block|receiv/i);
  g.command(['u0'], { kind: 'idle' }); wall.x = 15; wall.y = 17; begin(g); until(g, () => !exists(g));
});

test('an interrupted retirement still protects its footprint and last pickup edge from construction', () => {
  const g = camp({ buildings: [building('b1', 'outpost', 0, 0), building('b2', 'workshop', 2, 0)] });
  begin(g); assert.equal(g.command(['u0'], { kind: 'move', x: 6, y: 15 }), 1);
  assert.deepEqual(claim(g).assigned, []); assert.equal(g.blocked(0, 0), true); assert.equal(g.blocked(1, 1), true);
  const before = g.serialize(); assert.ok(g.build('workshop', 0, 2, []).error); assert.equal(g.serialize(), before);
  begin(g, ['u1']); until(g, () => !exists(g));
});

test('two eastern outposts cannot justify simultaneous retirement, including a paused reload boundary', () => {
  const g = camp({ buildings: [building('b1', 'outpost', 23, 11), building('b2', 'outpost', 28, 11), building('b3', 'workshop', 11, 16)] });
  begin(g, ['u0'], 'b1'); refused(g, ['u1'], 'b2', /east|required|last/i);
  const reloaded = new Camp(snapshot(g)); refused(reloaded, ['u1'], 'b2', /east|required|last/i);
  ticks(g, 1); assert.equal(g.s.complete, true);
  const last = camp({ buildings: [building('b1', 'outpost', 23, 11), building('b2', 'workshop', 11, 16)] }); refused(last, ['u0'], 'b1', /east|required|last/i);
  const boundary = camp({ buildings: [building('b1', 'outpost', 20, 11), building('b2', 'outpost', 23, 11)] }); refused(boundary, ['u0'], 'b2', /east|required|last/i); begin(boundary, ['u0'], 'b1');
});

test('Stop before pickup releases authority and later resume remains finite', () => {
  const g = camp(); begin(g); assert.equal(g.command(['u0'], { kind: 'idle' }), 1);
  assert.deepEqual(claim(g).assigned, []); ticks(g, 30); assert.deepEqual(claim(g).unreleased, BILL);
  assert.deepEqual(g.s.reclaim.recovered, zero()); begin(g, ['u1']); until(g, () => !exists(g));
  assert.deepEqual(g.s.reclaim.recovered, BILL);
});

test('loaded Move keeps custody, uses the accepted speed, and never resumes abandoned recovery', () => {
  const g = camp(), u = g.s.units[0], original = copy(g.s.stock); begin(g); until(g, () => !!u.reclaim);
  const position = { x: u.x, y: u.y }, spent = copy(g.s.spent), tag = copy(u.reclaim);
  assert.equal(g.command(['u0'], { kind: 'move', x: 14, y: 8 }), 1);
  assert.deepEqual(claim(g).assigned, []); assert.equal(u.phase, 'carryMove'); assert.equal(u.dropoff, undefined);
  g.tick(.1); check(g); const distance = Math.hypot(u.x - position.x, u.y - position.y);
  assert.ok(distance > 0 && distance <= .3 + 1e-12); assert.deepEqual(u.reclaim, tag); assert.equal(u.cargo, 5);
  until(g, () => u.phase === 'idle'); ticks(g, 30); assert.equal(u.cargo, 5); assert.deepEqual(g.s.stock, original); assert.deepEqual(g.s.spent, spent);
  const held = new Camp(snapshot(g)); assert.deepEqual(held.s, g.s);
  assert.equal(g.command(['u0'], { kind: 'idle' }), 1); until(g, () => !u.cargo); ticks(g, 30);
  assert.equal(u.reclaim, undefined); assert.equal(u.order.kind, 'idle'); assert.deepEqual(claim(g).assigned, []);
  assert.deepEqual(claim(g).unreleased, { wood: 55, stone: 20, food: 0 }); assert.deepEqual(g.s.reclaim.recovered, { wood: 5, stone: 0, food: 0 });
  begin(g, ['u1']); until(g, () => !exists(g)); assert.deepEqual(g.s.reclaim.recovered, BILL);
});

test('valid loaded Gather, Build, Craft and Transfer switches return the reclaim load before new work', () => {
  for (const kind of ['gather', 'build', 'craft', 'transfer']) {
    const g = camp({ buildings: [building('b1', 'outpost', 11, 11), building('b2', 'workshop', 11, 16), building('b3', 'outpost', 2, 8)] }), u = g.s.units[0];
    const site = kind === 'build' ? g.build('workshop', 13, 3, []) : null;
    if (site) assert.ok(site.id);
    begin(g); until(g, () => !!u.reclaim); const recovered = copy(g.s.reclaim.recovered);
    if (kind === 'gather') assert.equal(g.command(['u0'], { kind: 'gather', target: 'd3' }), 1);
    if (kind === 'build') assert.equal(g.command(['u0'], { kind: 'build', target: site.id }), 1);
    if (kind === 'craft') assert.equal(g.beginKnapping('b2', ['u0']), null);
    if (kind === 'transfer') assert.ok(g.transfer(['u0'], 'b0', 'b3', 'stone').id);
    assert.equal(u.cargo, 5); assert.equal(u.reclaim.claimId, 'b1'); assert.equal(u.phase, 'return');
    assert.equal(u.next.kind, kind); assert.deepEqual(claim(g).assigned, []);
    until(g, () => !u.reclaim);
    assert.equal(g.s.reclaim.recovered.wood, recovered.wood + 5);
    assert.equal(u.order.kind, kind); assert.deepEqual(claim(g).unreleased, { wood: 55, stone: 20, food: 0 });
    g.command(['u0'], { kind: 'idle' }); until(g, () => !u.cargo); ticks(g, 20);
    assert.deepEqual(claim(g).assigned, []); assert.deepEqual(claim(g).unreleased, { wood: 55, stone: 20, food: 0 });
  }
});

test('invalid overrides and invalid replacement recovery retain all existing assignments and cargo', () => {
  const g = camp({ buildings: [building('b1', 'outpost', 11, 11), building('b2', 'outpost', 2, 8)] }); begin(g);
  for (const loaded of [false, true]) {
    if (loaded) until(g, () => !!g.s.units[0].reclaim);
    const before = g.serialize();
    for (const order of [{ kind: 'move', x: 18, y: 2 }, { kind: 'gather', target: 'missing' }, { kind: 'build', target: 'missing' }, { kind: 'craft', target: 'missing' }]) {
      assert.equal(g.command(['u0'], order), 0); assert.equal(g.serialize(), before);
    }
    refused(g, ['u0', 'missing'], 'b2'); assert.equal(g.serialize(), before);
  }
});

test('an empty worker can replace its recovery assignment only after the new group passes admission', () => {
  const g = camp({ buildings: [building('b1', 'outpost', 11, 11), building('b2', 'outpost', 2, 8)] }); begin(g);
  begin(g, ['u0'], 'b2'); assert.deepEqual(claim(g, 'b1').assigned, []); assert.deepEqual(claim(g, 'b2').assigned, ['u0']);
  until(g, () => !exists(g, 'b2')); assert.deepEqual(claim(g).unreleased, BILL);
  assert.equal(g.s.units[0].order.kind, 'idle'); assert.equal(exists(g), true); check(g);
});

test('a manually held final load keeps the footprint until its one receipt, then clears all references', () => {
  const g = camp(), u = g.s.units[0]; begin(g);
  until(g, () => claim(g) && RES.every(r => claim(g).unreleased[r] === 0) && !!u.reclaim, 'final load pickup');
  assert.equal(u.resource, 'stone'); assert.equal(u.cargo, 5);
  g.command(['u0'], { kind: 'move', x: 14, y: 8 }); until(g, () => u.phase === 'idle'); ticks(g, 20);
  assert.equal(exists(g), true); assert.equal(g.blocked(11, 11), true); assert.deepEqual(claim(g).assigned, []);
  const reload = new Camp(snapshot(g)); assert.deepEqual(reload.s, g.s);
  g.command(['u0'], { kind: 'idle' }); until(g, () => !exists(g));
  assert.equal(claim(g), undefined); assert.equal(u.reclaim, undefined); assert.equal(u.cargo, 0); assert.equal(u.order.kind, 'idle');
  assert.equal(g.s.units.some(v => [v.order, v.next].some(o => o?.kind === 'reclaim' && o.target === 'b1')), false);
  assert.deepEqual(g.s.reclaim.recovered, BILL); assert.deepEqual(g.s.reclaim.settled, BILL); assert.equal(g.s.reclaim.settledSites, 1);
  const before = g.serialize(); assert.ok(g.reclaim(['u1'], 'b1').error); assert.equal(g.serialize(), before);
});

test('v6 reload never reissues partly recovered claims and rejects forged custody partitions', () => {
  const g = camp(); begin(g); until(g, () => !!g.s.units[0].reclaim); const original = snapshot(g);
  assert.deepEqual(new Camp(original).s, g.s);
  for (const mutate of [
    s => s.reclaim.profile = 'unknown', s => s.reclaim.claims.push(copy(s.reclaim.claims[0])),
    s => s.reclaim.claims[0].unreleased.wood++, s => s.reclaim.claims[0].receipted.wood++,
    s => s.reclaim.recovered.wood++, s => s.reclaim.settledSites++,
    s => delete s.units[0].reclaim, s => s.units[0].reclaim.claimId = 'missing',
    s => s.units[0].resource = 'stone', s => s.units[0].cargo = 0,
    s => s.reclaim.claims[0].assigned.push('missing'), s => s.reclaim.claims[0].assigned.push(s.reclaim.claims[0].assigned[0]),
    s => s.version = 7, s => s.nextId = 10000000
  ]) {
    const bad = copy(original); mutate(bad); const before = copy(bad);
    assert.equal(valid(bad), false); assert.throws(() => new Camp(bad)); assert.deepEqual(bad, before);
  }
  until(g, () => g.s.reclaim.recovered.wood >= 5); const received = snapshot(g); assert.deepEqual(new Camp(received).s, g.s);
  assert.ok(claim(g).unreleased.wood < 60); check(g);
});

test('assigned recovery workers reject forged working phases while blocked tagged custody remains loadable', () => {
  const g = camp(); begin(g); const empty = snapshot(g);
  for (const phase of ['construct', 'extract', 'craft', 'walk', 'return', 'pickup', 'transfer']) {
    const bad = copy(empty); bad.units[0].phase = phase; bad.units[0].path = [];
    assert.equal(valid(bad), false, 'An assigned empty reclaim worker cannot enter ' + phase);
    assert.throws(() => new Camp(bad));
  }
  const falseReceipt = copy(empty); falseReceipt.units[0].dropoff = 'b0';
  assert.equal(valid(falseReceipt), false); assert.throws(() => new Camp(falseReceipt));
  until(g, () => !!g.s.units[0].reclaim); const held = snapshot(g);
  held.units[0].phase = 'idle'; held.units[0].path = []; delete held.units[0].dropoff;
  assert.equal(valid(held), true, 'Blocked loaded recovery keeps its actual custody and assignment');
  const resumed = new Camp(held); assert.deepEqual(resumed.s, held);
  assert.equal(resumed.command(['u0'], { kind: 'move', x: 14, y: 8 }), 1);
  until(resumed, () => resumed.s.units[0].phase === 'idle');
  assert.equal(resumed.s.units[0].cargo, 5); assert.equal(resumed.s.units[0].reclaim.claimId, 'b1');
  check(resumed);
});

test('more than forty actual build/reclaim cycles compact only settled history and remain reloadable', () => {
  const g = camp(); const initial = world(g); let id = 'b1'; const ids = g.s.units.map(u => u.id);
  for (let cycle = 0; cycle < 45; cycle++) {
    begin(g, ids, id); until(g, () => !exists(g, id));
    assert.ok(g.s.storage.payments.length <= 40); assert.equal(g.s.reclaim.claims.length, 0);
    assert.deepEqual(world(g), initial); assert.deepEqual(new Camp(snapshot(g)).s, g.s);
    if (cycle < 44) {
      const next = g.build('outpost', 11, 11, ids); assert.ok(next.id, next.error); assert.notEqual(next.id, id); id = next.id;
      until(g, () => g.s.buildings.find(b => b.id === id)?.done);
      until(g, () => g.s.units.every(u => u.order.kind === 'idle'), 'construction assignments to settle');
      assert.deepEqual(claim(g, id).unreleased, BILL); assert.deepEqual(claim(g, id).receipted, zero());
    }
  }
  assert.equal(g.s.reclaim.settledSites, 45); assert.deepEqual(g.s.reclaim.recovered, { wood: 2700, stone: 900, food: 0 });
  assert.ok(g.s.buildings.length <= 30); assert.ok(g.s.storage.payments.length <= 40); check(g);
});

test('numeric ID headroom rejects optional construction before spend and cannot strand admitted recovery', () => {
  const source = legacy(); source.nextId = 9999999; const g = new Camp(source); assert.equal(g.s.version, 6);
  const before = g.serialize(); assert.ok(g.build('outpost', 13, 3, []).error); assert.equal(g.serialize(), before);
  const active = camp(); begin(active); active.s.nextId = 9999999;
  until(active, () => !exists(active)); assert.deepEqual(active.s.reclaim.recovered, BILL); assert.equal(active.s.nextId, 9999999);
  assert.doesNotThrow(() => new Camp(snapshot(active)));
  const reserved = legacy({ buildings: [building('b1', 'outpost', 11, 11), building('b2', 'workshop', 11, 16)] });
  reserved.nextId = 9999998; const opening = new Camp(reserved), saved = opening.serialize();
  assert.ok(opening.build('outpost', 13, 3, []).error); assert.equal(opening.serialize(), saved);
  const required = opening.build('outpost', 23, 11, []); assert.equal(required.id, 'b9999998', required.error); check(opening);
});

test('fixed cumulative recovery summary headroom is preflighted before optional retirement', () => {
  const g = camp(); g.s.nextId = 166668;
  g.s.reclaim.settledSites = 166666; g.s.reclaim.closedPayments = 166666;
  g.s.reclaim.settled = { wood: 9999960, stone: 3333320, food: 0 };
  g.s.reclaim.recovered = copy(g.s.reclaim.settled);
  check(g); refused(g, ['u0'], 'b1', /limit|range|headroom|capacity|counter/i);
});

test('payment-summary limits reject crafting, recruitment and construction without creating unpaid work', () => {
  const s = legacy({ buildings: [building('b1', 'outpost', 11, 11), building('b2', 'workshop', 4, 11)] });
  s.deposits[3].amount -= 25; s.stock.food = 25; s.storage.stores.b0.food = 25; s.delivered.food = 25;
  const g = new Camp(s); assert.equal(g.knappingFunding('b2').storeId, 'b0'); assert.deepEqual(g.knappingFunding('b2').missing, zero());
  g.s.reclaim.closedPayments = 9999996; check(g);
  const before = g.serialize();
  assert.ok(g.beginKnapping('b2', ['u0'])); assert.equal(g.serialize(), before);
  assert.ok(g.train()); assert.equal(g.serialize(), before);
  assert.ok(g.build('outpost', 13, 3, []).error); assert.equal(g.serialize(), before);
});
