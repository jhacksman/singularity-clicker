/* Read-only navigation policy. No storage writes, simulation, grants or root commits. */
(function (root) {
  'use strict';
  const KEYS = Object.freeze({
    cave: 'singularity-clicker.cave.v1',
    rts: 'singularity-clicker.hearth-rts.v1',
    rtsBackup: 'singularity-clicker.hearth-rts.v1.before-v2',
    rtsBackupV3: 'singularity-clicker.hearth-rts.v1.before-v3',
    rtsImportBackupV3: 'singularity-clicker.hearth-rts.v1.import-before-v3',
    rtsBackupV4: 'singularity-clicker.hearth-rts.v1.before-v4',
    rtsImportBackupV4: 'singularity-clicker.hearth-rts.v1.import-before-v4',
    rtsBackupV5: 'singularity-clicker.hearth-rts.v1.before-v5',
    rtsImportBackupV5: 'singularity-clicker.hearth-rts.v1.import-before-v5',
    rtsOutgoingBackupV5: 'singularity-clicker.hearth-rts.v1.outgoing-before-import-v5',
    rtsStoredBackupV5: 'singularity-clicker.hearth-rts.v1.stored-before-import-v5',
    rtsBackupV6: 'singularity-clicker.hearth-rts.v1.before-v6',
    rtsImportBackupV6: 'singularity-clicker.hearth-rts.v1.import-before-v6',
    rtsOutgoingBackupV6: 'singularity-clicker.hearth-rts.v1.outgoing-before-import-v6',
    rtsStoredBackupV6: 'singularity-clicker.hearth-rts.v1.stored-before-import-v6',
    rtsRejectedBackupV6: 'singularity-clicker.hearth-rts.v1.rejected-before-import-v6',
    rtsWorkRoundoffBackup: 'singularity-clicker.hearth-rts.v1.before-work-roundoff',
    rtsImportWorkRoundoffBackup: 'singularity-clicker.hearth-rts.v1.import-before-work-roundoff',
    hearth: 'singularity-clicker.hearth.v1',
    hearthCompleted: 'singularity-clicker.hearth.v1.completed',
    agriculture: 'singularity-clicker.agriculture.v1'
  });
  const VERSION = 1;
  // Compatibility source anchor; combined execution evidence is recorded separately.
  const BASE_COMMIT = '4e391c2e2ebf255e1cf0fb5b57bed6d123b51558';
  const MAX_BYTES = 6 * 1024 * 1024;
  const KINDS = Object.freeze(Object.keys(KEYS));
  const SCHEMAS = Object.freeze({cave: [1], rts: [1, 2, 3, 4, 5, 6], rtsBackup: [1], rtsBackupV3: [1, 2], rtsImportBackupV3: [1, 2], rtsBackupV4: [1, 2, 3], rtsImportBackupV4: [1, 2, 3], rtsBackupV5: [1, 2, 3, 4], rtsImportBackupV5: [1, 2, 3, 4, 5], rtsOutgoingBackupV5: [1, 2, 3, 4, 5], rtsStoredBackupV5: [1, 2, 3, 4, 5], rtsBackupV6: [1, 2, 3, 4, 5], rtsImportBackupV6: [1, 2, 3, 4, 5, 6], rtsOutgoingBackupV6: [1, 2, 3, 4, 5, 6], rtsStoredBackupV6: [1, 2, 3, 4, 5, 6], rtsRejectedBackupV6: [1, 2, 3, 4, 5, 6], rtsWorkRoundoffBackup: [1, 2, 3], rtsImportWorkRoundoffBackup: [1, 2, 3], hearth: [1], hearthCompleted: [1], agriculture: [1]});
  const KIND_SOURCE = Object.freeze({cave: 'cave-v1', rts: 'hearth-rts', rtsBackup: 'hearth-rts', rtsBackupV3: 'hearth-rts', rtsImportBackupV3: 'hearth-rts', rtsBackupV4: 'hearth-rts', rtsImportBackupV4: 'hearth-rts', rtsBackupV5: 'hearth-rts', rtsImportBackupV5: 'hearth-rts', rtsOutgoingBackupV5: 'hearth-rts', rtsStoredBackupV5: 'hearth-rts', rtsBackupV6: 'hearth-rts', rtsImportBackupV6: 'hearth-rts', rtsOutgoingBackupV6: 'hearth-rts', rtsStoredBackupV6: 'hearth-rts', rtsRejectedBackupV6: 'hearth-rts', rtsWorkRoundoffBackup: 'hearth-rts', rtsImportWorkRoundoffBackup: 'hearth-rts', hearth: 'hearth-v1', hearthCompleted: 'hearth-archive-v1', agriculture: 'agriculture-v1'});
  const BACKUP_KINDS = Object.freeze({'before-v2': 'rtsBackup', 'before-v3': 'rtsBackupV3', 'import-before-v3': 'rtsImportBackupV3', 'before-v4': 'rtsBackupV4', 'import-before-v4': 'rtsImportBackupV4', 'before-v5': 'rtsBackupV5', 'import-before-v5': 'rtsImportBackupV5', 'outgoing-before-import-v5': 'rtsOutgoingBackupV5', 'stored-before-import-v5': 'rtsStoredBackupV5', 'before-v6': 'rtsBackupV6', 'import-before-v6': 'rtsImportBackupV6', 'outgoing-before-import-v6': 'rtsOutgoingBackupV6', 'stored-before-import-v6': 'rtsStoredBackupV6', 'rejected-before-import-v6': 'rtsRejectedBackupV6', 'before-work-roundoff': 'rtsWorkRoundoffBackup', 'import-before-work-roundoff': 'rtsImportWorkRoundoffBackup'});
  function backupKind(key) {
    const match = /^singularity-clicker\.hearth-rts\.v1\.(before-v2|before-v3|import-before-v3|before-v4|import-before-v4|before-v5|import-before-v5|outgoing-before-import-v5|stored-before-import-v5|before-v6|import-before-v6|outgoing-before-import-v6|stored-before-import-v6|rejected-before-import-v6|before-work-roundoff|import-before-work-roundoff)(?:\.[1-9][0-9]*)?$/.exec(key);
    return match && match[0] === key ? BACKUP_KINDS[match[1]] : null;
  }
  const HANDOFF = Object.freeze({state: 'unavailable', committed: false, destinationWorldId: null, reason: 'Campaign handoff is not integrated. Opening the RTS preview transfers no people, supplies, grants or completion proofs.'});
  function frozen(value) {
    if (value && typeof value === 'object') { for (const child of Object.values(value)) frozen(child); Object.freeze(value); }
    return value;
  }
  function create({validateCave, validateRTS, digest} = {}) {
    if (typeof digest !== 'function') throw new TypeError('A trusted SHA-256 digest function is required.');
    const inspected = new WeakSet();
    async function source(kind, raw, unreadable, key = KEYS[kind]) {
      const result = {kind, key, raw, status: 'absent', schema: null, identity: null, completed: false, completionOrigin: null, detail: 'No saved source.'};
      if (unreadable) return {...result, raw: null, status: 'unreadable', detail: 'Saved source could not be read; it has not been replaced.'};
      if (raw === null) return result;
      if (typeof raw !== 'string') return {...result, raw: null, status: 'invalid', detail: 'Source must be an exact string or null.'};
      // UTF-8 hashing cannot distinguish ill-formed UTF-16 strings. Retain for export,
      // but never assign an identity or entry eligibility to them.
      if (!raw.isWellFormed()) return {...result, status: 'invalid', detail: 'Malformed text is retained for export; no source identity was inferred.'};
      const bytes = new TextEncoder().encode(raw);
      if (bytes.length > MAX_BYTES) return {...result, status: 'unsupported', detail: 'Source exceeds the inspected 6 MiB limit; retained for export.'};
      const hash = await digest(bytes);
      if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash)) throw new TypeError('Digest did not return lower-case SHA-256.');
      result.identity = 'legacy:' + KIND_SOURCE[kind] + ':' + hash;
      let state;
      try { state = JSON.parse(raw); } catch { return {...result, status: 'invalid', detail: 'Invalid JSON retained exactly for export.'}; }
      if (kind === 'hearthCompleted') {
        if (!Array.isArray(state) || !state.every(entry => typeof entry === 'string')) return {...result, status: 'invalid', detail: 'Expected the legacy archive array of serialized source strings; original text is retained.'};
        return {...result, status: 'preserved-only', archiveEntries: state.length, detail: 'Unversioned legacy archive containing ' + state.length + ' serialized sources. Entries are not validated, adopted or used as completion proofs.'};
      }
      if (!state || Array.isArray(state) || typeof state !== 'object' || !Number.isSafeInteger(state.version)) return {...result, status: 'invalid', detail: 'Missing or invalid payload version; retained for export.'};
      result.schema = state.version;
      if (!SCHEMAS[kind].includes(state.version)) return {...result, status: 'unsupported', detail: 'Payload version ' + state.version + ' has no navigation compatibility row; retained for export.'};
      if (['contentDigest', 'engineProfile', 'numericProfile', 'lineageId', 'branchId', 'timelineEpoch'].some(key => Object.hasOwn(state, key))) return {...result, status: 'unsupported', detail: 'Versioned campaign/content metadata needs the authoritative compatibility adapter; standalone rules were not borrowed.'};
      // These old standalone formats are deliberately not adopted or executed here.
      if (!['cave', 'rts'].includes(kind)) return {...result, status: 'preserved-only', detail: 'Original standalone source retained. No campaign adoption or full-age proof is implied.'};
      const validate = kind === 'cave' ? validateCave : validateRTS;
      if (typeof validate !== 'function') return {...result, status: 'validator-unavailable', detail: 'The matching bundled validator is unavailable. Export remains available; entry is blocked.'};
      let valid = false;
      try { valid = validate(structuredClone(state)) === true; } catch { /* A bad source is never an excuse to seed a new world. */ }
      if (!valid) return {...result, status: 'invalid', detail: 'The bundled engine rejected this source; retained for export.'};
      result.status = 'validated-standalone';
      if (kind === 'rts') return {...result, completed: false, previewMilestone: state.complete === true, detail: state.complete ? 'Opening preview milestone reached. First Furrow and Agriculture handoff are not implemented.' : 'Existing RTS opening preview; no full-age completion proof.'};
      if (state.run.complete === true && state.run.event === 4) return {...result, completed: true, completionOrigin: 'current-run', detail: 'Accepted Cave fire is complete.'};
      // A legitimate post-completion replay retains access, but everCompleted alone
      // or a malformed baseline is not evidence. Validate the baseline as a run.
      if (state.everCompleted === true && state.baseline?.complete === true && state.baseline.event === 4) {
        try {
          if (validate(structuredClone({...state, run: state.baseline})) === true) return {...result, completed: true, completionOrigin: 'preserved-baseline', detail: 'Cave replay in progress; the validated completed baseline remains available.'};
        } catch { /* Continue to the incomplete state. */ }
      }
      return {...result, detail: 'Complete the Cave fire before following the intended Hearth route.'};
    }
    async function inspect(rawByKey, {unreadableKeys = []} = {}) {
      if (!rawByKey || typeof rawByKey !== 'object' || Array.isArray(rawByKey)) throw new TypeError('Supply an explicit read-only source snapshot.');
      const entries = KINDS.map(kind => [kind, Object.hasOwn(rawByKey, KEYS[kind]) ? rawByKey[KEYS[kind]] : null]);
      const unreadable = new Set(unreadableKeys);
      const sources = Object.fromEntries(await Promise.all(entries.map(async ([kind, raw]) => [kind, await source(kind, raw, unreadable.has(KEYS[kind]))])));
      const extraKeys = [...new Set([...Object.keys(rawByKey), ...unreadableKeys])].filter(key => backupKind(key) && !Object.values(KEYS).includes(key)).sort();
      const backups = await Promise.all(extraKeys.map(key => source(backupKind(key), Object.hasOwn(rawByKey, key) ? rawByKey[key] : null, unreadable.has(key), key)));
      const anyUnreadable = [...Object.values(sources), ...backups].some(source => source.status === 'unreadable');
      let block = null;
      if (anyUnreadable) block = 'Some saved sources cannot be read. No entry is offered until reading succeeds.';
      else if (!['absent', 'validated-standalone'].includes(sources.rts.status)) block = sources.rts.detail;
      const ready = !block && sources.cave.completed;
      const snapshot = frozen({adapterVersion: VERSION, baseCommit: BASE_COMMIT, sources, backups, caveEntry: sources.cave.status === 'absent' ? 'not-entered' : sources.cave.status, hearthEntry: block ? 'blocked' : sources.rts.status === 'absent' ? 'not-entered-preview' : 'existing-standalone-preview', route: {target: 'hearth-rts.html', eligible: ready, reason: block || (ready ? 'The intended Hearth route opens the separate RTS preview.' : sources.cave.detail)}, handoff: {...HANDOFF}, agriculture: {entry: sources.agriculture.status === 'absent' ? 'not-entered' : 'legacy-slice-preserved', fullAgeComplete: false, handoffEligible: false, reason: 'Agriculture first surplus is a legacy slice, not L02.exit.v2. Full campaign entry is unavailable.'}, previewSafe: !block, storageReadable: !anyUnreadable});
      inspected.add(snapshot);
      return snapshot;
    }
    function plan(snapshot, action, {developmentPreview = false} = {}) {
      if (!snapshot || !inspected.has(snapshot)) throw new TypeError('Use this adapter’s inspected snapshot before planning navigation.');
      let target, mode;
      if (action === 'open-hearth' && snapshot.route.eligible) { target = 'hearth-rts.html'; mode = 'intended-route-preview'; }
      else if (action === 'preview-hearth' && developmentPreview === true && snapshot.previewSafe) { target = 'hearth-rts.html'; mode = 'explicit-development-preview'; }
      else if (action === 'open-cave' && snapshot.storageReadable && ['absent', 'validated-standalone'].includes(snapshot.sources.cave.status)) { target = 'index.html'; mode = 'standalone-cave'; }
      else return frozen({allowed: false, action, reason: action === 'open-agriculture' || action === 'commit-handoff' ? HANDOFF.reason : snapshot.route.reason, handoff: {...HANDOFF}});
      return frozen({allowed: true, action, target, mode, entry: snapshot.hearthEntry, sourceIdentities: {cave: snapshot.sources.cave.identity, rts: snapshot.sources.rts.identity}, handoff: {...HANDOFF}, transferredPeople: [], transferredStock: [], awardedEntitlements: []});
    }
    return Object.freeze({inspect, plan});
  }
  const API = Object.freeze({VERSION, BASE_COMMIT, KEYS, KINDS, MAX_BYTES, backupKind, create});
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.SingularityNavigation = API;
})(globalThis);
