'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const {Camp: Cave} = require('../src/engine.js');
const RTS = require('../src/hearth-rts/engine.js');
const {Hearth} = require('../src/hearth/engine.js');
const {Village} = require('../src/agriculture/engine.js');
const Navigation = require('../src/campaign-navigation/adapter.cjs');
const {KEYS} = Navigation;
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
// Native host admission contract: check a clone, including explicit legacy repair
// and constructor post-migration validation; discard it without writes or ticks.
function admitsRTS(state) {
  try { const copy = structuredClone(state); new RTS.Camp(RTS.repairWorkResidue(copy) || copy); return true; }
  catch { return false; }
}
const create = (overrides = {}) => Navigation.create({digest, validateCave: Cave.valid, validateRTS: admitsRTS, ...overrides});
function projectedRTS(version, source = new RTS.Camp().s) {
  // Deliberate compatibility projection, not an unmodified historical save.
  assert.ok([1, 2, 3].includes(version));
  const state = structuredClone(source); state.version = version;
  if (version < 3) delete state.storage;
  if (version === 1) { delete state.tools; delete state.knapping; }
  return state;
}
function gatheredCurrentRTS() {
  // Actual current-v4 command/tick checkpoint; no cargo or phase injection.
  const camp = new RTS.Camp(); assert.equal(camp.s.version, 4);
  assert.equal(camp.command(['u0'], {kind: 'gather', target: 'd0'}), 1);
  for (let i = 0; i < 500 && !camp.s.units[0].cargo; i++) camp.tick(.1);
  assert.ok(camp.s.units[0].cargo > 0); assert.equal(camp.s.units[0].resource, 'wood');
  assert.equal(RTS.valid(camp.s), true); return camp;
}
function completedCave() {
  // Explicit completed-source compatibility fixture, not a pacing or earned-play claim.
  const cave = new Cave(null, 17); cave.r.innovation = 1200; cave.r.event = 1;
  for (let i = 0; i < 3; i++) cave.fireStep();
  assert.equal(cave.r.complete, true); return cave;
}
const snapshot = (cave = completedCave().serialize(), rts = null) => ({[KEYS.cave]: cave, [KEYS.rts]: rts});

test('Cave fire states gate the intended RTS route; development preview is explicit', async () => {
  const a = create();
  for (const event of [0, 1, 2, 3]) {
    const cave = new Cave(null, 17); cave.r.event = event;
    const s = await a.inspect(snapshot(cave.serialize()));
    assert.equal(s.route.eligible, false); assert.equal(a.plan(s, 'open-hearth').allowed, false);
    assert.equal(a.plan(s, 'preview-hearth').allowed, false);
    assert.equal(a.plan(s, 'preview-hearth', {developmentPreview: true}).mode, 'explicit-development-preview');
  }
  const s = await a.inspect(snapshot());
  assert.equal(s.sources.cave.completionOrigin, 'current-run');
  const intent = a.plan(s, 'open-hearth');
  assert.equal(intent.target, 'hearth-rts.html'); assert.equal(intent.handoff.committed, false);
  assert.deepEqual(intent.transferredPeople, []); assert.deepEqual(intent.transferredStock, []); assert.deepEqual(intent.awardedEntitlements, []);
});

test('only a validated completed Cave baseline survives replay as entry evidence', async () => {
  const a = create(), cave = completedCave(); cave.replay();
  let s = await a.inspect(snapshot(cave.serialize()));
  assert.equal(s.route.eligible, true); assert.equal(s.sources.cave.completionOrigin, 'preserved-baseline');
  cave.state.baseline = null;
  s = await a.inspect(snapshot(cave.serialize())); assert.equal(s.route.eligible, false);
  cave.state.baseline = {complete: true, event: 4};
  s = await a.inspect(snapshot(cave.serialize())); assert.equal(s.route.eligible, false);
});

test('raw bytes and source-kind identity are preserved; reserialized lookalikes do not merge', async () => {
  const a = create(), cave = completedCave().serialize(), hearth = new Hearth().serialize();
  const raw = {...snapshot(' \n' + cave + '\n'), [KEYS.hearth]: hearth, [KEYS.hearthCompleted]: ' \n' + JSON.stringify([hearth]) + '\n', [KEYS.agriculture]: new Village().serialize()};
  const before = structuredClone(raw), s = await a.inspect(raw), compact = await a.inspect(snapshot(cave));
  assert.deepEqual(raw, before); assert.equal(s.sources.cave.raw, raw[KEYS.cave]);
  assert.equal(s.sources.cave.identity, 'legacy:cave-v1:' + digest(Buffer.from(raw[KEYS.cave])));
  assert.notEqual(s.sources.cave.identity, compact.sources.cave.identity);
  assert.notEqual(s.sources.hearth.identity, s.sources.hearthCompleted.identity);
  assert.equal(s.sources.hearthCompleted.identity, 'legacy:hearth-archive-v1:' + digest(Buffer.from(raw[KEYS.hearthCompleted])));
  assert.equal(s.sources.hearth.status, 'preserved-only'); assert.equal(s.sources.agriculture.status, 'preserved-only');
  assert.ok(Object.isFrozen(s.sources.cave)); assert.throws(() => { s.route.eligible = false; }, TypeError);
});

test('legacy completed archives retain their actual unversioned array envelope without certifying members', async () => {
  const a = create(), h = new Hearth(); h.s.complete = true; h.s.plowed = 1;
  for (const entries of [[], [h.serialize()], [h.serialize(), h.serialize()], ['{"version":99}', 'malformed member']]) {
    const raw = ' \n' + JSON.stringify(entries) + '\n', s = await a.inspect({...snapshot(), [KEYS.hearthCompleted]: raw});
    assert.equal(s.sources.hearthCompleted.status, 'preserved-only'); assert.equal(s.sources.hearthCompleted.schema, null);
    assert.equal(s.sources.hearthCompleted.archiveEntries, entries.length); assert.equal(s.sources.hearthCompleted.raw, raw);
    assert.equal(s.sources.hearthCompleted.completed, false); assert.equal(s.route.eligible, true); assert.equal(s.handoff.committed, false);
  }
  for (const raw of ['{}', '[{}]', '[null]', '"not an archive"', '[']) {
    const s = await a.inspect({...snapshot(), [KEYS.hearthCompleted]: raw});
    assert.equal(s.sources.hearthCompleted.status, 'invalid'); assert.equal(s.sources.hearthCompleted.raw, raw); assert.equal(s.route.eligible, true);
  }
});

test('current RTS v4 and explicit v1/v2/v3 projections share a key without changing raw identity', async () => {
  const a = create(), v4 = new RTS.Camp().s, v3 = projectedRTS(3, v4), v2 = projectedRTS(2, v4), v1 = projectedRTS(1, v4);
  assert.equal(v4.version, 4);
  for (const state of [v1, v2, v3, v4]) {
    const raw = JSON.stringify(state), s = await a.inspect(snapshot(undefined, raw));
    assert.equal(s.sources.rts.schema, state.version); assert.equal(s.sources.rts.key, KEYS.rts); assert.equal(s.route.eligible, true);
    assert.equal(s.sources.rts.raw, raw); assert.equal(JSON.stringify(state), raw);
    assert.equal(s.sources.rts.identity, 'legacy:hearth-rts:' + digest(Buffer.from(raw)));
    assert.equal(s.baseCommit, '4e391c2e2ebf255e1cf0fb5b57bed6d123b51558');
  }
  const raw = JSON.stringify(v1);
  let s = await a.inspect({...snapshot(undefined, raw), [KEYS.rtsBackup]: raw});
  assert.equal(s.route.eligible, true); assert.equal(s.sources.rts.identity, s.sources.rtsBackup.identity);
  const different = raw + '\n';
  s = await a.inspect({...snapshot(undefined, raw), [KEYS.rtsBackup]: different, [KEYS.rtsBackup + '.1']: raw, [KEYS.rtsBackupV3 + '.2']: JSON.stringify(v2), 'unrelated-secret': 'ignore'});
  assert.equal(s.route.eligible, true); // The current host preserves occupied slots by numbering backups.
  assert.equal(s.sources.rtsBackup.raw, different); assert.equal(s.backups.length, 2);
  assert.equal(s.backups.find(b => b.key === KEYS.rtsBackup + '.1').identity, s.sources.rts.identity);
  assert.equal(s.backups.some(b => b.raw === 'ignore'), false);
});

test('real import-backup namespaces are inspected and lookalike keys remain excluded', async () => {
  const a = create(), v2 = projectedRTS(2);
  const raw = ' \n' + JSON.stringify(v2) + '\n';
  const s = await a.inspect({...snapshot(undefined, raw), [KEYS.rtsImportBackupV3]: raw, [KEYS.rtsImportBackupV3 + '.2']: raw, [KEYS.rtsImportBackupV3 + '.0']: 'ignore', [KEYS.rtsImportBackupV3 + '.02']: 'ignore', [KEYS.rtsImportBackupV3 + '.2suffix']: 'ignore', [KEYS.rts + '.import-before-v2']: 'ignore'});
  assert.equal(s.sources.rtsImportBackupV3.status, 'preserved-only'); assert.equal(s.sources.rtsImportBackupV3.raw, raw);
  assert.equal(s.sources.rtsImportBackupV3.identity, s.sources.rts.identity);
  assert.equal(s.backups.length, 1); assert.equal(s.backups[0].key, KEYS.rtsImportBackupV3 + '.2'); assert.equal(s.backups[0].raw, raw);
});

test('naturally gathered current-v4 Move and held checkpoints remain exact sources during inspection', async () => {
  const a = create(), camp = gatheredCurrentRTS(), actor = camp.s.units[0], load = actor.cargo;
  const checkpoints = [camp.serialize()];
  assert.equal(camp.command([actor.id], {kind: 'move', x: 4, y: 9}), 1);
  assert.equal(actor.phase, 'carryMove'); checkpoints.push(camp.serialize());
  camp.tick(.1); assert.equal(actor.phase, 'carryMove'); checkpoints.push(camp.serialize());
  for (let i = 0; i < 500 && actor.phase !== 'idle'; i++) camp.tick(.1);
  assert.equal(actor.phase, 'idle'); assert.equal(actor.order.kind, 'idle');
  assert.equal(actor.cargo, load); assert.deepEqual([actor.x, actor.y], [4, 9]);
  checkpoints.push(camp.serialize());
  for (const serialized of checkpoints) {
    const raw = ' \n' + serialized + '\n', before = camp.serialize(), inputs = snapshot(undefined, raw), originalInputs = structuredClone(inputs);
    const s = await a.inspect(inputs);
    assert.equal(s.sources.rts.schema, 4); assert.equal(s.sources.rts.status, 'validated-standalone');
    assert.equal(s.sources.rts.raw, raw); assert.equal(s.sources.rts.identity, 'legacy:hearth-rts:' + digest(Buffer.from(raw)));
    assert.equal(s.route.eligible, true); assert.deepEqual(inputs, originalInputs); assert.equal(camp.serialize(), before);
    const intent = a.plan(s, 'open-hearth'); assert.equal(intent.sourceIdentities.rts, s.sources.rts.identity);
    assert.equal(intent.handoff.committed, false); assert.deepEqual(intent.transferredStock, []);
  }
});

const backupVersions = Object.freeze({rtsBackup: [1], rtsBackupV3: [1, 2], rtsImportBackupV3: [1, 2], rtsBackupV4: [1, 2, 3], rtsImportBackupV4: [1, 2, 3], rtsWorkRoundoffBackup: [1, 2, 3], rtsImportWorkRoundoffBackup: [1, 2, 3]});
test('all seven backup families preserve supported raw versions and numbered copies without playable validation', async () => {
  let validations = 0;
  const a = create({validateRTS() { validations++; throw Error('Backups must not use playable admission'); }});
  for (const [kind, versions] of Object.entries(backupVersions)) for (const version of versions) {
    const raw = ' \n' + JSON.stringify(projectedRTS(version)) + '\n', key = KEYS[kind];
    const input = {...snapshot(), [key]: raw, [key + '.1']: raw, [key + '.23']: raw + ' '}, before = structuredClone(input);
    const s = await a.inspect(input), sources = [s.sources[kind], ...s.backups];
    assert.equal(s.backups.length, 2); assert.equal(s.route.eligible, true); assert.deepEqual(input, before);
    for (const source of sources) {
      assert.equal(Navigation.backupKind(source.key), kind); assert.equal(source.kind, kind);
      assert.equal(source.status, 'preserved-only'); assert.equal(source.schema, version); assert.equal(source.completed, false);
      assert.equal(source.raw, input[source.key]); assert.equal(source.identity, 'legacy:hearth-rts:' + digest(Buffer.from(input[source.key])));
    }
    assert.equal(s.sources[kind].identity, s.backups.find(b => b.key === key + '.1').identity);
    assert.notEqual(s.sources[kind].identity, s.backups.find(b => b.key === key + '.23').identity);
  }
  assert.equal(validations, 0);
});

test('backup discovery accepts only exact namespaces and positive canonical suffixes', async () => {
  const a = create(), input = snapshot(), positive = [], excluded = [];
  for (const kind of Object.keys(backupVersions)) {
    const key = KEYS[kind], raw = JSON.stringify(projectedRTS(1));
    input[key] = raw; input[key + '.10'] = raw; positive.push(key + '.10');
    assert.equal(Navigation.backupKind(key), kind); assert.equal(Navigation.backupKind(key + '.10'), kind);
    excluded.push(...['.0', '.01', '.-1', '.1x', '.1.2', '.', '\n', '.1\n', 'suffix'].map(suffix => key + suffix));
    excluded.push('prefix.' + key, key.replace('.v1.', '.v2.'));
  }
  excluded.push(KEYS.rts + '.import-before-v2', KEYS.rts + '.before-v5', KEYS.rts + '.before-work-rounding', 'unrelated-secret');
  let unrelatedReads = 0;
  for (const key of excluded) {
    assert.equal(Navigation.backupKind(key), null);
    Object.defineProperty(input, key, {enumerable: true, get() { unrelatedReads++; throw Error('Unrelated value read'); }});
  }
  const s = await a.inspect(input);
  assert.deepEqual(s.backups.map(b => b.key).sort(), positive.sort()); assert.equal(unrelatedReads, 0);
  assert.equal(s.route.eligible, true);
});

test('backup raw contents never substitute for the live RTS source or waive compatibility rows', async () => {
  const a = create();
  for (const [kind, versions] of Object.entries(backupVersions)) {
    const key = KEYS[kind], raw = JSON.stringify(projectedRTS(versions.at(-1)));
    const absent = await a.inspect({...snapshot(), [key]: raw});
    assert.equal(absent.sources.rts.status, 'absent'); assert.equal(absent.hearthEntry, 'not-entered-preview');
    assert.equal(a.plan(absent, 'open-hearth').sourceIdentities.rts, null);
    const blocked = await a.inspect({...snapshot(undefined, '{'), [key]: raw});
    assert.equal(blocked.sources.rts.status, 'invalid'); assert.equal(blocked.route.eligible, false);
    assert.equal(a.plan(blocked, 'open-hearth').allowed, false); assert.equal(blocked.sources[kind].status, 'preserved-only');
    for (const [text, status] of [['{', 'invalid'], ['false', 'invalid'], ['0', 'invalid'], [JSON.stringify({...new RTS.Camp().s, version: versions.at(-1) + 1}), 'unsupported']]) {
      const input = {...snapshot(), [key]: text, [key + '.2']: text}, s = await a.inspect(input);
      assert.equal(s.route.eligible, true); assert.equal(s.sources.rts.status, 'absent');
      for (const source of [s.sources[kind], s.backups[0]]) {
        assert.equal(source.raw, text); assert.equal(source.identity, 'legacy:hearth-rts:' + digest(Buffer.from(text)));
        assert.equal(source.status, status);
      }
    }
  }
});

test('recognized unreadable backups block entry even when the live save is valid', async () => {
  const a = create(), raw = new RTS.Camp().serialize();
  for (const kind of Object.keys(backupVersions)) for (const suffix of ['', '.2']) {
    const key = KEYS[kind] + suffix, s = await a.inspect(snapshot(undefined, raw), {unreadableKeys: [key]});
    const source = suffix ? s.backups.find(b => b.key === key) : s.sources[kind];
    assert.equal(source.status, 'unreadable'); assert.equal(s.sources.rts.status, 'validated-standalone');
    assert.equal(s.storageReadable, false); assert.equal(s.route.eligible, false); assert.equal(a.plan(s, 'open-hearth').allowed, false);
  }
});

test('host admission repairs explicit legacy residue fixtures on clones while v4 negative work stays rejected', async () => {
  const current = gatheredCurrentRTS().s, a = create(), strict = create({validateRTS: RTS.valid});
  // Deliberately injected admission-boundary defect, not a naturally produced
  // historical roundoff trace. Current checkpoints above are generated normally.
  for (const version of [1, 2, 3]) {
    const state = projectedRTS(version, current); state.units[0].work = -Number.EPSILON;
    const before = structuredClone(state), raw = ' \n' + JSON.stringify(state) + '\n';
    assert.equal(RTS.valid(state), false); assert.ok(RTS.repairWorkResidue(state));
    assert.equal(admitsRTS(state), true); assert.deepEqual(state, before);
    const rejected = await strict.inspect(snapshot(undefined, raw)); assert.equal(rejected.sources.rts.status, 'invalid');
    const accepted = await a.inspect(snapshot(undefined, raw));
    assert.equal(accepted.route.eligible, true); assert.equal(accepted.sources.rts.schema, version);
    assert.equal(accepted.sources.rts.raw, raw); assert.equal(accepted.sources.rts.identity, 'legacy:hearth-rts:' + digest(Buffer.from(raw)));
    assert.deepEqual(state, before);
    for (const kind of ['rtsWorkRoundoffBackup', 'rtsImportWorkRoundoffBackup']) {
      const s = await strict.inspect({...snapshot(), [KEYS[kind]]: raw, [KEYS[kind] + '.1']: raw});
      assert.equal(s.sources[kind].status, 'preserved-only'); assert.equal(s.backups[0].status, 'preserved-only');
      assert.equal(s.sources[kind].raw, raw); assert.equal(s.backups[0].identity, accepted.sources.rts.identity);
    }
  }
  const invalidCurrent = structuredClone(current); invalidCurrent.units[0].work = -Number.EPSILON;
  const raw = JSON.stringify(invalidCurrent), before = structuredClone(invalidCurrent);
  assert.equal(invalidCurrent.version, 4); assert.equal(RTS.repairWorkResidue(invalidCurrent), null);
  assert.equal(admitsRTS(invalidCurrent), false); assert.deepEqual(invalidCurrent, before);
  const s = await a.inspect(snapshot(undefined, raw));
  assert.equal(s.sources.rts.status, 'invalid'); assert.equal(s.route.eligible, false); assert.equal(s.sources.rts.raw, raw);
});

test('constructor admission rejects input-valid legacy worlds that fail post-migration obligations', async () => {
  const a = create(), inputOnly = create({validateRTS: RTS.valid});
  for (const version of [1, 2]) {
    // Explicit invalid-obligation compatibility fixture, not an earned project.
    const state = projectedRTS(version);
    state.buildings.push({id: 'b1', kind: 'workshop', x: 11, y: 15, done: false, work: 0, cost: {wood: 40, stone: 30}});
    state.nextId = 2;
    const raw = ' \n' + JSON.stringify(state) + '\n', before = structuredClone(state);
    assert.equal(RTS.valid(state), true); assert.equal(RTS.repairWorkResidue(state), null);
    assert.throws(() => new RTS.Camp(state)); assert.equal(admitsRTS(state), false); assert.deepEqual(state, before);
    assert.equal((await inputOnly.inspect(snapshot(undefined, raw))).route.eligible, true);
    const rejected = await a.inspect(snapshot(undefined, raw));
    assert.equal(rejected.route.eligible, false); assert.equal(rejected.sources.rts.status, 'invalid');
    assert.equal(rejected.sources.rts.raw, raw); assert.equal(rejected.sources.rts.identity, 'legacy:hearth-rts:' + digest(Buffer.from(raw)));
    assert.deepEqual(state, before);
  }
});

test('preview completion, legacy Hearth completion and Agriculture surplus never become full-age proofs', async () => {
  const a = create(), rts = new RTS.Camp().s; rts.complete = true;
  const h = new Hearth(); h.s.complete = true;
  const ag = new Village(); ag.s.milestone = true;
  const s = await a.inspect({...snapshot(undefined, JSON.stringify(rts)), [KEYS.hearth]: h.serialize(), [KEYS.agriculture]: ag.serialize()});
  assert.equal(s.sources.rts.previewMilestone, true); assert.equal(s.sources.rts.completed, false);
  assert.equal(s.agriculture.fullAgeComplete, false); assert.equal(s.agriculture.handoffEligible, false);
  for (let i = 0; i < 100; i++) for (const action of ['commit-handoff', 'open-agriculture']) assert.equal(a.plan(s, action).allowed, false);
  assert.equal(s.handoff.destinationWorldId, null); assert.equal(s.handoff.committed, false);
});

test('missing, empty, malformed, future, unavailable-validator and unreadable sources differ safely', async () => {
  const a = create();
  const absent = await a.inspect({}); assert.equal(absent.sources.cave.status, 'absent'); assert.equal(a.plan(absent, 'open-cave').allowed, true);
  for (const raw of ['', '{', 'null', '[]', '{}', '{"version":1}', '{"version":99}']) {
    const s = await a.inspect(snapshot(raw)); assert.equal(s.route.eligible, false); assert.equal(s.sources.cave.raw, raw); assert.equal(a.plan(s, 'open-cave').allowed, false);
  }
  const futureRTS = JSON.stringify({...new RTS.Camp().s, version: 5});
  const future = await a.inspect(snapshot(undefined, futureRTS)); assert.equal(future.sources.rts.status, 'unsupported'); assert.equal(future.route.eligible, false);
  for (const raw of ['', '{', 'null', 'false', '0', '[]', '{}']) {
    const s = await a.inspect(snapshot(undefined, raw)); assert.equal(s.route.eligible, false); assert.equal(s.sources.rts.raw, raw);
    assert.equal(s.sources.rts.status, 'invalid'); assert.equal(a.plan(s, 'open-hearth').allowed, false);
  }
  const noValidator = create({validateCave: undefined}), nv = await noValidator.inspect(snapshot()); assert.equal(nv.sources.cave.status, 'validator-unavailable');
  const noRTSValidator = create({validateRTS: undefined}), nr = await noRTSValidator.inspect(snapshot(undefined, new RTS.Camp().serialize())); assert.equal(nr.route.eligible, false);
  const unreadable = await a.inspect(snapshot(), {unreadableKeys: [KEYS.hearth]}); assert.equal(unreadable.route.eligible, false); assert.equal(unreadable.storageReadable, false);
  assert.equal(unreadable.sources.hearth.status, 'unreadable'); assert.equal(a.plan(unreadable, 'open-cave').allowed, false);
  const versioned = await a.inspect(snapshot(undefined, JSON.stringify({...new RTS.Camp().s, contentDigest: 'unknown'})));
  assert.equal(versioned.sources.rts.status, 'unsupported'); assert.equal(versioned.route.eligible, false);
});

test('size limits and ill-formed UTF-16 retain sources without assigning ambiguous identity', async () => {
  const a = create(), huge = ' '.repeat(Navigation.MAX_BYTES + 1), malformed = '"\ud800"';
  for (const raw of [huge, malformed]) { const s = await a.inspect(snapshot(raw)); assert.equal(s.sources.cave.raw, raw); assert.equal(s.sources.cave.identity, null); assert.equal(s.route.eligible, false); }
});

test('hostile validators cannot mutate caller input and inspection failures cannot grant entry', async () => {
  const raw = snapshot(), before = structuredClone(raw);
  const a = create({validateCave(state) { state.run.complete = false; throw Error('rejected'); }});
  const s = await a.inspect(raw); assert.deepEqual(raw, before); assert.equal(s.route.eligible, false);
  const rtsRaw = snapshot(undefined, new RTS.Camp().serialize()), originalRTS = structuredClone(rtsRaw);
  const hostileRTS = create({validateRTS(state) { state.units[0].cargo = 99; state.version = 5; throw Error('rejected'); }});
  const rejectedRTS = await hostileRTS.inspect(rtsRaw);
  assert.deepEqual(rtsRaw, originalRTS); assert.equal(rejectedRTS.route.eligible, false); assert.equal(rejectedRTS.sources.rts.raw, rtsRaw[KEYS.rts]);
  await assert.rejects(create({digest: async () => { throw Error('crypto unavailable'); }}).inspect(raw));
  await assert.rejects(create({digest: () => 'invalid'}).inspect(raw), /SHA-256/);
});

test('only inspected immutable snapshots can create navigation plans; retries mint nothing', async () => {
  const a = create(), s = await a.inspect(snapshot()), second = create();
  assert.throws(() => a.plan({...s, route: {eligible: true}}, 'open-hearth'), /inspected/);
  assert.throws(() => second.plan(s, 'open-hearth'), /inspected/);
  for (let i = 0; i < 100; i++) assert.deepEqual(a.plan(s, 'open-hearth'), a.plan(s, 'open-hearth'));
  assert.equal(a.plan(s, '__proto__').allowed, false); assert.equal(a.plan(s, 'https://example.com').allowed, false);
});
