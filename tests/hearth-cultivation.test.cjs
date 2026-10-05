'use strict';
// Independent arithmetic/custody witnesses. Author on M6; execute only on Spark.
const test = require('node:test');
const assert = require('node:assert/strict');
const Legacy = require('../src/hearth-rts/engine.js');
const {Camp, adopt, quoteAdoption, valid, KEY, profiles} = require('../src/hearth-cultivation/engine.js');
const copy = value => JSON.parse(JSON.stringify(value));
const whole = ['wood', 'stone', 'food', 'water', 'seed'];
const finite = {wood: 416, stone: 220, food: 225};
const ids = g => g.s.units.map(u => u.id);
const actor = (g, id = 'u0') => g.s.units.find(u => u.id === id);
const plot = (g, id = 'pilot') => g.s.cultivation.plots.find(p => p.id === id);
const job = (g, id = 'pilot') => plot(g, id).job;
const summaryPlot = (g, id = 'pilot') => g.inspectPlot(id);
const integer = value => { assert.match(value, /^(0|[1-9]\d*)$/); return BigInt(value); };
const amount = (v, r) => v?.[r] || 0;
const accepted = result => { assert.equal(result.ok, true, result.reason); return result; };

// Do not call economy()/summary()/valid() to calculate expected matter. Reservations
// remain inside stores; seedLot replaces staged seed, and support remainder is a
// liability between pantry and consumed, not a third additional holding.
function custody(g) {
  const s = g.s, c = s.cultivation;
  assert.equal(s.version, 7); assert.equal(valid(s), true);
  for (const r of whole) {
    assert.equal(s.stock[r], Object.values(s.storage.stores).reduce((n, v) => n + amount(v, r), 0), 'Store aggregate: ' + r);
    assert.ok(s.units.every(u => Number.isInteger(u.cargo) && u.cargo >= 0 && u.cargo <= 5));
  }
  const held = r => s.units.filter(u => u.resource === r).reduce((n, u) => n + u.cargo, 0);
  const staged = r => c.plots.reduce((n, p) => n + amount(p.job?.staged, r), 0);
  const trays = r => c.plots.reduce((n, p) => n + amount(p.job?.output, r), 0);
  const construction = r => s.construction.sites.reduce((n, site) => n + amount(site.staged, r), 0);
  for (const r of Object.keys(finite)) {
    const ordinary = s.stock[r] + s.spent[r] + held(r) + construction(r) + staged(r) + trays(r)
      + s.deposits.filter(d => d.kind === r).reduce((n, d) => n + d.amount, 0);
    const a = c.pantry[r], pantry = a ? integer(a.milli) + integer(a.consumedMilli) : 0n;
    assert.equal(BigInt(ordinary) * 1000n + pantry, BigInt(finite[r] + amount(c.generated, r)) * 1000n, 'Finite + typed production: ' + r);
  }
  const seed = c.seedCache + s.stock.seed + held('seed') + staged('seed') + trays('seed')
    + c.plots.reduce((n, p) => n + (p.job?.seedLot || 0), 0);
  assert.equal(seed, 6, 'Same six physical seed, no crop seed creation');
  const water = BigInt(s.stock.water + held('water') + staged('water') + trays('water') + c.recipeWaterConsumed) * 1000n
    + integer(c.water.poolMilli) + integer(c.pantry.water.milli) + integer(c.pantry.water.consumedMilli);
  assert.equal(water, 30000n + integer(c.water.inflowMilli), 'Water pool + accepted inflow equals all custody/consumption');
  assert.ok(integer(c.water.poolMilli) <= 30000n);
  if (c.nextFunded) {
    const reservedWater = s.storage.transfers.filter(j => j.from === 'b0' && j.resource === 'water').reduce((n, j) => n + j.remaining, 0)
      + s.construction.sites.reduce((n, j) => n + j.sources.filter(v => v.storeId === 'b0' && v.resource === 'water').reduce((a, v) => a + v.amount, 0), 0)
      + c.plots.reduce((n, p) => n + (p.job?.sources || []).filter(v => v.storeId === 'b0' && v.resource === 'water').reduce((a, v) => a + v.amount, 0), 0);
    assert.ok(s.storage.stores.b0.water - reservedWater >= 3, 'Funded NEXT retains three real unreserved recipe water through pantry top-ups');
  }
  const demand = integer(c.demandSlots), active = integer(c.campSlots);
  assert.ok(active <= demand && demand <= active * BigInt(s.units.length));
  for (const r of ['food', 'water', 'wood']) {
    const a = c.pantry[r], charged = r === 'wood' ? active * 5n : demand;
    assert.ok(integer(a.remainder) < 3n);
    assert.equal(integer(a.consumedMilli) * 3n + integer(a.remainder), charged, 'Exact third-milli support: ' + r);
    assert.equal(integer(a.milli) + integer(a.consumedMilli), (integer(a.fundedWhole) - integer(a.returnedWhole)) * 1000n, 'Pantry transfer is custody: ' + r);
  }
  return copy(c);
}
function tick(g, observe) {
  const before = observe ? copy(g.s) : null;
  g.tick(.1); custody(g); if (observe) observe(before, g.s);
}
function until(g, predicate, label, observe, bound = 16000) {
  for (let n = 0; n < bound && !predicate(); n++) tick(g, observe);
  assert.ok(predicate(), 'Bounded real-engine scenario: ' + label);
}
function legacyUntil(g, predicate, label, bound = 18000) {
  for (let n = 0; n < bound && !predicate(); n++) g.tick(.1);
  assert.ok(predicate(), label); assert.equal(Legacy.valid(g.s), true);
}
function quiet(g) { return g.s.units.every(u => u.phase === 'idle' && !u.cargo && !u.path.length); }
function stop(g, selected = ids(g)) {
  g.command(selected, {kind: 'idle'});
  until(g, () => selected.every(id => actor(g, id).phase === 'idle' && !actor(g, id).cargo), 'physical Stop/Return');
}
const bases = new Map();
function legacyEarned({roster = 4, tools = false} = {}) {
  const key = roster + ':' + tools;
  if (!bases.has(key)) {
    const g = new Legacy.Camp();
    for (const target of ['d0', 'd1', 'd2', 'd3']) {
      g.command(ids(g), {kind: 'gather', target}); legacyUntil(g, () => quiet(g), 'earn finite western ' + target);
    }
    g.command(ids(g), {kind: 'move', x: 25, y: 14}); legacyUntil(g, () => quiet(g), 'scout east');
    g.command(ids(g), {kind: 'gather', target: 'd7'}); legacyUntil(g, () => quiet(g), 'earn finite eastern food');
    g.command(ids(g), {kind: 'move', x: 15, y: 14}); legacyUntil(g, () => quiet(g), 'clear recruitment perimeter');
    while (g.s.units.length < roster) assert.equal(g.train(), null);
    for (const [kind, x, y] of [['workshop', 11, 15], ['outpost', 22, 11]]) {
      const result = g.build(kind, x, y, ids(g)); assert.ok(result.id, result.error);
      legacyUntil(g, () => g.s.buildings.find(b => b.id === result.id).done && quiet(g), 'earn ' + kind);
    }
    assert.equal(g.s.complete, true);
    if (tools) {
      const workshop = g.s.buildings.find(b => b.kind === 'workshop').id;
      assert.equal(g.beginKnapping(workshop, ['u0']), null);
      legacyUntil(g, () => tools === 'partial' ? g.s.knapping.work >= 1 : g.s.tools, 'actual tool work');
      g.command(ids(g), {kind: 'idle'}); legacyUntil(g, () => quiet(g), 'stop tool work');
    }
    bases.set(key, g.serialize());
  }
  return new Legacy.Camp(JSON.parse(bases.get(key)));
}
function adopted(options) { const old = legacyEarned(options), raw = old.serialize(); return {g: adopt(raw), old, raw}; }
function preserveShape(before, after, path = '') {
  if (Array.isArray(before)) { assert.equal(after.length, before.length, path); before.forEach((v, i) => preserveShape(v, after[i], path + '[' + i + ']')); }
  else if (before && typeof before === 'object') for (const [k, v] of Object.entries(before)) preserveShape(v, after[k], path + '.' + k);
  else assert.deepEqual(after, path === '.version' ? 7 : before, path);
}
function reload(g) { const raw = g.serialize(), restored = new Camp(JSON.parse(raw)); assert.equal(restored.serialize(), raw); custody(restored); return restored; }
function gatherNew(g, target, selected = ['u0']) {
  accepted(g.collect(target, selected));
  if (target === 'seed') until(g, () => g.s.cultivation.seedCache === 0 && quiet(g), 'physically collect finite seed');
  else until(g, () => g.s.stock.water >= 25, 'physically collect water');
  stop(g, selected);
  if (target === 'water') {
    const outpost = g.s.buildings.find(b => b.kind === 'outpost' && b.done).id;
    for (let n = 0; g.store('b0').stock.water < 20 && n < 8; n++) {
      const moved = g.transfer(ids(g), outpost, 'b0', 'water'); assert.ok(moved.id, moved.error);
      until(g, () => !g.s.storage.transfers.length, 'physically bring intake water from actual receiver to b0');
    }
    assert.ok(g.store('b0').stock.water >= 20);
  }
}
function provisioned(options) {
  const result = adopted(options), g = result.g;
  accepted(g.discoverPlot('pilot')); gatherNew(g, 'seed'); gatherNew(g, 'water');
  accepted(g.provision()); custody(g); return result;
}
function output(g, id = 'pilot', selected = ['u0']) {
  accepted(g.plant(id, selected));
  until(g, () => summaryPlot(g, id).phase === 'growing', 'paid ' + id + ' planting');
  assert.ok(selected.every(id => actor(g, id).phase === 'idle'), 'Planters released during growth');
  until(g, () => ['harvest', 'output'].includes(summaryPlot(g, id).phase), 'foreground ' + id + ' growth');
  if (id === 'woodland') { accepted(g.resume(id, selected)); until(g, () => summaryPlot(g, id).phase === 'output', 'woodland paid harvest'); }
  custody(g);
}
function receipt(g, id = 'pilot', selected = ['u0']) {
  accepted(g.collect(id, selected));
  until(g, () => summaryPlot(g, id).phase === 'empty' && selected.every(id => !actor(g, id).cargo && actor(g, id).phase === 'idle'), 'whole ' + id + ' tray physically delivered');
}
function exportEligible(g, resource = 'wood', selected = ['u2']) {
  const outpost = g.s.buildings.find(b => b.kind === 'outpost' && b.done).id;
  let count = 0;
  for (; count < 80; count++) {
    const q = g.quoteTransfer(selected, 'b0', outpost, resource);
    if (q.error || !q.amount) break;
    const result = g.transfer(selected, 'b0', outpost, resource); assert.ok(result.id, result.error);
    until(g, () => !g.s.storage.transfers.length, 'physically move eligible ' + resource + ' away');
  }
  assert.ok(count < 80, 'Bounded ordinary local surplus transfer'); return outpost;
}

test('only the frozen tuple adopts; exact inherited values and source bytes survive four-to-eight real earned residents', () => {
  assert.equal(KEY, 'singularity-clicker.hearth-cultivation.v1');
  assert.deepEqual(profiles, {schema: 7, engine: 'local-cultivation.v1', content: 'local-cultivation-map.v1', numeric: 'whole-pantry-slot100.v1'});
  for (const roster of [4, 5, 6, 7, 8]) {
    const old = legacyEarned({roster, tools: roster === 4 ? 'partial' : false}), source = ' \n' + old.serialize() + '\n';
    assert.equal(quoteAdoption(source).ok, true); const g = adopt(source);
    preserveShape(old.s, g.s); assert.equal(old.serialize(), JSON.stringify(JSON.parse(source)));
    assert.deepEqual(g.summary().floors, {food: roster, water: roster, wood: 4});
    assert.equal(g.s.stock.seed, 0); assert.equal(g.s.stock.water, 0); assert.equal(g.s.cultivation.seedCache, 6);
    assert.equal(g.s.cultivation.water.poolMilli, '30000'); assert.equal(g.s.cultivation.active, false); custody(g); reload(g);
  }
});

test('pure previews do not discover or grant materials; discovery is idempotent information and seed collection is physical', () => {
  const {g} = adopted(), raw = g.serialize();
  for (let i = 0; i < 8; i++) { g.summary(); g.inspectPlot('pilot'); g.provisionQuote(); g.quotePlant('pilot', ['u0']); }
  assert.equal(g.serialize(), raw); assert.equal(g.s.cultivation.seedDiscovered, false);
  assert.equal(g.collect('seed', ['u0']).ok, false); assert.equal(g.serialize(), raw);
  accepted(g.discoverPlot('pilot')); const discovered = g.serialize(); accepted(g.discoverPlot('pilot')); assert.equal(g.serialize(), discovered);
  assert.equal(g.s.stock.seed, 0); assert.equal(g.s.cultivation.seedCache, 6);
  accepted(g.collect('seed', ['u0'])); const start = g.serialize(); assert.equal(g.s.stock.seed, 0);
  accepted(g.collect('seed', ['u0'])); assert.equal(g.serialize(), start);
  until(g, () => actor(g).cargo > 0, 'actual finite seed pickup'); assert.equal(actor(g).resource, 'seed'); assert.equal(g.s.stock.seed, 0);
  assert.equal(g.s.cultivation.seedCache + actor(g).cargo, 6);
  until(g, () => g.s.cultivation.seedCache === 0 && quiet(g), 'all six seed arrive'); assert.equal(g.s.stock.seed, 6); custody(g);
});

test('water regenerates only accepted 10 milli per advancing tick and saturation never banks a future burst', () => {
  const {g} = adopted(); for (let n = 0; n < 100; n++) tick(g);
  assert.equal(g.s.cultivation.water.poolMilli, '30000'); assert.equal(g.s.cultivation.water.inflowMilli, '0');
  accepted(g.collect('water', ['u0'])); until(g, () => actor(g).cargo > 0, 'one physical water pickup');
  stop(g); const before = copy(g.s.cultivation.water); assert.ok(integer(before.poolMilli) < 30000n);
  const beforeTick = g.s.cultivation.tick; tick(g);
  const after = g.s.cultivation.water, expected = 30000n - integer(before.poolMilli) < 10n ? 30000n - integer(before.poolMilli) : 10n;
  assert.equal(integer(after.poolMilli) - integer(before.poolMilli), expected);
  assert.equal(integer(after.inflowMilli) - integer(before.inflowMilli), expected); assert.equal(g.s.cultivation.tick, beforeTick + 1);
  const restored = reload(g); for (let n = 0; n < 50; n++) { tick(g); tick(restored); } assert.equal(restored.serialize(), g.serialize());
});

test('every partial new source load of one through four items is valid and resumes byte-identically after reload', () => {
  for (const source of ['seed', 'water']) {
    const {g} = adopted(); accepted(g.discoverPlot('pilot')); accepted(g.collect(source, ['u0']));
    for (let amount = 1; amount <= 4; amount++) {
      until(g, () => actor(g).resource === source && actor(g).cargo === amount, 'partial ' + source + ' ' + amount);
      assert.ok(actor(g).cultivationCargo); const twin = reload(g), raw = g.serialize();
      accepted(g.collect(source, ['u0'])); assert.equal(g.serialize(), raw, 'Repeated source order retains partial extraction');
      tick(g); tick(twin); assert.equal(twin.serialize(), g.serialize());
    }
  }
});

test('support consent and repeat activation do not debit; idle, travel, bare new collection and growth are free of support demand', () => {
  const {g} = provisioned({tools: true}); const original = custody(g);
  const raw = g.serialize(); accepted(g.provision()); assert.equal(g.serialize(), raw);
  for (let n = 0; n < 15; n++) tick(g);
  g.command(['u0'], {kind: 'move', x: 6, y: 16}); until(g, () => actor(g).phase === 'idle', 'ordinary walking');
  assert.equal(g.s.cultivation.demandSlots, original.demandSlots); assert.equal(g.s.cultivation.campSlots, original.campSlots);
  accepted(g.collect('water', ['u0'])); until(g, () => actor(g).cargo === 5, 'bare water extraction'); stop(g, ['u0']);
  assert.equal(g.s.cultivation.demandSlots, original.demandSlots);
  accepted(g.plant('pilot', ['u0'])); until(g, () => summaryPlot(g).phase === 'growing', 'planting completion');
  const planted = copy(g.s.cultivation); for (let n = 0; n < 50; n++) tick(g);
  assert.equal(g.s.cultivation.demandSlots, planted.demandSlots); assert.equal(g.s.cultivation.campSlots, planted.campSlots);
  assert.equal(job(g).growthTicks - planted.plots.find(p => p.id === 'pilot').job.growthTicks, 50);
});

test('one-worker crop charges exactly 900 labor slots and 900 camp slots with persisted thirds at every reload boundary', () => {
  const {g} = provisioned(); accepted(g.plant('pilot', ['u0']));
  const before = copy(g.s.cultivation);
  until(g, () => summaryPlot(g).phase === 'planting' && job(g).workSlots > 0, 'first paid work');
  assert.equal(job(g).workSlots, 1);
  assert.equal(g.s.cultivation.pantry.food.consumedMilli, '0'); assert.equal(g.s.cultivation.pantry.food.remainder, '1');
  assert.equal(g.s.cultivation.pantry.wood.consumedMilli, '1'); assert.equal(g.s.cultivation.pantry.wood.remainder, '2');
  const partial = g.serialize(); assert.equal(g.returnPantry('food', 1).ok, false);
  assert.equal(g.serialize(), partial, 'A displayed 1000 milli with 1/3 liability cannot refund one whole food');
  let restored = reload(g);
  for (let n = 0; n < 11; n++) { tick(g); tick(restored); assert.equal(restored.serialize(), g.serialize()); restored = reload(restored); }
  until(g, () => summaryPlot(g).phase === 'growing', 'all 900 worker slots');
  assert.equal(integer(g.s.cultivation.demandSlots) - integer(before.demandSlots), 900n);
  assert.equal(integer(g.s.cultivation.campSlots) - integer(before.campSlots), 900n);
  assert.equal(g.s.cultivation.recipeWaterConsumed - before.recipeWaterConsumed, 3);
  assert.equal(job(g).seedLot, 2); assert.deepEqual(job(g).staged, {seed: 0, water: 0});
  assert.equal(g.s.cultivation.generated.food, 0); assert.equal(g.s.cultivation.woodlandUnlocked, false);
  assert.equal(g.s.cultivation.pantry.food.consumedMilli, '300'); assert.equal(g.s.cultivation.pantry.wood.consumedMilli, '1500'); custody(g);
});

test('helpers reduce union fuel and cannot receive labor after the shared planting job completes', () => {
  const {g} = provisioned(), before = copy(g.s.cultivation); accepted(g.plant('pilot', ids(g).reverse()));
  until(g, () => summaryPlot(g).phase === 'growing', 'shared work reaches exactly target', (a, b) => {
    const ca = a.cultivation, cb = b.cultivation, slots = integer(cb.demandSlots) - integer(ca.demandSlots), fuel = integer(cb.campSlots) - integer(ca.campSlots);
    assert.ok(slots >= 0n && slots <= 4n); assert.equal(fuel, slots ? 1n : 0n);
  });
  assert.equal(integer(g.s.cultivation.demandSlots) - integer(before.demandSlots), 900n);
  assert.ok(integer(g.s.cultivation.campSlots) - integer(before.campSlots) < 900n);
  const atCompletion = custody(g); tick(g); assert.equal(g.s.cultivation.demandSlots, atCompletion.demandSlots);
});

test('actor selection order cannot change exact slots, charged fuel or a shared-job finishing tick', () => {
  const {g} = provisioned(), twin = reload(g);
  accepted(g.plant('pilot', ['u3', 'u1', 'u0'])); accepted(twin.plant('pilot', ['u0', 'u1', 'u3']));
  assert.equal(twin.serialize(), g.serialize());
  for (let n = 0; n < 6000 && summaryPlot(g).phase !== 'growing'; n++) {
    tick(g); tick(twin); assert.equal(twin.serialize(), g.serialize());
  }
  assert.equal(summaryPlot(g).phase, 'growing'); assert.equal(g.s.cultivation.demandSlots, '900');
});

test('current and NEXT water/support are disjoint and every successful quote is read-only', () => {
  const {g} = provisioned(), raw = g.serialize(), q = g.quotePlant('pilot', ['u0']);
  assert.equal(q.ok, true, q.reason); assert.deepEqual(q.recipe, {seed: 2, water: 3});
  assert.equal(q.workSlots, 900); assert.equal(q.growthTicks, 900);
  assert.equal(q.support.foodThirdMilli, '900'); assert.equal(q.support.waterThirdMilli, '900'); assert.equal(q.support.woodThirdMilli, '4500');
  assert.equal(g.serialize(), raw); const next = g.summary().protected;
  assert.equal(integer(next.waterThirdMilli), 900n, 'NEXT support water is .3 whole water');
  assert.ok(g.store('b0').stock.water >= 3, 'NEXT recipe retains three physical whole water separately');
  accepted(g.plant('pilot', ['u0'])); assert.equal(g.s.cultivation.nextFunded, true);
  assert.equal(integer(g.summary().protected.waterThirdMilli), 1800n, 'Current and NEXT each reserve .3 support water');
  assert.equal(job(g).sources.filter(v => v.resource === 'water').reduce((n, v) => n + v.amount, 0), 3);
  assert.ok(g.store('b0').stock.water - job(g).sources.filter(v => v.storeId === 'b0' && v.resource === 'water').reduce((n, v) => n + v.amount, 0) >= 3, 'The same three stored recipe water cannot serve current and NEXT'); custody(g);
});

test('paid work survives Stop, reassignment, duplicate actions and reload without charging ingredients twice', () => {
  let {g} = provisioned(); const started = accepted(g.plant('pilot', ['u0']));
  until(g, () => summaryPlot(g).phase === 'planting' && job(g).workSlots >= 17, 'partial paid crop');
  stop(g, ['u0']); const raw = g.serialize(), work = job(g).workSlots, consumed = g.s.cultivation.recipeWaterConsumed;
  assert.equal(g.cancelPlot('pilot').ok, false); assert.equal(g.serialize(), raw, 'Started crop is retained, not refunded');
  g = reload(g); accepted(g.resume('pilot', ['u1'])); assert.equal(job(g).id, started.jobId);
  const after = g.serialize(); accepted(g.resume('pilot', ['u1'])); assert.equal(g.serialize(), after);
  assert.equal(job(g).workSlots, work); assert.equal(g.s.cultivation.recipeWaterConsumed, consumed);
  until(g, () => summaryPlot(g).phase === 'output', 'resume and grow once');
  assert.deepEqual(job(g).output, {seed: 2, food: 6, wood: 0}); assert.equal(g.s.cultivation.generated.food, 6);
  assert.equal(g.s.cultivation.recipeWaterConsumed, 3); assert.equal(plot(g).batchesStarted, 1); assert.equal(plot(g).batchesFinished, 1);
  for (let n = 0; n < 20; n++) tick(g); assert.equal(g.s.cultivation.generated.food, 6); custody(g);
});

test('unstarted cancellation releases once without duplicating store, carried or staged inputs', () => {
  for (const checkpoint of ['carried', 'staged']) {
  const {g} = provisioned(); const initial = custody(g); accepted(g.plant('pilot', ['u0']));
  until(g, () => checkpoint === 'carried' ? actor(g).cargo > 0 : job(g).staged.seed > 0, 'ingredient physically ' + checkpoint);
  assert.equal(summaryPlot(g).phase, 'supplying'); const held = actor(g).cargo;
  accepted(g.cancelPlot('pilot')); assert.equal(actor(g).cargo, held, 'Cancel cannot teleport the ingredient');
  const raw = g.serialize(); const repeated = g.cancelPlot('pilot'); assert.equal(g.serialize(), raw, 'Repeated cancellation cannot refund twice');
  assert.equal(typeof repeated.ok, 'boolean');
  if (checkpoint === 'staged') {
    stop(g); assert.equal(summaryPlot(g).phase, 'cancelling');
    assert.ok(job(g).staged.seed > 0, 'Stopped workers leave actual supplies at the plot');
    accepted(g.resume('pilot', ['u1']));
    until(g, () => actor(g, 'u1').cargo > 0, 'replacement worker physically recovers staged input');
    assert.equal(actor(g, 'u1').cultivationCargo.kind, 'recovery');
    const twin = reload(g);
    until(g, () => summaryPlot(g).phase === 'empty' && quiet(g), 'reassigned recovery settles after mid-return reload', () => {
      tick(twin); assert.equal(twin.serialize(), g.serialize());
    });
  } else until(g, () => summaryPlot(g).phase === 'empty' && quiet(g), 'physical cancellation recovery');
  assert.equal(g.s.stock.seed, 6); assert.equal(g.s.cultivation.recipeWaterConsumed, 0);
  assert.deepEqual(g.s.cultivation.generated, initial.generated); custody(g); reload(g);
  }
});

test('seed-first single-resource hauling survives loaded Move/Stop and unlocks woodland only at actual food receipt', () => {
  const {g} = provisioned(); output(g); assert.equal(g.s.cultivation.woodlandUnlocked, false);
  const before = copy(g.s.stock); accepted(g.collect('pilot', ['u0']));
  until(g, () => actor(g).cargo > 0, 'first output pickup'); assert.equal(actor(g).resource, 'seed'); assert.equal(actor(g).cargo, 2);
  assert.deepEqual(g.s.stock, before); assert.equal(g.s.cultivation.woodlandUnlocked, false);
  const tag = copy(actor(g).cultivationCargo); assert.ok(tag); g.command(['u0'], {kind: 'move', x: 6, y: 16});
  until(g, () => actor(g).phase === 'idle', 'explicit Move holds seed'); assert.equal(actor(g).cargo, 2); assert.deepEqual(actor(g).cultivationCargo, tag);
  const restored = reload(g); stop(g, ['u0']); stop(restored, ['u0']); assert.equal(restored.serialize(), g.serialize());
  assert.equal(g.s.cultivation.woodlandUnlocked, false); assert.equal(g.s.cultivation.receipts.pilotFood, 0);
  accepted(g.collect('pilot', ['u0']));
  until(g, () => actor(g).resource === 'food' && actor(g).cargo > 0, 'food held at plot'); assert.equal(g.s.cultivation.woodlandUnlocked, false);
  until(g, () => g.s.cultivation.receipts.pilotFood > 0, 'first actual crop food receipt'); assert.equal(g.s.cultivation.woodlandUnlocked, true);
  until(g, () => summaryPlot(g).phase === 'empty' && quiet(g), 'remaining single-type load delivered');
  assert.equal(g.s.cultivation.receipts.pilotFood, 6); assert.equal(g.s.stock.seed, 6); custody(g);
});

test('two paid crops and one woodland batch conserve seed and recipe output with no Hearth/Agriculture promotion', () => {
  const {g} = provisioned();
  for (const id of ['pilot', 'woodland', 'pilot']) { output(g, id, ['u0', 'u1']); receipt(g, id, ['u0', 'u1']); }
  assert.deepEqual(g.s.cultivation.generated, {food: 12, wood: 8}); assert.deepEqual(g.s.cultivation.receipts, {pilotFood: 12, woodlandWood: 8});
  assert.equal(g.s.cultivation.recipeWaterConsumed, 10); assert.equal(g.s.stock.seed, 6);
  assert.equal(g.s.cultivation.nextFunded, true); assert.equal(g.quotePlant('pilot', ['u0']).ok, true);
  assert.equal(g.summary().stageComplete, false); assert.equal(g.summary().agricultureAvailable, false); assert.equal(g.s.complete, true); custody(g); reload(g);
});

test('unsupported tuples, impossible custody and noncanonical decimals are rejected without repairing input', () => {
  const {g} = provisioned();
  for (const corrupt of [s => s.version = 8, s => s.engineProfile += '.future', s => s.contentProfile += '.future',
    s => s.numericProfile += '.future', s => s.stock.seed++, s => s.cultivation.seedCache++,
    s => s.cultivation.water.poolMilli = '30001', s => s.cultivation.pantry.food.milli = '01',
    s => s.cultivation.pantry.food.remainder = '3', s => s.cultivation.demandSlots = '-1',
    s => s.cultivation.generated.food++]) {
    const bad = copy(g.s); corrupt(bad); const raw = JSON.stringify(bad); assert.equal(valid(bad), false); assert.throws(() => new Camp(bad)); assert.equal(JSON.stringify(bad), raw);
  }
  for (const value of [null, false, 0, '', [], {}, {version: 7}]) assert.equal(valid(value), false);
  accepted(g.plant('pilot', ['u0']));
  const dormant = copy(g.s); dormant.cultivation.active = false; dormant.cultivation.nextFunded = false;
  const dormantRaw = JSON.stringify(dormant); assert.equal(valid(dormant), false, 'An inactive flag cannot strip support from an already reserved job');
  assert.throws(() => new Camp(dormant)); assert.equal(JSON.stringify(dormant), dormantRaw);
  const remoteId = g.s.buildings.find(b => b.kind === 'outpost').id;
  for (const r of ['food', 'water', 'wood']) {
    const remote = copy(g.s), retained = r === 'water' ? 3 : 0, moved = remote.storage.stores.b0[r] - retained;
    remote.storage.stores.b0[r] = retained; remote.storage.stores[remoteId][r] += moved;
    assert.equal(Object.values(remote.storage.stores).reduce((n, store) => n + store[r], 0), remote.stock[r], 'Controlled negative preserves global matter');
    assert.equal(valid(remote), false, 'Remote stock cannot replace local floor and NEXT obligations: ' + r); assert.throws(() => new Camp(remote));
  }
});

test('new commands reject invalid actors/targets and unsupported recruitment atomically', () => {
  const {g} = provisioned(), raw = g.serialize();
  for (const action of [() => g.plant('missing', ['u0']), () => g.plant('pilot', ['u0', 'missing']),
    () => g.collect('missing', ['u0']), () => g.collect('water', ['missing']), () => g.resume('pilot', ['u0']),
    () => g.returnPantry('stone', 1), () => g.returnPantry('food', -1)]) {
    assert.equal(action().ok, false); assert.equal(g.serialize(), raw);
  }
  assert.match(g.train(), /invitation|preview|recruit|shelter/i); assert.equal(g.serialize(), raw);
  assert.equal(g.reclaimQuote(ids(g), 'b0').ok === true, false); assert.equal(g.serialize(), raw);
});

test('local support reaches bare recovery without a free fractional slot; physical resupply resumes tools without resetting cargo or work', () => {
  const {g} = provisioned({tools: true}), outpost = exportEligible(g);
  assert.ok(g.store(outpost).stock.wood > 0, 'Remote wealth exists while b0 is constrained');
  g.command(['u0'], {kind: 'gather', target: 'd4'});
  until(g, () => actor(g).phase === 'extract' && !actor(g).path.length && /Recovery pace/.test(actor(g).reason), 'local funded margin exhausted');
  assert.equal(g.s.tools, true); assert.deepEqual(actor(g).order, {kind: 'gather', target: 'd4'});
  const before = copy(actor(g)), slots = g.s.cultivation.demandSlots, oldSource = g.s.deposits.find(d => d.id === 'd4').amount;
  const restored = reload(g); tick(g); tick(restored); assert.equal(restored.serialize(), g.serialize());
  assert.equal(g.s.cultivation.demandSlots, slots, 'A zero-posted-debit quantum is still rejected when unfunded');
  const extracted = before.work + .1 + .00001 >= .6;
  assert.equal(g.s.deposits.find(d => d.id === 'd4').amount, oldSource - Number(extracted));
  assert.equal(actor(g).cargo, before.cargo + Number(extracted));
  assert.ok(Math.abs(actor(g).work - (extracted ? Math.max(0, before.work + .1 - .6) : before.work + .1)) < 1e-9, 'Bare .60 preserves actual accumulated work');
  const result = g.transfer(['u1'], outpost, 'b0', 'wood'); assert.ok(result.id, result.error);
  until(g, () => !g.s.storage.transfers.length, 'actual b0 resupply');
  until(g, () => actor(g).phase === 'extract' && !actor(g).path.length && !/Recovery pace/.test(actor(g).reason), 'supported extraction resumes');
  assert.equal(g.s.tools, true); assert.deepEqual(actor(g).order, {kind: 'gather', target: 'd4'});
  assert.ok(integer(g.s.cultivation.demandSlots) > integer(slots)); custody(g);
});

test('the protected NEXT crop remains executable without its replacement and blocks discretionary work until ordinary resupply', () => {
  const {g} = provisioned(), outpost = exportEligible(g);
  const q = g.quotePlant('pilot', ['u0']); assert.equal(q.ok, true, q.reason); assert.equal(q.action, 'Plant protected recovery crop');
  const started = accepted(g.plant('pilot', ['u0'])); assert.ok(started.jobId); assert.equal(g.s.cultivation.nextFunded, false);
  const raw = g.serialize(), workshop = g.s.buildings.find(b => b.kind === 'workshop').id;
  assert.ok(g.beginKnapping(workshop, ['u1'])); assert.equal(g.serialize(), raw, 'Discretionary craft cannot use the paid recovery reserve');
  assert.equal(g.quotePlant('woodland', ['u1']).ok, false); assert.equal(g.serialize(), raw);
  until(g, () => summaryPlot(g).phase === 'output', 'protected recovery crop completes without replacement NEXT');
  receipt(g); assert.equal(g.s.cultivation.receipts.pilotFood, 6); assert.equal(g.s.cultivation.nextFunded, false);
  const send = g.transfer(['u1'], outpost, 'b0', 'wood'); assert.ok(send.id, send.error);
  until(g, () => !g.s.storage.transfers.length && g.s.cultivation.nextFunded, 'ordinary physical surplus restores NEXT');
  assert.equal(g.quotePlant('pilot', ['u0']).ok, true); custody(g);
});

test('adoption preserves live transfer, construction, reclaim and partial tool custody instead of settling the camp', () => {
  const earnEasternInputs = g => {
    for (const target of ['d4', 'd6']) { g.command(ids(g), {kind: 'gather', target}); legacyUntil(g, () => quiet(g), 'earn optional eastern ' + target); }
  };
  const scenarios = [
    g => { const outpost = g.s.buildings.find(b => b.kind === 'outpost').id; assert.ok(g.transfer(['u0'], 'b0', outpost, 'stone').id); legacyUntil(g, () => !!actor(g).transfer, 'old carried transfer'); },
    g => { earnEasternInputs(g); const site = g.build('workshop', 26, 13, ['u0']); assert.ok(site.id, site.error); legacyUntil(g, () => !!actor(g).supply, 'old carried construction input'); },
    g => { earnEasternInputs(g); const added = g.build('outpost', 26, 13, ids(g)); assert.ok(added.id, added.error); legacyUntil(g, () => g.s.buildings.find(b => b.id === added.id).done && quiet(g), 'extra paid outpost leaves opening supported'); const result = g.reclaim(['u0'], added.id); assert.ok(result.id, result.error); legacyUntil(g, () => !!actor(g).reclaim, 'old carried recovered capital'); }
  ];
  for (const prepare of scenarios) {
    const old = legacyEarned({tools: 'partial'}); prepare(old); const raw = old.serialize(), g = adopt(raw);
    preserveShape(old.s, g.s); assert.equal(old.serialize(), raw); assert.equal(g.s.cultivation.active, false); custody(g);
    const restored = reload(g); for (let n = 0; n < 50; n++) { tick(g); tick(restored); assert.equal(restored.serialize(), g.serialize()); }
  }
});

test('authored preview cells cannot overwrite an earned old building and are reserved against new footprints after adoption', () => {
  const old = legacyEarned(); old.command(ids(old), {kind: 'gather', target: 'd4'});
  legacyUntil(old, () => old.s.stock.wood >= 60, 'earn real obstruction inputs'); old.command(ids(old), {kind: 'idle'}); legacyUntil(old, () => quiet(old), 'stop before existing-site fixture');
  // Funding is locally owned at the east outpost, so physically return it first.
  const outpost = old.s.buildings.find(b => b.kind === 'outpost').id;
  for (let n = 0; old.store('b0').stock.wood < 60 && n < 8; n++) { const moved = old.transfer(ids(old), outpost, 'b0', 'wood'); assert.ok(moved.id, moved.error); legacyUntil(old, () => !old.s.storage.transfers.length, 'return real construction wood'); }
  assert.ok(old.store('b0').stock.wood >= 60);
  const site = old.build('outpost', 11, 17, []); assert.ok(site.id, site.error);
  const raw = old.serialize(); assert.equal(quoteAdoption(raw).ok, false); assert.throws(() => adopt(raw)); assert.equal(old.serialize(), raw);
  const {g} = adopted(), before = g.serialize();
  for (const [x, y] of [[11, 17], [14, 17], [10, 18], [17, 12]]) assert.ok(g.build('workshop', x, y, ['u0']).error);
  assert.equal(g.serialize(), before); assert.equal(g.blocked(11, 17), false, 'Preview beds remain ordinary walkable ground');
});

test('imported nearly finished floating Tools work charges only the allocated final slots and never a later helper', () => {
  const old = legacyEarned({tools: 'partial'}), workshop = old.s.buildings.find(b => b.kind === 'workshop').id;
  assert.equal(old.beginKnapping(workshop, ['u0']), null);
  legacyUntil(old, () => old.s.knapping.work >= 11.89, 'legitimately earned nearly complete old float work');
  old.command(ids(old), {kind: 'idle'}); legacyUntil(old, () => quiet(old), 'stop before old work completion');
  const originalWork = old.s.knapping.work; assert.ok(originalWork < 12);
  const g = adopt(old.serialize()); assert.equal(g.s.knapping.work, originalWork);
  accepted(g.discoverPlot('pilot')); gatherNew(g, 'seed'); gatherNew(g, 'water'); accepted(g.provision());
  for (const [id, x, y] of [['u0', 11, 14], ['u1', 12, 14], ['u2', 13, 15], ['u3', 13, 16]])
    assert.equal(g.command([id], {kind: 'move', x, y}), 1);
  until(g, () => quiet(g), 'all helpers reach distinct actual workshop edges');
  const spent = copy(g.s.spent); assert.equal(g.beginKnapping(workshop, ids(g).reverse()), null);
  assert.equal(g.s.units.filter(u => u.phase === 'craft' && !u.path.length && !u.cargo).length, 4, 'Four helpers are simultaneously eligible before the finishing slot');
  let expected = 0, nominal = originalWork;
  while (nominal + .00001 < 12 && expected < 10) { expected++; nominal = Math.min(12, nominal + .1); }
  assert.ok(expected > 0 && expected < 10);
  until(g, () => g.s.tools, 'final supported old slot');
  assert.equal(integer(g.s.cultivation.demandSlots), BigInt(expected));
  assert.equal(integer(g.s.cultivation.campSlots), BigInt(expected));
  assert.deepEqual(g.s.spent, spent, 'Already paid original bill stays paid once');
  const completed = g.serialize(), debit = g.s.cultivation.demandSlots; reload(g); tick(g);
  assert.equal(g.s.cultivation.demandSlots, debit); assert.ok(completed); custody(g);
});
