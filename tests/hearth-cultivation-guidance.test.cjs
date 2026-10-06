'use strict';
// Author and static review on M6; run only in the coordinator's Spark candidate.
// Presentation fixtures below are declared helper inputs, not earned gameplay.
// The final witness earns its camp and supplies through the actual engine.
const test = require('node:test');
const assert = require('node:assert/strict');
const Legacy = require('../src/hearth-rts/engine.js');
const {Camp, adopt, valid} = require('../src/hearth-cultivation/engine.js');
const {missingText, waterTransport, nextOpportunity} = require('../src/hearth-cultivation/guidance.js');
const waterNeed = (amount = '21900', unit = 'third-milli', location = 'b0') => ({resource: 'water', amount, unit, location});
const supplies = water => ({wood: 0, stone: 0, food: 0, water, seed: 0});
const store = (id, water, name = id === 'b0' ? 'Hearth store' : 'Outpost 2 store') => ({id, name, kind: id === 'b0' ? 'hearth' : 'outpost',
  stock: supplies(water), reserved: supplies(0), incoming: supplies(0), available: supplies(water)});
const plot = (id, phase, output = {}) => ({id, phase, label: id === 'pilot' ? 'Pilot crop' : 'Woodland plot', output});
function presentation({active = false, nextFunded = false, missing = [waterNeed(), waterNeed(3, 'whole recipe items')],
  quoteOk = false, stores = [store('b0', 0), store('b2', 27)], plots = [], routes = ['b2']} = {}) {
  return {s: {version: 7}, stores: () => stores,
    transferTargets: (from, to) => to === 'b0' && routes.includes(from) ? [{x: 21, y: 11}] : [],
    provisionQuote: () => ({ok: quoteOk, missing}),
    summary: () => ({active, nextFunded, nextMissing: missing, plots})};
}
function transportStep(g, sourceId = 'b2') {
  const step = nextOpportunity(g);
  assert.equal(step.title, 'Bring stored water to the Hearth');
  assert.equal(step.targetId, sourceId, 'Inspect must point at the actual named source, not the plot or Hearth');
  assert.match(step.actionLabel, /inspect/i);
  assert.match(step.detail, /Outpost 2 store/);
  assert.match(step.detail, /8 whole water to Hearth store/);
  assert.match(step.detail, /Hearth store/);
  assert.match(step.detail, /water/);
  assert.match(step.detail, /Send selected carriers/);
  assert.match(step.detail, /(?:arriv|deliver|receipt)/i);
  return step;
}

test('already stored remote water gives a named inspection and exact overlapping deficit without promising funding', () => {
  const g = presentation();
  assert.deepEqual(waterTransport(g, g.provisionQuote().missing), {sourceId: 'b2', sourceName: 'Outpost 2 store', availableWater: 27});
  const step = transportStep(g);
  assert.match(step.detail, /27/);
  assert.doesNotMatch(step.detail, /collect water and discover/i);
  assert.doesNotMatch(step.detail, /(?:fully funded|enough to fund|instant|automatically transfer)/i);
  assert.equal(g.provisionQuote().ok, false, 'Remote stock does not fund Hearth support');
});

test('one remote water remains a partial option and the full water/food/wood deficit stays visible', () => {
  const missing = [waterNeed('21901'), waterNeed(3, 'whole recipe items'),
    {resource: 'food', location: 'b0', amount: '3001', unit: 'third-milli'},
    {resource: 'wood', location: 'b0', amount: '15001', unit: 'third-milli'}];
  assert.equal(missingText(missing), '8 whole water to Hearth store; 2 whole food to Hearth store; 6 whole wood to Hearth store');
  const g = presentation({missing, stores: [store('b0', 0), store('b2', 1)]});
  assert.equal(waterTransport(g, missing).availableWater, 1);
  const step = transportStep(g);
  assert.match(step.detail, /2 whole food to Hearth store/);
  assert.match(step.detail, /6 whole wood to Hearth store/);
  assert.doesNotMatch(step.detail, /(?:fully funded|enough to fund|covers all|all supplies are ready)/i);
});

test('water transport requires a positive canonical Hearth shortage, not generic ingredient or unrelated missing rows', () => {
  const g = presentation();
  const excluded = [[], null, [{resource: 'seed', location: 'b0', amount: 2, unit: 'whole recipe items'}],
    [{resource: 'food', location: 'b0', amount: '21900', unit: 'third-milli'}],
    [{resource: 'wood', location: 'b0', amount: '21900', unit: 'third-milli'}],
    [{resource: 'seed/water', location: 'reachable stores', amount: 'recipe', unit: 'whole'}],
    [waterNeed('21900', 'third-milli', 'b2')], [waterNeed('21900', 'third-milli', 'Hearth store')],
    [waterNeed('21900', 'milli')], [waterNeed('21900', 'whole')], [{...waterNeed(), unit: undefined}],
    [waterNeed('0')], [waterNeed('-1')], [waterNeed('1.5')], [waterNeed('021900')], [waterNeed(' 21900')],
    [waterNeed('21900x')], [waterNeed('Infinity')], [waterNeed(NaN)], [waterNeed(Infinity)],
    [waterNeed(true)], [waterNeed(null)], [waterNeed({})], [waterNeed('1000000000000001')],
    [waterNeed(0, 'whole recipe items')], [waterNeed(-1, 'whole recipe items')],
    [waterNeed(0.5, 'whole recipe items')], [waterNeed('1', 'whole recipe items')],
    [waterNeed(10000000, 'whole recipe items')],
    [waterNeed(Number.MAX_SAFE_INTEGER + 1, 'whole recipe items')]];
  for (const missing of excluded) assert.equal(waterTransport(g, missing), null, 'Refuse unsupported deficit: ' + String(missing?.[0]?.amount));
  assert.equal(waterTransport(g, [waterNeed('1')]).sourceId, 'b2', 'One third-milli still requires a real whole-item supply');
  assert.equal(waterTransport(g, [waterNeed('1000000000000000')]).sourceId, 'b2', 'Largest supported ledger amount remains recognized');
  assert.equal(waterTransport(g, [waterNeed(1, 'whole recipe items')]).sourceId, 'b2');
});

test('recommendations use current whole available stock and an actual route, never raw stock or in-transit water', () => {
  const need = [waterNeed()];
  for (const available of [0, -1, 0.5, NaN, Infinity, '27', Number.MAX_SAFE_INTEGER + 1, 10000000]) {
    const remote = {...store('b2', 27), available: supplies(available), reserved: supplies(27), incoming: supplies(27)};
    assert.equal(waterTransport(presentation({stores: [store('b0', 100), remote]}), need), null);
  }
  assert.equal(waterTransport(presentation({stores: [store('b0', 27)]}), need), null, 'Hearth protection is not a remote source');
  assert.equal(waterTransport(presentation({routes: []}), need), null, 'Stock with no source-to-Hearth route is unavailable for this hint');
  assert.equal(waterTransport(presentation({stores: []}), need), null, 'Retired/unfinished stores absent from stores() cannot be inferred');
  const incomingOnly = {...store('b2', 0), incoming: supplies(27)};
  assert.equal(waterTransport(presentation({stores: [store('b0', 0), incomingOnly]}), need), null);
  const partial = {...store('b2', 27), reserved: supplies(26), available: supplies(1)};
  assert.equal(waterTransport(presentation({stores: [store('b0', 0), partial]}), need).availableWater, 1,
    'A reservation on another portion does not hide genuinely free water');
});

test('funding restoration and current eligibility remove the hint without overriding paid work', () => {
  const inactiveFunded = presentation({quoteOk: true});
  assert.equal(nextOpportunity(inactiveFunded).title, 'Prepare a supported camp');
  const activeFunded = presentation({active: true, nextFunded: true});
  assert.equal(nextOpportunity(activeFunded).title, 'Tend a supply patch');
  transportStep(presentation({active: true}));
  assert.equal(nextOpportunity(presentation({active: true, routes: []})).title, 'Fund the next crop');
  const noWater = presentation({missing: [{resource: 'food', location: 'b0', amount: '3001', unit: 'third-milli'}]});
  assert.equal(nextOpportunity(noWater).title, 'Prepare a supported camp');
  assert.match(nextOpportunity(noWater).detail, /Collect water and discover the seed cache/);
  const stores = [store('b0', 0), store('b2', 27)], routes = ['b2'];
  const changing = presentation({stores, routes});
  transportStep(changing);
  stores[1].available.water = 0;
  assert.equal(nextOpportunity(changing).title, 'Prepare a supported camp', 'Recompute current availability, do not cache an old hint');
  stores[1].available.water = 1;
  transportStep(changing);
  routes.length = 0;
  assert.equal(nextOpportunity(changing).title, 'Prepare a supported camp', 'Recompute the current route');
});

test('recovering supplies, physical trays, carried-only output and harvest outrank next-crop water setup', () => {
  const scenarios = [
    {plots: [plot('woodland', 'output', {wood: 8, seed: 2}), plot('pilot', 'cancelling')],
      title: 'Bring planting supplies back', target: 'pilot'},
    {plots: [plot('woodland', 'harvest'), plot('pilot', 'output', {food: 6, seed: 2})],
      title: 'Bring the yield home', target: 'pilot'},
    {plots: [plot('pilot', 'output', {food: 0, seed: 0, wood: 0})],
      title: 'Deliver the carried yield', target: 'pilot'},
    {plots: [plot('woodland', 'harvest')], title: 'Harvest the woodland', target: 'woodland'}
  ];
  for (const scenario of scenarios) {
    const step = nextOpportunity(presentation({active: true, plots: scenario.plots}));
    assert.equal(step.title, scenario.title); assert.equal(step.targetId, scenario.target);
    assert.doesNotMatch(step.detail, /Send selected carriers/);
  }
  const carried = nextOpportunity(presentation({active: true, plots: [plot('pilot', 'output', {food: 0, seed: 0})]}));
  assert.match(carried.detail, /real store receipt/);
});

const all = g => g.s.units.map(u => u.id);
const quiet = g => g.s.units.every(u => u.phase === 'idle' && !u.cargo && !u.path.length);
function until(g, condition, label, limit = 18000) {
  for (let i = 0; i < limit && !condition(); i++) g.tick(.1);
  assert.ok(condition(), 'Bounded actual-engine setup: ' + label);
}
function earnedRemoteWater() {
  const old = new Legacy.Camp();
  for (const target of ['d0', 'd1', 'd2', 'd3']) {
    old.command(all(old), {kind: 'gather', target}); until(old, () => quiet(old), 'earn western ' + target);
  }
  old.command(all(old), {kind: 'move', x: 25, y: 14}); until(old, () => quiet(old), 'scout eastern route');
  old.command(all(old), {kind: 'gather', target: 'd7'}); until(old, () => quiet(old), 'earn eastern food');
  old.command(all(old), {kind: 'move', x: 15, y: 14}); until(old, () => quiet(old), 'leave the building perimeter');
  for (const [kind, x, y] of [['workshop', 11, 15], ['outpost', 22, 11]]) {
    const result = old.build(kind, x, y, all(old)); assert.ok(result.id, result.error);
    until(old, () => old.s.buildings.find(b => b.id === result.id).done && quiet(old), 'physical ' + kind);
  }
  assert.equal(Legacy.valid(old.s), true);
  const g = adopt(old.serialize());
  assert.equal(g.discoverPlot('pilot').ok, true);
  assert.equal(g.collect('seed', ['u1']).ok, true);
  until(g, () => g.s.cultivation.seedCache === 0 && quiet(g), 'all six discovered seed physically reach a store');
  assert.equal(g.s.stock.seed, 6, 'Earn the actual ingredients rather than relying on unopened cache lineage');
  assert.equal(g.collect('water', ['u0']).ok, true);
  until(g, () => g.s.stock.water >= 25, 'real extracted water delivered to its nearest receiver');
  g.command(all(g), {kind: 'idle'}); until(g, () => quiet(g), 'stop collection and return any partial load');
  assert.equal(valid(g.s), true);
  assert.equal(g.store('b0').stock.water, 0);
  const source = g.stores().find(v => v.id !== 'b0' && v.available.water > 0);
  assert.ok(source); assert.ok(source.available.water >= 25);
  return {g, source};
}
function assertPure(g) {
  const raw = g.serialize(), quote = structuredClone(g.provisionQuote());
  for (let i = 0; i < 5; i++) {
    nextOpportunity(g); waterTransport(g, g.provisionQuote().missing); missingText(g.provisionQuote().missing);
  }
  assert.equal(g.serialize(), raw, 'Repeated hints preserve time, orders, support, all custody and materials');
  assert.deepEqual(g.provisionQuote(), quote, 'Presentation cannot grant affordability');
}

test('actual earned water respects pending transfer reservations, cargo persistence and physical-arrival funding', () => {
  const {g, source} = earnedRemoteWater(), home = g.store('b0');
  assert.equal(g.provisionQuote().ok, false);
  assert.match(missingText(g.provisionQuote().missing), /8 whole water to Hearth store/);
  assert.equal(waterTransport(g, g.provisionQuote().missing).availableWater, source.available.water);
  assert.equal(nextOpportunity(g).targetId, source.id); assertPure(g);
  const quote = g.quoteTransfer(all(g), source.id, 'b0', 'water');
  assert.equal(quote.error, null); assert.equal(quote.amount, 20, 'Existing four-carrier batch owns capacity');
  const result = g.transfer(all(g), source.id, 'b0', 'water'); assert.ok(result.id, result.error);
  assert.equal(g.store(source.id).available.water, source.available.water - 20);
  assert.equal(waterTransport(g, g.provisionQuote().missing).availableWater, source.available.water - 20,
    'The hint excludes this real outgoing job reservation');
  assert.equal(g.provisionQuote().ok, false, 'Assignment is not local receipt'); assertPure(g);
  until(g, () => g.s.units.some(u => u.transfer === result.id && u.cargo > 0), 'actual pickup before destination receipt');
  assert.equal(g.store('b0').stock.water, home.stock.water);
  assert.equal(g.provisionQuote().ok, false, 'Picked-up cargo is not support stock'); assertPure(g);
  const raw = g.serialize(), restored = new Camp(JSON.parse(raw));
  assert.equal(restored.serialize(), raw); assertPure(restored);
  assert.deepEqual(nextOpportunity(restored), nextOpportunity(g), 'Ordinary reload preserves the current custody-aware hint');
  until(restored, () => !restored.s.storage.transfers.length && quiet(restored), 'the actual outstanding load reaches Hearth');
  assert.equal(valid(restored.s), true);
  assert.equal(restored.store('b0').stock.water, 20);
  assert.equal(restored.provisionQuote().ok, true);
  assert.equal(nextOpportunity(restored).title, 'Prepare a supported camp', 'Funded support removes transport guidance');
  assertPure(restored);
});
