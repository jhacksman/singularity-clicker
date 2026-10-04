'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const {Camp, valid} = require('../src/hearth-rts/engine.js');

test('waiting construction workers report installation when the final physical load unlocks their work', () => {
  const g = new Camp(), ids = g.s.units.map(u => u.id);
  const advance = (predicate, label, limit = 18000) => {
    for (let i = 0; !predicate() && i < limit; i++) { g.tick(.1); assert.equal(valid(g.s), true); }
    assert.ok(predicate(), label);
  };
  for (const target of ['d0', 'd1', 'd2']) {
    g.command(ids, {kind: 'gather', target});
    advance(() => g.s.units.every(u => u.phase === 'idle' && !u.cargo), 'Earn western supplies');
  }
  assert.deepEqual(g.s.stock, {wood: 116, stone: 70, food: 0});
  const waitingIds = ['u0', 'u1', 'u2'];
  // Preposition empty peers before placement, using ordinary Move orders.
  for (const [i, id] of waitingIds.entries()) {
    const edge = [{x: 10, y: 15}, {x: 10, y: 16}, {x: 11, y: 17}][i];
    assert.equal(g.command([id], {kind: 'move', ...edge}), 1);
  }
  advance(() => waitingIds.every(id => g.s.units.find(u => u.id === id).phase === 'idle'), 'Preposition empty peers');
  const result = g.build('outpost', 11, 15, ['u3']); assert.ok(result.id, result.error);
  const building = () => g.s.buildings.find(b => b.id === result.id);
  const site = () => g.s.construction.sites.find(c => c.buildingId === result.id);
  advance(() => site().staged.wood + site().staged.stone === 75 && !!g.s.units[3].supply, 'Pick up the final load after fifteen site receipts');
  assert.equal(site().staged.wood + site().staged.stone, 75);
  assert.equal(site().sources.length, 0);
  assert.equal(g.command(waitingIds, {kind: 'build', target: result.id}), 3);
  for (const id of waitingIds) {
    const u = g.s.units.find(u => u.id === id); assert.equal(u.phase, 'construct'); assert.equal(u.path.length, 0);
    assert.equal(u.reason, 'Waiting for site supplies');
  }
  // The existing carrier keeps its original uninterrupted delivery order.
  advance(() => site() && site().staged.wood === 60 && site().staged.stone === 20, 'Final actual site receipt');
  const before = building().work;
  g.tick(.1); assert.equal(valid(g.s), true); assert.ok(building().work > before && !building().done);
  const installing = g.s.units.filter(u => waitingIds.includes(u.id) && u.phase === 'construct' && !u.path.length && !u.cargo);
  assert.deepEqual(installing.map(u => u.id), waitingIds, 'All three previously waiting peers perform installation');
  for (const u of installing) assert.equal(u.reason, 'Installing outpost', 'G01_WAITING_WORKER_MUST_SHOW_INSTALLING');
  const raw = g.serialize(); assert.equal(new Camp(JSON.parse(raw)).serialize(), raw, 'The displayed installation state survives exact reload');
});
