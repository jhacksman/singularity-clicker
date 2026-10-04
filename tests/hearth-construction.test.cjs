const test = require('node:test');
const assert = require('node:assert/strict');
const { Camp, valid } = require('../src/hearth-rts/engine.js');

// Independent contract constants. Main scenarios earn every item with public orders.
const PROFILE = 'accepted-opening.physical-construction.v1';
const RES = ['wood', 'stone', 'food'];
const TOTAL = { wood: 416, stone: 220, food: 225 };
const BILL = { outpost: { wood: 60, stone: 20, food: 0 }, workshop: { wood: 40, stone: 30, food: 0 } };
const WORK = { outpost: 24, workshop: 32 };
const zero = () => ({ wood: 0, stone: 0, food: 0 });
const copy = value => structuredClone(value);
const snapshot = g => JSON.parse(g.serialize());
const ids = g => g.s.units.map(u => u.id);
const site = (g, id) => g.s.construction.sites.find(c => c.buildingId === id);
const building = (g, id) => g.s.buildings.find(b => b.id === id);
const sum = (rows, r) => rows.filter(p => p.resource === r).reduce((n, p) => n + p.amount, 0);
const cargo = (g, id, r) => g.s.units.filter(u => u.supply?.siteId === id && u.resource === r).reduce((n, u) => n + u.cargo, 0);
const world = g => Object.fromEntries(RES.map(r => [r,
  g.s.deposits.filter(d => d.kind === r).reduce((n, d) => n + d.amount, 0)
  + Object.values(g.s.storage.stores).reduce((n, stock) => n + stock[r], 0)
  + g.s.units.filter(u => u.resource === r).reduce((n, u) => n + u.cargo, 0)
  + g.s.construction.sites.reduce((n, c) => n + c.staged[r], 0) + g.s.spent[r]
]));

function check(g) {
  assert.equal(g.s.version, 6);
  assert.equal(g.s.construction.profile, PROFILE);
  assert.equal(valid(g.s), true, 'Every physical transition must remain strictly saveable');
  assert.deepEqual(world(g), TOTAL);
  assert.equal(new Set(g.s.construction.sites.map(c => c.buildingId)).size, g.s.construction.sites.length);
  for (const r of RES) assert.equal(Object.values(g.s.storage.stores).reduce((n, stock) => n + stock[r], 0), g.s.stock[r]);
  for (const c of g.s.construction.sites) {
    const b = building(g, c.buildingId); assert.ok(b && !b.done); assert.equal(b.supplyProfile, PROFILE);
    assert.equal(g.s.storage.reservations[b.id], undefined, 'Physical supplies have no prepaid refund authority');
    assert.equal(g.s.storage.payments.some(p => p.kind === 'construction' && p.target === b.id), false);
    assert.equal(g.s.reclaim.claims.some(p => p.buildingId === b.id), false, 'An unfinished physical outpost has no capital claim');
    assert.equal(new Set(c.sources.map(p => p.storeId + ':' + p.resource)).size, c.sources.length);
    for (const r of RES) {
      assert.equal(sum(c.sources, r) + c.staged[r] + cargo(g, b.id, r) + c.released[r] + c.returned[r], BILL[b.kind][r]);
      assert.equal(sum(c.origins, r), c.staged[r]);
    }
    if (c.state === 'active') { assert.deepEqual(c.released, zero()); assert.deepEqual(c.returned, zero()); }
    else { assert.equal(c.state, 'cancelling'); assert.deepEqual(c.sources, []); }
    if (c.state === 'active' && b.work > 0) assert.deepEqual(c.staged, BILL[b.kind]);
  }
  for (const b of g.stores()) for (const r of RES) {
    const construction = g.s.construction.sites.reduce((n, c) => n + c.sources.filter(p => p.storeId === b.id && p.resource === r).reduce((m, p) => m + p.amount, 0), 0);
    const transfer = g.s.storage.transfers.filter(j => j.from === b.id && j.resource === r).reduce((n, j) => n + j.remaining, 0);
    assert.equal(b.reserved[r], construction + transfer);
    assert.equal(b.available[r], b.stock[r] - b.reserved[r]);
  }
  for (const u of g.s.units.filter(u => u.supply)) {
    assert.ok(u.cargo > 0 && u.cargo <= 5); assert.equal(u.transfer, undefined); assert.equal(u.reclaim, undefined);
    assert.equal(u.supplyPickup, undefined); assert.ok(site(g, u.supply.siteId));
    if (u.supply.origin !== null) { assert.equal(u.supply.origin.amount, u.cargo); assert.equal(u.supply.origin.resource, u.resource); }
    else assert.equal(site(g, u.supply.siteId).state, 'cancelling');
  }
}

function roundtrip(g) {
  check(g); const raw = g.serialize(), state = JSON.parse(raw), input = JSON.stringify(state), restored = new Camp(state);
  assert.equal(JSON.stringify(state), input); assert.deepEqual(restored.s, g.s); assert.equal(restored.serialize(), raw);
  return restored;
}
function tick(g, dt = .1) { g.tick(dt); check(g); }
function until(g, predicate, label = 'physical transition', limit = 16000) {
  for (let i = 0; i < limit && !predicate(); i++) tick(g);
  assert.ok(predicate(), 'Expected ' + label + ' within the finite bound');
}
function stop(g, selected = ids(g)) {
  g.command(selected, { kind: 'idle' }); until(g, () => g.s.units.filter(u => selected.includes(u.id)).every(u => u.cargo === 0), 'physical return');
}
let opening;
function earned() {
  if (!opening) {
    const g = new Camp(); check(g);
    for (const target of ['d0', 'd1', 'd2']) {
      assert.equal(g.command(ids(g), { kind: 'gather', target }), 4);
      until(g, () => g.s.units.every(u => u.phase === 'idle'), 'earned western resources');
    }
    assert.deepEqual(g.s.stock, { wood: 116, stone: 70, food: 0 });
    assert.deepEqual(g.s.delivered, { wood: 96, stone: 60, food: 0 }); opening = snapshot(g);
  }
  return new Camp(opening);
}
function place(g, kind = 'outpost', x = 11, y = 15, selected = ['u0']) {
  const result = g.build(kind, x, y, selected); assert.ok(result.id, result.error); check(g); return result.id;
}
function finish(g, id) { until(g, () => building(g, id)?.done, 'full supply and installation'); until(g, () => !g.s.units.some(u => u.order.kind === 'build' && u.order.target === id), 'settled installation orders'); }
function picked(kind = 'outpost') {
  const g = earned(), id = place(g, kind); until(g, () => !!g.s.units[0].supply, 'first source pickup'); return { g, id, u: g.s.units[0] };
}
function staged(kind = 'outpost', complete = false) {
  const g = earned(), id = place(g, kind); until(g, () => complete ? RES.every(r => site(g, id).staged[r] === BILL[kind][r]) : site(g, id).staged.wood === 5, 'onsite delivery');
  stop(g); return { g, id, u: g.s.units[0] };
}

test('placement reserves the exact recipe in actual stores without payment, work, production or a premature claim', () => {
  for (const kind of ['outpost', 'workshop']) {
    const g = earned(), stock = copy(g.s.stock), spent = copy(g.s.spent), produced = copy(g.s.delivered), time = g.s.time;
    const before = g.serialize(), q = g.funding(kind, 11, 15); assert.equal(g.serialize(), before); assert.equal(q.error, null);
    const id = place(g, kind, 11, 15, []), c = site(g, id);
    assert.deepEqual(g.s.stock, stock); assert.deepEqual(g.s.spent, spent); assert.deepEqual(g.s.delivered, produced); assert.equal(g.s.time, time);
    assert.deepEqual(c.staged, zero()); assert.deepEqual(c.origins, []); assert.equal(building(g, id).work, 0); assert.equal(g.store(id), null);
    for (const r of RES) { assert.equal(sum(c.sources, r), BILL[kind][r]); assert.equal(g.store('b0').available[r], stock[r] - BILL[kind][r]); }
    roundtrip(g);
    assert.equal(g.cancel(id), true); assert.equal(building(g, id), undefined); assert.equal(site(g, id), undefined);
    assert.deepEqual(g.s.stock, stock); assert.deepEqual(g.s.spent, spent); const cancelled = g.serialize();
    assert.equal(g.cancel(id), false); assert.equal(g.serialize(), cancelled); roundtrip(g);
  }
});

test('one Build assignment performs exactly sixteen outpost or fourteen workshop loads before original installation work', () => {
  for (const kind of ['outpost', 'workshop']) {
    const g = earned(), id = place(g, kind), u = g.s.units[0], produced = copy(g.s.delivered), transferred = copy(g.s.storage.transferred), paid = copy(g.s.spent);
    const loads = [], delivered = zero(); let funded = false, sawUnworkedStack = false, previousWork = 0;
    for (let i = 0; i < 16000 && !building(g, id).done; i++) {
      const beforeCargo = u.cargo, beforeStock = copy(g.s.stock), c = site(g, id), beforeStaged = copy(c.staged), beforeWork = building(g, id).work;
      tick(g); const b = building(g, id), next = site(g, id);
      if (u.cargo > beforeCargo) {
        assert.equal(u.cargo, 5); assert.equal(u.phase, 'supplyDeliver'); assert.equal(u.supply.siteId, id);
        assert.deepEqual(u.supply.origin, { storeId: 'b0', kind: 'hearth', x: 7, y: 11, resource: u.resource, amount: 5 });
        assert.equal(beforeStock[u.resource] - g.s.stock[u.resource], 5); assert.equal(b.work, 0); loads.push([u.resource, 5]);
      }
      if (next) for (const r of RES) if (next.staged[r] > beforeStaged[r]) {
        const n = next.staged[r] - beforeStaged[r]; assert.equal(n, 5); delivered[r] += n;
        assert.equal(u.cargo, 0); assert.deepEqual(g.s.stock, beforeStock, 'Onsite unloading does not add store inventory');
      }
      if (next && next.staged.wood === 5 && next.staged.stone === 0) { sawUnworkedStack = true; assert.equal(b.work, 0); }
      if (next && RES.every(r => next.staged[r] === BILL[kind][r])) funded = true;
      if (b.work > beforeWork) { assert.equal(funded, true); assert.ok(b.work - beforeWork <= .1 + 1e-9); }
      assert.ok(b.work >= previousWork); previousWork = b.work;
      if (!b.done) { assert.deepEqual(g.s.spent, paid); assert.equal(g.store(id), null); }
      assert.deepEqual(g.s.delivered, produced); assert.deepEqual(g.s.storage.transferred, transferred);
      if (u.cargo !== beforeCargo || b.work !== beforeWork || b.done) roundtrip(g);
    }
    assert.equal(building(g, id).done, true); assert.equal(building(g, id).work, WORK[kind]); assert.equal(sawUnworkedStack, true);
    assert.equal(loads.length, kind === 'outpost' ? 16 : 14); assert.deepEqual(delivered, BILL[kind]); assert.equal(site(g, id), undefined);
    for (const r of RES) assert.equal(g.s.spent[r], paid[r] + BILL[kind][r]);
    if (kind === 'outpost') {
      assert.ok(g.store(id)); const claim = g.s.reclaim.claims.find(c => c.id === id);
      assert.equal(claim.basis.rule, 'delivered-construction'); assert.equal(claim.basis.origin, 'physical-delivery');
      assert.deepEqual(claim.unreleased, BILL.outpost); for (const r of RES) assert.equal(sum(claim.origin, r), BILL.outpost[r]);
    }
    roundtrip(g);
  }
});

function readyAtSiteEdges(g, id, count) {
  stop(g); const b = building(g, id), selected = ids(g).slice(0, count);
  const edges = [{ x: b.x - 1, y: b.y }, { x: b.x - 1, y: b.y + 1 }, { x: b.x + 2, y: b.y }, { x: b.x + 2, y: b.y + 1 }];
  selected.forEach((worker, i) => { assert.equal(g.command([worker], { kind: 'move', ...edges[i] }), 1); });
  until(g, () => g.s.units.filter(u => selected.includes(u.id)).every(u => u.phase === 'idle'), 'distinct adjacent worker positions');
  selected.forEach((worker, i) => { const u = g.s.units.find(u => u.id === worker); assert.equal(u.cargo, 0); assert.equal(u.x, edges[i].x); assert.equal(u.y, edges[i].y); });
  return selected;
}

test('fully supplied installation adds exactly dt per adjacent worker for one and four workers including its capped final tick', () => {
  for (const kind of ['outpost', 'workshop']) for (const count of [1, 4]) {
    const { g, id } = staged(kind, true), b = building(g, id), selected = readyAtSiteEdges(g, id, count), spent = copy(g.s.spent), dt = .13;
    assert.deepEqual(site(g, id).staged, BILL[kind]); assert.equal(b.work, 0);
    assert.equal(g.command(selected, { kind: 'build', target: id }), count); let capped = false;
    for (let i = 0; i < 400 && !b.done; i++) {
      const eligible = g.s.units.filter(u => u.order.kind === 'build' && u.order.target === id && u.phase === 'construct' && !u.path.length && !u.cargo && g.around(b).some(p => p.x === u.x && p.y === u.y));
      assert.equal(eligible.length, count); const before = b.work, gain = Math.min(WORK[kind] - before, dt * eligible.length), expected = before + gain;
      if (WORK[kind] - before < dt * eligible.length) capped = true;
      tick(g, dt); assert.ok(Math.abs(b.work - expected) < 1e-8, `${kind}/${count}: expected ${gain} work, received ${b.work - before}`);
      if (!b.done) assert.deepEqual(g.s.spent, spent);
    }
    assert.equal(capped, true); assert.equal(b.done, true); assert.equal(b.work, WORK[kind]);
    for (const r of RES) assert.equal(g.s.spent[r], spent[r] + BILL[kind][r]); roundtrip(g);
  }
});

test('Tools018 adds exactly twelve actual worker-seconds for one and four adjacent artisans including the capped final tick', () => {
  for (const count of [1, 4]) {
    const g = earned(), id = place(g, 'workshop', 11, 15, ids(g)); finish(g, id);
    const selected = readyAtSiteEdges(g, id, count), stock = copy(g.s.stock), dt = .13;
    assert.equal(g.beginKnapping(id, selected), null); assert.equal(g.s.stock.wood, stock.wood - 4); assert.equal(g.s.stock.stone, stock.stone - 8);
    const paid = copy(g.s.spent); let capped = false;
    for (let i = 0; i < 200 && !g.s.tools; i++) {
      const b = building(g, id), eligible = g.s.units.filter(u => u.order.kind === 'craft' && u.order.target === id && u.phase === 'craft' && !u.path.length && !u.cargo && g.around(b).some(p => p.x === u.x && p.y === u.y));
      assert.equal(eligible.length, count); const before = g.s.knapping.work, gain = Math.min(12 - before, dt * eligible.length);
      if (12 - before < dt * eligible.length) capped = true;
      tick(g, dt); assert.ok(Math.abs(g.s.knapping.work - before - gain) < 1e-8, `${count} artisans: expected ${gain} work`); assert.deepEqual(g.s.spent, paid);
    }
    assert.equal(capped, true); assert.equal(g.s.tools, true); assert.equal(g.s.knapping.work, 12); assert.equal(g.s.knapping.done, true); roundtrip(g);
  }
});

test('a completed eastern supply line receives real gathering and physically supplies a useful workshop and paid tools', () => {
  const g = earned(); g.command(['u0'], { kind: 'move', x: 25, y: 14 }); until(g, () => g.s.units[0].phase === 'idle');
  const depot = place(g, 'outpost', 23, 11, ids(g)); finish(g, depot);
  const produced = copy(g.s.delivered);
  for (const [target, resource, amount] of [['d4', 'wood', 45], ['d6', 'stone', 40]]) {
    g.command(ids(g), { kind: 'gather', target }); until(g, () => g.store(depot).stock[resource] >= amount); stop(g);
  }
  assert.ok(g.s.delivered.wood > produced.wood); assert.ok(g.store(depot).stock.wood >= 45);
  const workshop = place(g, 'workshop', 26, 13, ids(g));
  assert.equal(site(g, workshop).sources.every(p => p.storeId === depot), true); finish(g, workshop);
  const beforeTools = copy(g.s.stock); assert.equal(g.beginKnapping(workshop, ids(g)), null);
  assert.equal(g.s.stock.wood, beforeTools.wood - 4); assert.equal(g.s.stock.stone, beforeTools.stone - 8);
  until(g, () => g.s.tools, 'twelve worker-seconds of paid tools'); assert.equal(g.s.knapping.work, 12);
  const prior = g.s.delivered.wood; g.command(ids(g), { kind: 'gather', target: 'd4' }); until(g, () => g.s.delivered.wood >= prior + 5, 'useful subsequent haul');
  stop(g); roundtrip(g);
});

test('multiple workers race for the last five reserved items exactly once and idle builders resume automatically', () => {
  const g = earned(), id = place(g); until(g, () => sum(site(g, id).sources, 'stone') === 5 && site(g, id).staged.wood === 60 && site(g, id).staged.stone === 15 && g.s.units[0].cargo === 0, 'only the last five stone remain');
  stop(g); g.command(ids(g), { kind: 'build', target: id }); let sawLast = false, sawWaiter = false, pickups = 0;
  for (let i = 0; i < 12000 && !building(g, id).done; i++) {
    const c = site(g, id), remaining = RES.reduce((n, r) => n + sum(c.sources, r), 0), held = g.s.units.map(u => u.cargo);
    if (remaining === 5) sawLast = true;
    if (remaining === 0 && g.s.units.some(u => u.supply) && g.s.units.some(u => !u.cargo && u.order.kind === 'build' && u.order.target === id)) sawWaiter = true;
    tick(g);
    for (let j = 0; j < held.length; j++) if (g.s.units[j].cargo > held[j]) pickups++;
    if (remaining === 5) assert.ok(g.s.units.filter((u, j) => u.cargo > held[j]).length <= 1, 'No duplicate pickup of the final load');
  }
  assert.equal(sawLast, true); assert.equal(sawWaiter, true); assert.equal(pickups, 1); assert.equal(building(g, id).work, 24); roundtrip(g);
});

test('uneven current allocations let two workers take five and the final one item without duplicating either source', () => {
  const g = earned(), depot = place(g, 'outpost', 11, 11, ids(g)); finish(g, depot);
  for (const selected of [ids(g), ids(g), ['u0', 'u1']]) { assert.ok(g.transfer(selected, 'b0', depot, 'wood').id); until(g, () => !g.s.storage.transfers.length); }
  assert.equal(g.store('b0').stock.wood, 6); assert.equal(g.store(depot).stock.wood, 50);
  const edges = [[6, 11], [6, 12], [6, 13], [7, 14]];
  ids(g).forEach((id, i) => { assert.equal(g.command([id], { kind: 'move', x: edges[i][0], y: edges[i][1] }), 1); });
  until(g, () => g.s.units.every(u => u.phase === 'idle'));
  const id = place(g, 'workshop', 4, 15, ['u3', 'u2', 'u1', 'u0']), c = site(g, id), produced = copy(g.s.delivered);
  assert.equal(c.sources.find(p => p.storeId === 'b0' && p.resource === 'wood').amount, 6);
  assert.equal(c.sources.find(p => p.storeId === depot && p.resource === 'wood').amount, 34);
  assert.ok(g.s.units.every(u => u.phase === 'supplyPickup' && u.path.length === 0));
  tick(g); assert.equal(g.s.units[0].cargo, 5); assert.equal(g.s.units[1].cargo, 1);
  assert.equal(g.s.units[0].resource, 'wood'); assert.equal(g.s.units[1].resource, 'wood');
  assert.equal(g.s.units[1].supply.origin.amount, 1); assert.equal(g.s.units.filter(u => u.supply?.origin.storeId === 'b0' && u.resource === 'wood').reduce((n, u) => n + u.cargo, 0), 6);
  assert.equal(g.store('b0').stock.wood, 0); assert.equal(g.store(depot).stock.wood, 50); assert.equal(c.sources.some(p => p.storeId === 'b0' && p.resource === 'wood'), false);
  roundtrip(g); finish(g, id); assert.deepEqual(g.s.delivered, produced); assert.equal(building(g, id).work, 32); roundtrip(g);
});

test('repeating Build assignments never changes the accepted path, cargo or reservation and invalid mixed groups are atomic', () => {
  const a = earned(), id = place(a, 'workshop', 11, 15, ['u0', 'u1']), b = new Camp(snapshot(a));
  for (let i = 0; i < 700; i++) {
    const raw = b.serialize(); b.command(['u1', 'u0'], { kind: 'build', target: id }); assert.equal(b.serialize(), raw);
    a.tick(.1); b.tick(.1); check(a); check(b); assert.deepEqual(b.s, a.s);
    if (building(a, id).done) break;
  }
  const raw = b.serialize();
  for (const order of [{ kind: 'build', target: 'missing' }, { kind: 'gather', target: 'missing' }, { kind: 'move', x: 18, y: 2 }]) {
    assert.equal(b.command(['u0'], order), 0); assert.equal(b.serialize(), raw);
  }
  assert.equal(b.command(['u0', 'missing'], { kind: 'idle' }), 0); assert.equal(b.serialize(), raw);
  assert.ok(b.build('workshop', 13, 3, ['u0', 'missing']).error); assert.equal(b.serialize(), raw); roundtrip(b);
});

test('loaded Move starts immediately at three cells per second and holds physical site cargo until Stop returns it', () => {
  const { g, id, u } = picked(), tag = copy(u.supply), stock = copy(g.s.stock), produced = copy(g.s.delivered), p = { x: u.x, y: u.y };
  assert.equal(g.command(['u0'], { kind: 'move', x: 14, y: 8 }), 1); assert.equal(u.phase, 'carryMove'); assert.deepEqual(u.supply, tag);
  tick(g); const distance = Math.hypot(u.x - p.x, u.y - p.y); assert.ok(distance > 0 && distance <= .3 + 1e-12);
  until(g, () => u.phase === 'idle'); for (let i = 0; i < 30; i++) tick(g);
  assert.equal(u.cargo, 5); assert.deepEqual(g.s.stock, stock); assert.deepEqual(site(g, id).staged, zero()); roundtrip(g);
  const remaining = sum(site(g, id).sources, u.resource), resource = u.resource;
  assert.equal(g.command(['u0'], { kind: 'idle' }), 1); assert.equal(u.phase, 'return'); assert.equal(u.cargo, 5);
  until(g, () => u.cargo === 0); assert.equal(u.order.kind, 'idle'); assert.equal(u.supply, undefined);
  assert.equal(sum(site(g, id).sources, resource), remaining + 5); assert.deepEqual(g.s.delivered, produced); assert.deepEqual(g.s.storage.transferred, zero());
  g.command(['u0'], { kind: 'build', target: id }); finish(g, id); roundtrip(g);
});

test('Stop and Gather retain manual authority after a returned load is reserved again for its active site', () => {
  for (const order of [{ kind: 'idle' }, { kind: 'gather', target: 'd3' }]) {
    const { g, id, u } = picked(), produced = copy(g.s.delivered), before = sum(site(g, id).sources, u.resource), resource = u.resource;
    assert.equal(g.command(['u0'], order), 1); assert.equal(u.phase, 'return'); assert.deepEqual(u.next, order); roundtrip(g);
    until(g, () => !u.supply); assert.deepEqual(u.order, order); assert.equal(sum(site(g, id).sources, resource), before + 5);
    assert.deepEqual(g.s.delivered, produced); assert.deepEqual(site(g, id).staged, zero());
    for (let i = 0; i < 10; i++) tick(g); assert.deepEqual(u.order, order); assert.equal(u.supply, undefined); roundtrip(g);
  }
});

test('cancellation releases only unpicked goods and recovers carried and staged supplies in real five-item trips', () => {
  for (const boundary of ['carried', 'onsite', 'partial-work']) {
    const g = earned(), stock = copy(g.s.stock), spent = copy(g.s.spent), produced = copy(g.s.delivered), id = place(g);
    until(g, () => boundary === 'carried' ? !!g.s.units[0].supply : boundary === 'onsite' ? site(g, id).staged.wood === 5 : building(g, id).work >= 2, boundary);
    const before = copy(g.s.stock), reserved = Object.fromEntries(RES.map(r => [r, sum(site(g, id).sources, r)])), work = building(g, id).work;
    assert.equal(g.cancel(id), true); assert.deepEqual(g.s.stock, before); assert.deepEqual(site(g, id).released, reserved);
    assert.equal(site(g, id).state, 'cancelling'); assert.equal(building(g, id).work, work); assert.deepEqual(g.s.spent, spent); roundtrip(g);
    const raw = g.serialize(); g.cancel(id); assert.equal(g.serialize(), raw, 'Repeated Cancel cannot issue a second release');
    let recoveryLoads = 0;
    for (let i = 0; i < 16000 && building(g, id); i++) {
      const held = g.s.units.map(u => u.cargo); tick(g);
      if (building(g, id)) assert.equal(building(g, id).work, work);
      for (let j = 0; j < held.length; j++) if (g.s.units[j].cargo > held[j]) {
        const u = g.s.units[j]; assert.equal(u.cargo, 5); assert.deepEqual(u.supply, { siteId: id, origin: null }); recoveryLoads++;
      }
    }
    assert.equal(building(g, id), undefined); assert.equal(site(g, id), undefined);
    assert.equal(recoveryLoads, boundary === 'carried' ? 0 : boundary === 'onsite' ? 1 : 16);
    assert.deepEqual(g.s.stock, stock); assert.deepEqual(g.s.spent, spent); assert.deepEqual(g.s.delivered, produced); assert.deepEqual(g.s.storage.transferred, zero()); roundtrip(g);
  }
});

test('cancelled manually moved final load keeps the footprint and its manual order until one return receipt', () => {
  const { g, id, u } = picked(); g.command(['u0'], { kind: 'move', x: 14, y: 8 }); until(g, () => u.phase === 'idle');
  assert.equal(g.cancel(id), true); assert.equal(u.phase, 'idle'); assert.equal(u.cargo, 5); assert.deepEqual(u.order, { kind: 'idle' });
  for (let i = 0; i < 60; i++) tick(g); assert.ok(building(g, id)); assert.equal(g.blocked(11, 15), true); roundtrip(g);
  assert.equal(g.command(['u0'], { kind: 'idle' }), 1); until(g, () => !building(g, id));
  assert.equal(u.supply, undefined); assert.equal(u.cargo, 0); assert.equal(u.order.kind, 'idle'); assert.equal(g.blocked(11, 15), false); roundtrip(g);
});

test('Resume Build on a cancelling site recovers staged goods after its original worker manually leaves', () => {
  const { g, id } = staged(); const stock = copy(g.s.stock);
  assert.equal(g.cancel(id), true); assert.equal(site(g, id).state, 'cancelling');
  for (let i = 0; i < 40; i++) tick(g); assert.deepEqual(g.s.stock, stock); assert.equal(site(g, id).staged.wood, 5);
  assert.equal(g.command(['u1'], { kind: 'build', target: id }), 1); until(g, () => !building(g, id));
  assert.equal(g.s.stock.wood, stock.wood + 5); assert.equal(g.s.units[1].order.kind, 'idle'); roundtrip(g);
});

test('cancel of a queued Build replaces it with Idle and never resurrects the gathered order it superseded', () => {
  const g = earned(), id = place(g, 'outpost', 11, 15, []), u = g.s.units[0];
  g.command(['u0'], { kind: 'gather', target: 'd3' }); until(g, () => u.cargo === 1);
  const produced = g.s.delivered.food, load = u.cargo;
  assert.equal(g.command(['u0'], { kind: 'build', target: id }), 1); assert.deepEqual(u.next, { kind: 'build', target: id }); assert.equal(u.supply, undefined);
  assert.equal(g.cancel(id), true); assert.deepEqual(u.next, { kind: 'idle' }); assert.equal(u.cargo, load); roundtrip(g);
  until(g, () => !u.cargo); assert.equal(g.s.delivered.food, produced + load); assert.equal(u.order.kind, 'idle');
  for (let i = 0; i < 40; i++) tick(g); assert.equal(u.order.kind, 'idle'); assert.equal(u.cargo, 0); assert.equal(building(g, id), undefined); roundtrip(g);
});

test('cancel preserves an unrelated queued successor on site cargo and returns that cargo exactly once', () => {
  for (const successor of ['gather', 'build']) {
    const { g, id, u } = picked(), other = successor === 'build' ? place(g, 'workshop', 13, 3, []) : null;
    const order = successor === 'build' ? { kind: 'build', target: other } : { kind: 'gather', target: 'd3' };
    assert.equal(g.command(['u0'], order), 1); assert.deepEqual(u.next, order); const stock = copy(g.s.stock), resource = u.resource, load = u.cargo;
    assert.equal(g.cancel(id), true); assert.deepEqual(u.next, order); assert.equal(u.cargo, load); roundtrip(g);
    until(g, () => u.supply?.siteId !== id); assert.equal(g.s.stock[resource], stock[resource] + load); assert.deepEqual(u.order, order);
    assert.equal(building(g, id), undefined); assert.equal(u.supply, undefined); roundtrip(g);
  }
});

test('cancel of queued Build preserves ordinary transfer and reclaim receipt authority, then idles', () => {
  for (const authority of ['transfer', 'reclaim']) {
    const g = earned(), depot = place(g, 'outpost', 11, 11, ids(g)); finish(g, depot);
    const id = place(g, 'workshop', 13, 3, []), u = g.s.units[0], produced = copy(g.s.delivered);
    if (authority === 'transfer') {
      assert.ok(g.transfer(['u0'], 'b0', depot, 'wood').id); until(g, () => !!u.transfer);
    } else { assert.ok(g.reclaim(['u0'], depot).id); until(g, () => !!u.reclaim); }
    const tag = authority === 'transfer' ? u.transfer : copy(u.reclaim), load = u.cargo;
    assert.equal(g.command(['u0'], { kind: 'build', target: id }), 1); assert.deepEqual(u.next, { kind: 'build', target: id });
    const stock = g.s.stock.wood, recovered = g.s.reclaim.recovered.wood, transferred = g.s.storage.transferred.wood, receiver = u.dropoff, receiverStock = g.store(receiver).stock.wood;
    assert.equal(g.cancel(id), true); assert.deepEqual(u.next, { kind: 'idle' }); assert.equal(u.supply, undefined);
    assert.deepEqual(authority === 'transfer' ? u.transfer : u.reclaim, tag); assert.equal(u.cargo, load); roundtrip(g);
    until(g, () => u.cargo === 0); assert.equal(u.order.kind, 'idle'); assert.equal(g.s.stock.wood, stock + load); assert.equal(g.store(receiver).stock.wood, receiverStock + load);
    assert.deepEqual(g.s.delivered, produced); assert.equal(building(g, id), undefined);
    if (authority === 'reclaim') assert.equal(g.s.reclaim.recovered.wood, recovered + load);
    else { assert.equal(g.s.storage.transfers.length, 0); assert.equal(g.s.storage.transferred.wood, transferred + (receiver === depot ? load : 0)); }
    for (let i = 0; i < 20; i++) tick(g); assert.equal(u.order.kind, 'idle'); assert.equal(u.cargo, 0); roundtrip(g);
  }
});

test('cancel of queued Build B returns active Build A cargo without reviving the superseded Build A order', () => {
  const { g, id: first, u } = picked(), second = place(g, 'workshop', 13, 3, []), resource = u.resource;
  assert.deepEqual(u.order, { kind: 'build', target: first }); assert.equal(u.supply.siteId, first); assert.equal(u.cargo, 5);
  const reserved = sum(site(g, first).sources, resource), produced = copy(g.s.delivered);
  assert.equal(g.command(['u0'], { kind: 'build', target: second }), 1);
  assert.deepEqual(u.order, { kind: 'build', target: first }); assert.deepEqual(u.next, { kind: 'build', target: second });
  assert.equal(g.cancel(second), true); assert.deepEqual(u.next, { kind: 'idle' }); assert.equal(u.supply.siteId, first); roundtrip(g);
  until(g, () => !u.cargo); assert.equal(u.order.kind, 'idle'); assert.equal(u.next, null); assert.equal(u.supply, undefined);
  assert.equal(sum(site(g, first).sources, resource), reserved + 5); assert.deepEqual(site(g, first).staged, zero()); assert.deepEqual(g.s.delivered, produced);
  for (let i = 0; i < 40; i++) tick(g); assert.equal(u.order.kind, 'idle'); assert.equal(u.cargo, 0); assert.equal(building(g, first).work, 0);
  assert.equal(building(g, second), undefined); roundtrip(g);
});

test('new placement replans an existing delivery to its site without converting the cargo to a store return', () => {
  const { g, id, u } = picked(), tag = copy(u.supply); const other = place(g, 'workshop', 13, 3, []);
  assert.equal(u.phase, 'supplyDeliver'); assert.deepEqual(u.order, { kind: 'build', target: id }); assert.deepEqual(u.supply, tag); assert.equal(u.dropoff, undefined);
  until(g, () => site(g, id).staged.wood === 5); assert.equal(u.cargo, 0); assert.equal(site(g, other).staged.wood, 0); roundtrip(g);
});

test('construction reservations compete with transfers, paid tools and recruitment using only free current stock', () => {
  const g = earned(), workshop = place(g, 'workshop', 11, 15, ids(g)); finish(g, workshop);
  const depot = place(g, 'outpost', 11, 11, ids(g)); finish(g, depot);
  assert.equal(g.store('b0').stock.wood, 16);
  g.transfer(ids(g), 'b0', depot, 'wood'); assert.equal(g.store('b0').available.wood, 0);
  const before = g.serialize(); assert.ok(g.beginKnapping(workshop, ['u0'])); assert.equal(g.serialize(), before);
  assert.ok(g.train()); assert.equal(g.serialize(), before); assert.ok(g.build('workshop', 13, 3, []).error); assert.equal(g.serialize(), before);
  stop(g); g.command(ids(g), { kind: 'gather', target: 'd3' }); until(g, () => g.s.stock.food >= 25); stop(g);
  // Wood and stone reservations do not consume unrelated recruitment food.
  const people = g.s.units.length, food = g.store('b0').stock.food;
  assert.ok(food >= 25); assert.equal(g.train(), null); assert.equal(g.s.units.length, people + 1); assert.equal(g.store('b0').stock.food, food - 25);
  roundtrip(g);
});

test('current source allocation follows A-return-B and retired B remains a delivered origin including completed-outpost claims', () => {
 for (const kind of ['workshop', 'outpost']) {
  const g = kind === 'outpost' ? extraEarned() : earned(), depot = place(g, 'outpost', 11, 11, ids(g)); finish(g, depot);
  const id = place(g, kind, 13, 3, ['u0']), u = g.s.units[0]; until(g, () => !!u.supply);
  assert.equal(u.supply.origin.storeId, 'b0'); const resource = u.resource;
  g.command(['u0'], { kind: 'move', x: 13, y: 12 }); until(g, () => u.phase === 'idle');
  g.command(['u0'], { kind: 'idle' }); assert.equal(u.dropoff, depot); until(g, () => !u.supply);
  assert.equal(g.store(depot).stock[resource], 5); assert.equal(site(g, id).sources.find(p => p.storeId === depot && p.resource === resource).amount, 5);
  assert.deepEqual(site(g, id).origins, []); assert.ok(g.reclaim(['u1'], depot).error, 'Actual reserved stock blocks source retirement');
  assert.equal(g.command(['u0'], { kind: 'build', target: id }), 1); until(g, () => !!u.supply);
  assert.equal(u.supply.origin.storeId, depot); assert.equal(g.store(depot).stock[resource], 0);
  until(g, () => site(g, id).staged[resource] === 5); stop(g, ['u0']);
  const origin = copy(site(g, id).origins.find(p => p.storeId === depot));
  assert.deepEqual(origin, { storeId: depot, kind: 'outpost', x: 11, y: 11, resource, amount: 5 });
  assert.ok(g.reclaim(['u1', 'u2', 'u3'], depot).id); until(g, () => !building(g, depot), 'old source retirement');
  assert.equal(g.store(depot), null); assert.deepEqual(site(g, id).origins.find(p => p.storeId === depot), origin); roundtrip(g);
  assert.equal(g.command(['u0'], { kind: 'build', target: id }), 1); finish(g, id);
  if (kind === 'outpost') {
    const claim = g.s.reclaim.claims.find(c => c.id === id); assert.equal(claim.basis.rule, 'delivered-construction'); assert.equal(claim.basis.origin, 'physical-delivery');
    assert.deepEqual(claim.origin.find(p => p.storeId === depot), origin); assert.equal(g.store(depot), null);
    for (const r of RES) assert.equal(sum(claim.origin, r), BILL.outpost[r]); assert.deepEqual(claim.unreleased, BILL.outpost);
    const restored = roundtrip(g); assert.deepEqual(restored.s.reclaim.claims.find(c => c.id === id), claim);
  }
  roundtrip(g);
 }
});

test('opening supply can span stores without allowing the same current items into a competing transfer', () => {
  const g = earned(), depot = place(g, 'outpost', 11, 11, ids(g)); finish(g, depot);
  // Move fifteen existing hearth wood to the new store through actual transfer trips.
  assert.equal(g.transfer(['u0', 'u1', 'u2'], 'b0', depot, 'wood').amount, 15); until(g, () => !g.s.storage.transfers.length);
  const id = place(g, 'workshop', 13, 3, []), c = site(g, id);
  assert.equal(c.sources.some(p => p.storeId === 'b0'), true); assert.equal(c.sources.some(p => p.storeId === depot), true);
  const free = g.store(depot).available.wood, reserved = g.store(depot).reserved.wood;
  assert.ok(reserved > 0); const before = g.serialize();
  if (free === 0) { assert.ok(g.transfer(['u3'], depot, 'b0', 'wood').error); assert.equal(g.serialize(), before); }
  else { const transfer = g.transfer(['u3'], depot, 'b0', 'wood'); assert.equal(transfer.amount, Math.min(5, free)); }
  check(g); stop(g); g.command(ids(g), { kind: 'build', target: id }); finish(g, id); roundtrip(g);
});

function extraEarned() {
  const g = earned();
  for (const [target, resource, amount] of [['d4', 'wood', 170], ['d6', 'stone', 110]]) {
    g.command(ids(g), { kind: 'gather', target }); until(g, () => g.s.stock[resource] >= amount); stop(g);
  }
  return g;
}

test('new construction cannot seal the last edge of an active or cancelling physical site', () => {
  for (const cancelling of [false, true]) {
    const g = extraEarned(); g.command(['u0'], { kind: 'move', x: 0, y: 2 }); until(g, () => g.s.units[0].phase === 'idle');
    const north = place(g, 'workshop', 2, 0, ids(g)); finish(g, north);
    g.command(ids(g), { kind: 'move', x: 6, y: 14 }); until(g, () => g.s.units.every(u => u.phase === 'idle'));
    const id = place(g, 'outpost', 0, 0, cancelling ? ['u0'] : []);
    if (cancelling) { until(g, () => site(g, id).staged.wood === 5); stop(g); assert.equal(g.cancel(id), true); }
    g.command(ids(g), { kind: 'move', x: 6, y: 14 }); until(g, () => g.s.units.every(u => u.phase === 'idle'));
    assert.equal(g.placement('workshop', 0, 2), null, 'The last edge proposal is otherwise funded and clear');
    const raw = g.serialize(); assert.ok(g.build('workshop', 0, 2, []).error); assert.equal(g.serialize(), raw); assert.ok(building(g, id)); roundtrip(g);
  }
});

test('construction admission rejects a group containing a trapped hearth-edge worker before any reservation or ID mutation', () => {
  const g = earned(), outside = ['u1', 'u2', 'u3'];
  for (const [target, resource, amount] of [['d4', 'wood', 180], ['d6', 'stone', 110]]) {
    g.command(ids(g), { kind: 'gather', target }); until(g, () => g.s.stock[resource] >= amount); stop(g);
  }
  assert.ok(g.s.stock.wood >= 180); assert.ok(g.s.stock.stone >= 110);
  assert.equal(g.command(['u0'], { kind: 'move', x: 6, y: 11 }), 1); until(g, () => g.s.units[0].phase === 'idle');
  // All three blockers are ordinarily earned, physically supplied and installed by the outside workers.
  for (const [x, y] of [[6, 9], [4, 10], [5, 12]]) {
    g.command(outside, { kind: 'move', x: 14, y: 18 }); until(g, () => g.s.units.filter(u => outside.includes(u.id)).every(u => u.phase === 'idle'));
    const blocker = place(g, 'workshop', x, y, outside); finish(g, blocker);
  }
  g.command(outside, { kind: 'move', x: 14, y: 18 }); until(g, () => g.s.units.filter(u => outside.includes(u.id)).every(u => u.phase === 'idle'));
  const trapped = g.s.units[0], proposed = { kind: 'outpost', x: 11, y: 15 };
  assert.equal(trapped.x, 6); assert.equal(trapped.y, 11); assert.deepEqual(g.path(trapped, g.around(building(g, 'b0'))), []);
  assert.equal(g.path(trapped, g.around(proposed)), null); assert.ok(g.path(g.s.units[1], g.around(proposed)));
  assert.equal(g.placement('outpost', 11, 15), null, 'The mixed group is the only admission failure');
  const raw = g.serialize(); assert.ok(g.build('outpost', 11, 15, ['u0', 'u1']).error); assert.equal(g.serialize(), raw); roundtrip(g);
});

test('externally blocked return holds active and cancelled cargo until reachable storage is restored', () => {
  const g = extraEarned(), north = place(g, 'workshop', 13, 3, ids(g)); finish(g, north);
  const south = place(g, 'workshop', 4, 15, ids(g)); finish(g, south);
  const id = place(g), u = g.s.units[0]; until(g, () => !!u.supply); g.command(['u0'], { kind: 'move', x: 0, y: 0 }); until(g, () => u.phase === 'idle');
  const blockers = [building(g, north), building(g, south)], positions = blockers.map(b => ({ x: b.x, y: b.y })), tag = copy(u.supply);
  // Supplementary topology fault injection moves already-paid structures; no inventory or entitlement is seeded.
  Object.assign(blockers[0], { x: 2, y: 0 }); Object.assign(blockers[1], { x: 0, y: 2 });
  assert.equal(g.command(['u0'], { kind: 'idle' }), 1); assert.equal(u.phase, 'idle'); assert.deepEqual(u.path, []); assert.equal(u.cargo, 5); assert.deepEqual(u.supply, tag);
  tick(g); roundtrip(g); assert.equal(g.cancel(id), true); const stock = copy(g.s.stock);
  for (let i = 0; i < 50; i++) tick(g); assert.ok(building(g, id)); assert.equal(u.cargo, 5); assert.deepEqual(g.s.stock, stock); roundtrip(g);
  blockers.forEach((b, i) => Object.assign(b, positions[i])); assert.equal(g.command(['u0'], { kind: 'idle' }), 1);
  until(g, () => !building(g, id)); assert.equal(u.cargo, 0); assert.equal(u.supply, undefined); roundtrip(g);
});

test('reserved source stock cannot fund a second construction or tool bill while independent food can recruit', () => {
  const g = extraEarned(), workshop = place(g, 'workshop', 4, 9, ids(g)); finish(g, workshop);
  const depot = place(g, 'outpost', 11, 11, ids(g)); finish(g, depot);
  // Empty the hearth wood down to exactly one remaining recipe plus three free wood using real transfers.
  while (g.store('b0').available.wood > 43) {
    const workerCount = Math.min(4, Math.ceil((g.store('b0').available.wood - 43) / 5));
    assert.ok(g.transfer(ids(g).slice(0, workerCount), 'b0', depot, 'wood').id); until(g, () => !g.s.storage.transfers.length);
  }
  // Both stores are in the opening pool; a site near the hearth consumes the nearest recipe first.
  const id = place(g, 'workshop', 4, 15, []), raw = g.serialize();
  assert.equal(g.knappingFunding(workshop).storeId, 'b0');
  assert.ok(g.store('b0').available.wood < 4); assert.ok(g.beginKnapping(workshop, ['u0'])); assert.equal(g.serialize(), raw);
  assert.ok(g.build('outpost', 13, 3, []).error); assert.equal(g.serialize(), raw);
  const reserved = copy(site(g, id).sources); g.command(ids(g), { kind: 'gather', target: 'd3' }); until(g, () => g.store('b0').stock.food >= 25); stop(g);
  const people = g.s.units.length; assert.equal(g.train(), null); assert.equal(g.s.units.length, people + 1); assert.deepEqual(site(g, id).sources, reserved); roundtrip(g);
});

test('reserved, pickup, onsite, work, cancellation and recovery boundaries continue exactly after refresh', () => {
  let g = earned(); const id = place(g, 'workshop', 11, 15, ['u0', 'u1']); let resumed = roundtrip(g), sawPickup = false, sawStaged = false, cancelled = false, sawRecovery = false;
  for (let i = 0; i < 14000 && building(g, id); i++) {
    if (!cancelled && building(g, id).work >= 1) { assert.equal(g.cancel(id), true); assert.equal(resumed.cancel(id), true); cancelled = true; }
    g.tick(.1); resumed.tick(.1); check(g); assert.deepEqual(resumed.s, g.s);
    sawPickup ||= g.s.units.some(u => u.supply?.siteId === id && u.supply.origin !== null);
    sawStaged ||= !!site(g, id)?.staged.wood;
    sawRecovery ||= g.s.units.some(u => u.supply?.siteId === id && u.supply.origin === null);
    resumed = roundtrip(resumed);
  }
  assert.equal(sawPickup, true); assert.equal(sawStaged, true); assert.equal(cancelled, true); assert.equal(sawRecovery, true); assert.equal(building(g, id), undefined);
  const paused = g.serialize(); for (let i = 0; i < 20; i++) assert.equal(new Camp(JSON.parse(paused)).serialize(), paused); check(g);
});

test('malformed current construction ledgers, cargo authority, recipes and future versions reject without normalization', () => {
  const { g, id } = picked(), original = snapshot(g);
  for (const mutate of [
    s => s.version = 7, s => delete s.construction, s => s.construction.profile = 'future', s => s.construction.sites.push(copy(s.construction.sites[0])),
    s => s.construction.sites[0].buildingId = 'missing', s => s.construction.sites[0].state = 'complete',
    s => s.construction.sites[0].sources[0].amount++, s => s.construction.sites[0].sources[0].amount = .5,
    s => s.construction.sites[0].sources[0].storeId = 'missing', s => s.construction.sites[0].sources.push(copy(s.construction.sites[0].sources[0])),
    s => s.construction.sites[0].staged.wood++, s => s.construction.sites[0].released.wood++, s => s.construction.sites[0].returned.wood++,
    s => s.buildings.find(b => b.id === id).cost.wood++, s => s.buildings.find(b => b.id === id).supplyProfile = 'future',
    s => s.buildings.find(b => b.id === id).work = 1, s => s.buildings.find(b => b.id === id).done = true,
    s => delete s.units[0].supply, s => s.units[0].supply.siteId = 'missing', s => s.units[0].supply.origin = null,
    s => s.units[0].supply.origin.amount++, s => s.units[0].supply.origin.resource = 'food', s => s.units[0].cargo = 0,
    s => s.units[0].supplyPickup = { siteId: id, storeId: 'b0', resource: 'wood' }, s => s.units[0].transfer = 't1', s => s.units[0].reclaim = { claimId: id },
    s => s.storage.reservations[id] = { sources: copy(s.construction.sites[0].sources) }
  ]) {
    const bad = copy(original); mutate(bad); const raw = JSON.stringify(bad); assert.equal(valid(bad), false); assert.throws(() => new Camp(bad)); assert.equal(JSON.stringify(bad), raw);
  }
  for (const phase of ['extract', 'construct', 'craft', 'walk', 'pickup', 'transfer', 'reclaimPickup', 'siteRecovery']) {
    const bad = copy(original); bad.units[0].phase = phase; bad.units[0].path = []; assert.equal(valid(bad), false, phase); assert.throws(() => new Camp(bad));
  }
  assert.deepEqual(snapshot(g), original);
});

test('source and planned-pickup identities reject coercible or inherited keys without mutating any intrinsic object', () => {
  const { g } = picked(), carried = snapshot(g), pending = earned(); place(pending); const unpicked = snapshot(pending);
  assert.ok(unpicked.units[0].supplyPickup);
  // Each payload runs in its own Spark-only child so a failing parser cannot pollute other regression tests.
  const { spawnSync } = require('node:child_process');
  const script = `
    'use strict';
    const assert = require('node:assert/strict');
    const { Camp, valid } = require(${JSON.stringify(require.resolve('../src/hearth-rts/engine.js'))});
    const bad = JSON.parse(require('node:fs').readFileSync(0, 'utf8')), raw = JSON.stringify(bad);
    const intrinsics = [Object.prototype, Object, Object.prototype.toString, Object.prototype.valueOf, Function.prototype, Function,
      Array.prototype, Array, String.prototype, String, Number.prototype, Number, Boolean.prototype, Boolean,
      RegExp.prototype, RegExp, Date.prototype, Date, Error.prototype, Error, Map.prototype, Map, Set.prototype, Set, Promise.prototype, Promise];
    const prior = intrinsics.map(value => Object.getOwnPropertyDescriptors(value));
    const untouched = () => intrinsics.forEach((value, i) => assert.deepEqual(Object.getOwnPropertyDescriptors(value), prior[i], 'Intrinsic object ' + i + ' was mutated'));
    let accepted, failure;
    try { accepted = valid(bad); } catch (error) { failure = error; }
    untouched(); assert.equal(failure, undefined, 'Validation must return false for malformed identity'); assert.equal(accepted, false);
    assert.throws(() => new Camp(bad), /compatible RTS Hearth save/); untouched(); assert.equal(JSON.stringify(bad), raw);
  `;
  for (const field of ['source', 'pickup']) for (const identity of [['b0'], 'toString', '__proto__', 'constructor', null, 0, 17]) {
    const bad = copy(field === 'source' ? carried : unpicked);
    if (field === 'source') bad.construction.sites[0].sources[0].storeId = identity;
    else bad.units[0].supplyPickup.storeId = identity;
    const result = spawnSync(process.execPath, ['-e', script], { input: JSON.stringify(bad), encoding: 'utf8', timeout: 10000 });
    assert.equal(result.error, undefined); assert.equal(result.signal, null);
    assert.equal(result.status, 0, `${field} identity ${JSON.stringify(identity)}: ${result.stderr || result.stdout}`);
  }
});

let old;
function oldAPI() {
  if (!old) {
    // Executed only in the authorized Spark runner. Pin both commit and source bytes.
    const { readFileSync } = require('node:fs'), { createHash } = require('node:crypto'), vm = require('node:vm');
    const source = readFileSync(require('node:path').join(__dirname, 'fixtures/hearth-v5-4c3ac2f-engine.txt'), 'utf8');
    assert.equal(createHash('sha256').update(source).digest('hex'), '416b35153c781eb56a045848afaa6bb92daa0c93447b18a4e51f2d9a580f58d5');
    const context = { module: { exports: {} }, structuredClone }; vm.runInNewContext(source, context, { filename: 'pinned-hearth-4c3ac2f6-v5.js' }); old = context.module.exports;
  }
  return old;
}
function oldPaid(kind) {
  const g = new (oldAPI().Camp)();
  const advance = predicate => { for (let i = 0; i < 12000 && !predicate(); i++) g.tick(.1); assert.ok(predicate()); };
  for (const target of ['d0', 'd1', 'd2']) { g.command(ids(g), { kind: 'gather', target }); advance(() => g.s.units.every(u => u.phase === 'idle')); }
  const stock = copy(g.s.stock), result = g.build(kind, 11, 15, ['u0']); assert.ok(result.id); advance(() => building(g, result.id).work >= 2);
  assert.equal(g.s.version, 5); assert.ok(oldAPI().valid(g.s)); assert.equal(g.s.construction, undefined);
  return { g, id: result.id, stock };
}

test('pinned-v5 engine-earned unfinished paid sites adopt v6 with every old field exact and no second bill or delivery trip', () => {
  for (const kind of ['outpost', 'workshop']) {
    const { g: legacy, id, stock } = oldPaid(kind), raw = legacy.serialize(), state = JSON.parse(raw), migrated = new Camp(state);
    assert.equal(JSON.stringify(state), raw); assert.equal(legacy.serialize(), raw);
    const { construction, ...oldFields } = snapshot(migrated);
    assert.deepEqual(oldFields, { ...state, version: 6 }); assert.deepEqual(construction, { profile: PROFILE, sites: [] });
    assert.equal(building(migrated, id).supplyProfile, undefined); assert.equal(migrated.s.units[0].phase, 'construct');
    const completed = new Camp(state), paid = copy(completed.s.spent), afterPayment = copy(completed.s.stock);
    finish(completed, id); assert.deepEqual(completed.s.spent, paid); assert.deepEqual(completed.s.stock, afterPayment);
    assert.equal(completed.s.units.some(u => u.supply || u.supplyPickup), false); roundtrip(completed);
    assert.equal(migrated.cancel(id), true); assert.deepEqual(migrated.s.stock, stock); assert.deepEqual(migrated.s.spent, zero());
    assert.equal(migrated.cancel(id), false); roundtrip(migrated);
  }
});

test('declared pre-v6 unknown construction fields never become current authority and uncertifiable v4 stays playable', () => {
  const { g: legacy, id } = oldPaid('outpost'), original = snapshot(legacy), contaminated = copy(original);
  contaminated.construction = { profile: PROFILE, sites: [{ buildingId: id, staged: { wood: 999999 } }] };
  contaminated.buildings.find(b => b.id === id).supplyProfile = PROFILE;
  contaminated.units[0].supply = { siteId: id, origin: null }; contaminated.units[0].supplyPickup = { siteId: id, storeId: 'forged', resource: 'wood' };
  const raw = JSON.stringify(contaminated), clean = new Camp(original), adopted = new Camp(contaminated);
  assert.deepEqual(adopted.s, clean.s); assert.equal(JSON.stringify(contaminated), raw); roundtrip(adopted);
  for (const version of [1, 2, 3, 4]) {
    const declared = copy(contaminated); declared.version = version; delete declared.reclaim;
    if (version < 3) delete declared.storage;
    if (version === 1) { delete declared.tools; delete declared.knapping; }
    const input = JSON.stringify(declared), migrated = new Camp(declared); assert.equal(JSON.stringify(declared), input);
    assert.equal(migrated.s.version, 6); assert.deepEqual(migrated.s.construction, { profile: PROFILE, sites: [] });
    assert.equal(building(migrated, id).supplyProfile, undefined); assert.equal(migrated.s.units[0].supply, undefined); assert.equal(migrated.s.units[0].supplyPickup, undefined);
    assert.equal(migrated.cancel(id), true); check(migrated);
  }
  const unusual = copy(original); unusual.version = 4; delete unusual.reclaim; unusual.deposits[0].x++;
  const raw4 = JSON.stringify(unusual), retained = new Camp(unusual); assert.equal(retained.s.version, 4); assert.ok(retained.reclaimIssue);
  assert.equal(retained.s.construction, undefined); assert.equal(JSON.stringify(unusual), raw4); assert.deepEqual(new Camp(snapshot(retained)).s, retained.s);
});
