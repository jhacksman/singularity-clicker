'use strict';
// Author/static review on M6; execute only in the coordinator's Spark candidate.
const test = require('node:test');
const assert = require('node:assert/strict');
const {Camp, valid} = require('../src/hearth-rts/engine.js');
const {Session, nextStep} = require('../src/hearth-rts/feedback.js');
const copy = value => JSON.parse(JSON.stringify(value));
const actor = (g, id = 'u0') => g.s.units.find(u => u.id === id);
const deposit = (g, id = 'd0') => g.s.deposits.find(d => d.id === id);
const all = g => g.s.units.map(u => u.id);
const close = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-7, `${label}: ${actual} != ${expected}`);
const plain = g => JSON.parse(g.serialize());

// Bracket the real engine, checking the observer's complete serialized-state neutrality.
function step(g, session, oracle) {
  const before = plain(g), input = g.serialize();
  session.before(g.s); assert.equal(g.serialize(), input, 'before() is read-only');
  g.tick(.1); const output = g.serialize();
  session.after(g.s); assert.equal(g.serialize(), output, 'after() is read-only');
  assert.equal(valid(g.s), true);
  if (oracle) oracle(before, g.s);
}
function until(g, session, predicate, label, oracle, limit = 20000) {
  for (let i = 0; i < limit && !predicate(); i++) step(g, session, oracle);
  assert.ok(predicate(), 'Bounded real Camp scenario: ' + label);
}
function stop(g, session, ids = all(g)) {
  g.command(ids, {kind: 'idle'});
  until(g, session, () => ids.every(id => !actor(g, id).cargo && actor(g, id).phase === 'idle'), 'ordinary Stop and Return');
}
function observed(g = new Camp(), source = 'd0') {
  const session = new Session();
  assert.equal(g.command(['u0'], {kind: 'gather', target: source}), 1);
  return {g, session};
}
function receiptOracle(workerId = 'u0') {
  const receipts = [], ticks = [];
  return {receipts, ticks, read(before, after) {
    const u = before.units.find(v => v.id === workerId), v = after.units.find(v => v.id === workerId);
    const dt = after.time - before.time;
    ticks.push({start: before.time, end: after.time, dt, phase: u.path.length ? 'travelSeconds'
      : u.phase === 'extract' ? 'extractSeconds' : 'otherSeconds', outbound: !!u.path.length && u.phase === 'extract'});
    if (u.phase !== 'return' || u.path.length || !u.cargo || u.order.kind !== 'gather'
      || u.next || u.transfer || u.reclaim || u.supply || !u.dropoff) return;
    if (v.cargo !== 0) return;
    assert.equal(after.delivered[u.resource] - before.delivered[u.resource], u.cargo);
    assert.equal(after.storage.stores[u.dropoff][u.resource] - before.storage.stores[u.dropoff][u.resource], u.cargo);
    receipts.push({time: after.time, amount: u.cargo, storeId: u.dropoff, resource: u.resource, sourceId: u.order.target,
      sourceRemaining: after.deposits.find(d => d.id === u.order.target).amount});
  }};
}

test('actual custody: one full receipt is not a cycle; second receipt measures movement before extraction phase', () => {
  const {g, session} = observed(), oracle = receiptOracle();
  until(g, session, () => oracle.receipts.length === 1, 'first five-item receipt', oracle.read);
  assert.deepEqual(session.samplesFor('d0'), []);
  const first = session.latestReceipt();
  assert.equal(first.amount, 5); assert.equal(first.workerId, 'u0'); assert.equal(first.sourceId, 'd0');
  assert.equal(first.storeId, 'b0'); assert.equal(first.resource, 'wood'); assert.equal(first.producedWithTools, false);
  until(g, session, () => oracle.receipts.length === 2, 'second five-item receipt', oracle.read);
  const [sample] = session.samplesFor('d0'); assert.ok(sample); assert.equal(sample.amount, 5);
  assert.equal(sample.workerId, 'u0'); assert.equal(sample.workerName, 'Aru');
  assert.equal(sample.storeId, 'b0'); assert.equal(sample.storeName, 'Hearth store'); assert.equal(sample.tools, false);
  const [a, b] = oracle.receipts, measured = oracle.ticks.filter(t => t.start >= a.time - 1e-8 && t.end <= b.time + 1e-8);
  close(sample.time, b.time, 'receipt timestamp'); close(sample.seconds, b.time - a.time, 'actual receipt interval');
  for (const part of ['extractSeconds', 'travelSeconds', 'otherSeconds']) close(sample[part], measured.filter(t => t.phase === part).reduce((n, t) => n + t.dt, 0), part);
  assert.ok(measured.some(t => t.outbound), 'Witness outbound movement while phase still says extract');
  close(sample.seconds, sample.extractSeconds + sample.travelSeconds + sample.otherSeconds, 'partition sum');
  assert.equal(sample.sourceRemaining, b.sourceRemaining);
  assert.ok(sample.seconds > sample.extractSeconds); assert.equal(g.s.delivered.wood, 10);
});

test('repeating the identical Gather neither improves the observation nor changes engine bytes', () => {
  const a = observed(), b = observed();
  for (let i = 0; i < 500 && a.g.s.delivered.wood < 20; i++) {
    const raw = b.g.serialize(); b.g.command(['u0'], {kind: 'gather', target: 'd0'});
    assert.equal(b.g.serialize(), raw, 'Same active order is a no-op');
    step(a.g, a.session); step(b.g, b.session); assert.equal(b.g.serialize(), a.g.serialize());
    assert.deepEqual(b.session.samplesFor('d0'), a.session.samplesFor('d0'));
  }
  assert.ok(a.g.s.delivered.wood >= 20); assert.ok(a.session.samplesFor('d0').length);
});

test('inspection/paused observations add no simulated time and exposed records cannot mutate retained samples', () => {
  const {g, session} = observed();
  until(g, session, () => session.samplesFor('d0').length, 'measured cycle');
  const rows = session.samplesFor('d0'), receipt = session.latestReceipt(), raw = g.serialize();
  for (let i = 0; i < 20; i++) { session.before(g.s); session.after(g.s); nextStep(g, session); }
  assert.equal(g.serialize(), raw); assert.deepEqual(session.samplesFor('d0'), rows);
  const supplied = session.samplesFor('d0'); supplied[0].seconds = -100; supplied.length = 0;
  const r = session.latestReceipt(); r.amount = 99;
  assert.deepEqual(session.samplesFor('d0'), rows); assert.deepEqual(session.latestReceipt(), receipt);
});

test('a partial final load cannot replace a full-cycle sample or invent a five-item receipt', () => {
  const {g, session} = observed(), oracle = receiptOracle(); let lastFull;
  until(g, session, () => actor(g).phase === 'idle' && deposit(g).amount === 0 && actor(g).cargo === 0, 'finite source exhausted', (before, after) => {
    oracle.read(before, after);
    if (deposit(g).amount > 0 && session.samplesFor('d0').length) lastFull = copy(session.samplesFor('d0'));
  });
  assert.equal(g.s.delivered.wood, 48); assert.equal(oracle.receipts.at(-1).amount, 3);
  assert.ok(lastFull?.length);
  const evidence = rows => rows.map(({currentLayout, ...sample}) => sample);
  assert.deepEqual(evidence(session.samplesFor('d0')), evidence(lastFull));
  assert.ok(session.samplesFor('d0').every(s => s.currentLayout === false), 'Depletion changes topology, not old measurement evidence');
  for (const sample of session.samplesFor('d0')) assert.equal(sample.amount, 5);
});

test('loaded Move, held cargo and Stop return interrupt a window; gathering must earn a new complete window', () => {
  const {g, session} = observed();
  until(g, session, () => g.s.delivered.wood === 5 && actor(g).cargo === 2, 'incomplete second load');
  assert.equal(g.command(['u0'], {kind: 'move', x: 6, y: 16}), 1);
  until(g, session, () => actor(g).phase === 'idle', 'held moved cargo');
  assert.equal(actor(g).cargo, 2); assert.deepEqual(session.samplesFor('d0'), []);
  stop(g, session, ['u0']); assert.equal(g.s.delivered.wood, 7); assert.deepEqual(session.samplesFor('d0'), []);
  g.command(['u0'], {kind: 'gather', target: 'd0'});
  until(g, session, () => g.s.delivered.wood === 12, 'first complete receipt after interruption');
  assert.deepEqual(session.samplesFor('d0'), []);
  until(g, session, () => g.s.delivered.wood === 17, 'second complete receipt after interruption');
  assert.equal(session.samplesFor('d0').length, 1);
});

let western;
function earnedWest() {
  if (!western) {
    const g = new Camp(), observer = new Session();
    for (const target of ['d0', 'd1', 'd2']) {
      g.command(all(g), {kind: 'gather', target});
      until(g, observer, () => g.s.units.every(u => u.phase === 'idle' && !u.cargo), 'earn western ' + target);
    }
    assert.deepEqual(g.s.stock, {wood: 116, stone: 70, food: 0}); western = plain(g);
  }
  return new Camp(western);
}
function build(g, session, kind, x, y, selected = all(g)) {
  const result = g.build(kind, x, y, selected); assert.ok(result.id, result.error);
  until(g, session, () => g.s.buildings.find(b => b.id === result.id)?.done && g.s.units.every(u => u.order.kind !== 'build'), 'finish ' + kind);
  return result.id;
}
function scout(g, session) {
  g.command(all(g), {kind: 'move', x: 25, y: 14});
  until(g, session, () => g.s.units.every(u => u.phase === 'idle'), 'ordinary east scouting');
}

test('construction pickups, deliveries, transfers and physical reclaim never become gathered receipts', () => {
  const g = earnedWest(), session = new Session(), produced = copy(g.s.delivered);
  const outpost = build(g, session, 'outpost', 11, 15);
  assert.equal(session.latestReceipt(), null); assert.deepEqual(session.samplesFor('d0'), []);
  const transfer = g.transfer(['u0'], 'b0', outpost, 'wood'); assert.ok(transfer.id, transfer.error);
  until(g, session, () => !g.s.storage.transfers.length, 'physical transfer');
  assert.equal(session.latestReceipt(), null); assert.deepEqual(g.s.delivered, produced);
  const back = g.transfer(['u0'], outpost, 'b0', 'wood'); assert.ok(back.id, back.error);
  until(g, session, () => !g.s.storage.transfers.length, 'empty the outpost'); stop(g, session);
  const recovery = g.reclaim(all(g), outpost); assert.ok(recovery.id, recovery.error);
  until(g, session, () => !g.s.buildings.some(b => b.id === outpost), 'actual capital return');
  assert.equal(session.latestReceipt(), null); assert.deepEqual(g.s.delivered, produced);
  assert.deepEqual(g.s.reclaim.recovered, {wood: 60, stone: 20, food: 0});
});

test('changing topology or actual receiver breaks an in-flight interval but preserves clearly historical cycles', () => {
  const g = earnedWest(), session = new Session(); scout(g, session);
  g.command(['u0'], {kind: 'gather', target: 'd4'});
  until(g, session, () => session.samplesFor('d4').length, 'long eastern cycle to Hearth');
  const long = copy(session.samplesFor('d4')[0]); assert.equal(long.storeId, 'b0');
  until(g, session, () => actor(g).cargo === 1, 'start next long load');
  const id = build(g, session, 'outpost', 22, 11, ['u1', 'u2', 'u3']);
  until(g, session, () => session.samplesFor('d4').some(s => s.storeId === id), 'new receiver cycle');
  const rows = session.samplesFor('d4'), short = rows.find(s => s.storeId === id);
  assert.ok(rows.some(s => s.storeId === 'b0'), 'Retain one historical route observation');
  assert.equal(short.workerId, long.workerId); assert.equal(short.sourceId, long.sourceId);
  assert.ok(short.travelSeconds < long.travelSeconds, 'Actual shorter route, not nominal speed projection');
});

test('next-step workshop quote uses local free stock, preserves complete camp, and never purchases implicitly', () => {
  const g = earnedWest(), session = new Session(); scout(g, session);
  const outpost = build(g, session, 'outpost', 22, 11);
  const workshop = build(g, session, 'workshop', 26, 13);
  assert.equal(g.s.complete, true); assert.ok(g.s.stock.wood >= 4 && g.s.stock.stone >= 8);
  assert.deepEqual(g.store(outpost).stock, {wood: 0, stone: 0, food: 0});
  const raw = g.serialize(), stepInfo = nextStep(g, session);
  assert.equal(g.serialize(), raw); assert.equal(stepInfo.targetId, workshop);
  assert.match(stepInfo.actionLabel, /inspect workshop/i);
  assert.match(stepInfo.detail, /Outpost 1 store/); assert.match(stepInfo.detail, /4 wood/); assert.match(stepInfo.detail, /8 stone/);
  assert.equal(g.s.knapping, null); assert.equal(g.s.tools, false);
});

test('already paid interrupted work targets its original workshop and does not request another purchase', () => {
  const g = earnedWest(), session = new Session();
  const original = build(g, session, 'workshop', 11, 15), second = build(g, session, 'workshop', 14, 15);
  assert.equal(g.beginKnapping(original, ['u0']), null);
  until(g, session, () => g.s.knapping.work >= 1, 'partial paid work'); stop(g, session);
  const raw = g.serialize(), goal = nextStep(g, session), paid = copy(g.s.spent);
  assert.equal(goal.targetId, original); assert.notEqual(goal.targetId, second);
  assert.match(goal.detail, /reserved|paid/i); assert.equal(g.serialize(), raw);
  assert.equal(g.beginKnapping(original, ['u1']), null); assert.deepEqual(g.s.spent, paid);
  until(g, session, () => g.s.tools, 'finish already paid tools');
  const completed = nextStep(g, session); assert.match(completed.title + ' ' + completed.detail, /deliver|gather/i);
  assert.equal(session.latestReceipt({toolsOnly: true}), null);
});

test('tools completed while a load is carried do not retroactively qualify that load; a new full cycle does', () => {
  const g = earnedWest(), session = new Session(), workshop = build(g, session, 'workshop', 11, 15);
  assert.equal(g.beginKnapping(workshop, ['u1']), null);
  until(g, session, () => g.s.knapping.work >= 11, 'almost crafted tools'); stop(g, session, ['u1']);
  g.command(['u0'], {kind: 'gather', target: 'd3'});
  until(g, session, () => actor(g).cargo === 5, 'pre-tools full food cargo');
  assert.equal(g.beginKnapping(workshop, ['u1']), null);
  until(g, session, () => g.s.tools, 'tools finish during older cargo return');
  until(g, session, () => g.s.delivered.food >= 5, 'old cargo delivered');
  assert.equal(session.latestReceipt({toolsOnly: true}), null);
  until(g, session, () => session.latestReceipt({toolsOnly: true}) !== null, 'entirely post-tools extraction and receipt');
  assert.equal(session.latestReceipt({toolsOnly: true}).producedWithTools, true);
  until(g, session, () => session.samplesFor('d3').some(s => s.tools), 'full post-tools cycle');
  for (const s of session.samplesFor('d3').filter(s => s.tools)) {
    close(s.extractSeconds, 2.3, 'five items at 0.45 extraction under .1 ticks');
    assert.equal(s.amount, 5); assert.ok(s.travelSeconds > 0);
  }
});

test('session reset and restored camp retain economy but do not fabricate visit history', () => {
  const {g, session} = observed(); until(g, session, () => session.samplesFor('d0').length, 'history before reset');
  const raw = g.serialize(); session.reset(); assert.equal(g.serialize(), raw);
  assert.deepEqual(session.samplesFor('d0'), []); assert.equal(session.latestReceipt(), null);
  const restored = new Camp(JSON.parse(raw)), fresh = new Session();
  assert.equal(restored.serialize(), raw); assert.deepEqual(fresh.samplesFor('d0'), []);
  until(restored, fresh, () => !!fresh.latestReceipt(), 'new observed receipt after restore');
  assert.deepEqual(fresh.samplesFor('d0'), [], 'First newly witnessed receipt alone is not a cycle');
});

test('an earned completed-Tools save offers gathering after restore, with no fabricated prior receipt', () => {
  const g = earnedWest(), session = new Session(), workshop = build(g, session, 'workshop', 11, 15);
  assert.equal(g.beginKnapping(workshop, all(g)), null); until(g, session, () => g.s.tools, 'earned complete tools');
  g.command(['u0'], {kind: 'gather', target: 'd3'});
  until(g, session, () => !!session.latestReceipt({toolsOnly: true}), 'old session actual tool receipt');
  const raw = g.serialize(), restored = new Camp(JSON.parse(raw)), visit = new Session();
  assert.equal(restored.serialize(), raw); assert.equal(restored.s.tools, true);
  const goal = nextStep(restored, visit); assert.match(goal.title + ' ' + goal.detail, /gather|put.*tools.*work/i);
  assert.doesNotMatch(goal.detail, /delivered.*observed this visit/i);
  assert.equal(visit.latestReceipt({toolsOnly: true}), null); assert.deepEqual(visit.samplesFor('d3'), []);
  until(restored, visit, () => !!visit.latestReceipt({toolsOnly: true}), 'new session earns its own tool receipt');
  assert.ok(visit.latestReceipt({toolsOnly: true}).time > session.latestReceipt({toolsOnly: true}).time);
});

test('a new observer attached during the first item cannot credit earlier unobserved extraction', () => {
  const g = earnedWest(), previous = new Session(), workshop = build(g, previous, 'workshop', 11, 15);
  assert.equal(g.beginKnapping(workshop, all(g)), null); until(g, previous, () => g.s.tools, 'complete tools');
  g.command(['u0'], {kind: 'gather', target: 'd3'});
  until(g, previous, () => actor(g).phase === 'extract' && !actor(g).path.length && !actor(g).cargo && actor(g).work > 0, 'legitimately earned first-item progress');
  const original = g.serialize(), loaded = new Camp(JSON.parse(original)), visit = new Session();
  assert.equal(loaded.serialize(), original); assert.ok(actor(loaded).work > 0); assert.equal(actor(loaded).cargo, 0);
  until(loaded, visit, () => loaded.s.delivered.food === 5, 'first imported partial-item load received');
  assert.equal(visit.latestReceipt({toolsOnly: true}), null, 'Observed cargo 0 to 1 alone does not prove the whole item was observed');
  until(loaded, visit, () => loaded.s.delivered.food === 10, 'fresh complete post-import load received');
  assert.equal(visit.latestReceipt({toolsOnly: true}).amount, 5);
});

test('Tools finishing during first-item work cannot relabel its earlier pre-tools extraction', () => {
  const g = earnedWest(), session = new Session(), workshop = build(g, session, 'workshop', 11, 15);
  assert.equal(g.beginKnapping(workshop, ['u1']), null);
  until(g, session, () => g.s.knapping.work >= 11.8, 'near-complete paid tools'); stop(g, session, ['u1']);
  g.command(['u0'], {kind: 'gather', target: 'd3'});
  until(g, session, () => actor(g).phase === 'extract' && !actor(g).path.length && !actor(g).cargo && actor(g).work > 0, 'first-item pre-tools work');
  assert.equal(g.beginKnapping(workshop, ['u1']), null);
  until(g, session, () => g.s.tools, 'tools finish in first item');
  assert.equal(actor(g).cargo, 0, 'This witnesses partial work, separately from old carried cargo'); assert.ok(actor(g).work > 0);
  until(g, session, () => g.s.delivered.food === 5, 'mixed-profile first load received');
  assert.equal(session.latestReceipt({toolsOnly: true}), null);
  until(g, session, () => g.s.delivered.food === 10, 'entirely new tools load received');
  assert.equal(session.latestReceipt({toolsOnly: true}).producedWithTools, true);
});

test('switching finite sources cannot join two unrelated receipts into a cycle', () => {
  const {g, session} = observed(); until(g, session, () => g.s.delivered.wood === 5, 'first source receipt');
  assert.equal(g.command(['u0'], {kind: 'gather', target: 'd1'}), 1);
  until(g, session, () => g.s.delivered.wood === 10, 'first receipt at second source');
  assert.deepEqual(session.samplesFor('d0'), []); assert.deepEqual(session.samplesFor('d1'), []);
  until(g, session, () => g.s.delivered.wood === 15, 'second receipt at second source');
  assert.equal(session.samplesFor('d1').length, 1); assert.equal(session.samplesFor('d1')[0].sourceId, 'd1');
});

test('Stop then identical Gather between ticks invalidates the old window even when actor bytes return', () => {
  const {g, session} = observed(); until(g, session, () => g.s.delivered.wood === 5, 'first gathered receipt');
  const atReceipt = g.serialize(); assert.equal(actor(g).cargo, 0);
  g.command(['u0'], {kind: 'idle'}); const stopped = g.serialize(); session.notice(g.s);
  assert.equal(g.serialize(), stopped, 'Command notice is completely read-only');
  g.command(['u0'], {kind: 'gather', target: 'd0'}); session.notice(g.s);
  assert.equal(g.serialize(), atReceipt, 'Witness same actor bytes restored before the next tick');
  until(g, session, () => g.s.delivered.wood === 10, 'first receipt after between-tick interruption');
  assert.deepEqual(session.samplesFor('d0'), []);
  until(g, session, () => g.s.delivered.wood === 15, 'new uninterrupted full window');
  assert.equal(session.samplesFor('d0').length, 1);
});
