/* Opt-in browser artifact. Loading this file does not mount, navigate or write saves. */
(function (root) {
  'use strict';
  const mounts = new WeakMap();
  const labels = Object.freeze({cave: 'Cave camp', rts: 'Hearth opening', rtsBackup: 'Hearth backup before the tool update', rtsBackupV3: 'Hearth backup before the storage update', rtsImportBackupV3: 'Imported Hearth backup', rtsBackupV4: 'Hearth backup before the movement update', rtsImportBackupV4: 'Imported Hearth backup before the movement update', rtsBackupV5: 'Hearth original before outpost recovery', rtsImportBackupV5: 'Imported original before camp replacement', rtsOutgoingBackupV5: 'Outgoing live camp before import', rtsStoredBackupV5: 'Previous stored camp before import', rtsBackupV6: 'Hearth original before physical construction', rtsImportBackupV6: 'Imported original before physical construction adoption', rtsOutgoingBackupV6: 'Outgoing live camp before construction import', rtsStoredBackupV6: 'Previous stored camp before construction import', rtsRejectedBackupV6: 'Unreadable original kept before construction import', rtsWorkRoundoffBackup: 'Hearth original before work recovery', rtsImportWorkRoundoffBackup: 'Imported Hearth original before work recovery', hearth: 'Earlier Hearth game', hearthCompleted: 'Completed games from the earlier Hearth', agriculture: 'Earlier Agriculture game'});
  const saveStates = Object.freeze({'absent': 'No save found.', 'unreadable': 'This save could not be read. Try checking again.', 'invalid': 'This save could not be opened. Keep a copy before trying to recover it.', 'unsupported': 'This version cannot open this save. You can keep an original copy.', 'validator-unavailable': 'This game cannot check the save here. You can keep an original copy.', 'preserved-only': 'Kept for backup; this panel does not open or change it.', 'validated-standalone': 'Saved game available.'});
  function routeText(snapshot) {
    if (!snapshot.storageReadable) return 'Some saved progress cannot be read. Check again, or download any available saves below.';
    if (!['absent', 'validated-standalone'].includes(snapshot.sources.rts.status)) return 'Your saved Hearth opening cannot be opened here. Keep an original copy in Saved games and backups below.';
    if (snapshot.route.eligible) return snapshot.sources.rts.status === 'absent' ? 'Your fire is ready. Explore the Hearth opening in a new saved game.' : 'Your fire is ready. Continue your saved Hearth opening.';
    if (snapshot.sources.cave.status === 'absent') return 'Begin in the Cave and tend the fire to open the Hearth.';
    if (snapshot.sources.cave.status !== 'validated-standalone') return 'Your Cave save cannot be opened here. Keep an original copy in Saved games and backups below.';
    return 'Return to the Cave and finish tending the fire to open the Hearth.';
  }
  function mount({container, readSource = key => root.localStorage.getItem(key), listSourceKeys = () => Array.from({length: root.localStorage.length}, (_, i) => root.localStorage.key(i)), validateCave = root.CaveEngine?.Camp.valid, validateRTS = root.HearthRTS?.valid, developmentPreview = false, navigate = target => root.location.assign(target), exportSource = download} = {}) {
    if (!container || container.ownerDocument !== root.document) throw new TypeError('Provide an explicit local container.');
    if (!root.SingularityNavigation) throw new Error('Load the navigation policy first.');
    mounts.get(container)?.dispose();
    container.dataset.campaignNavigation = '';
    const policy = root.SingularityNavigation, adapter = policy.create({validateCave, validateRTS, digest: async bytes => Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('')});
    let disposed = false, generation = 0, busy = false, latest = null;
    function element(tag, text) { const node = root.document.createElement(tag); if (text !== undefined) node.textContent = text; return node; }
    function button(text, action, disabled = false) { const node = element('button', text); node.type = 'button'; node.dataset.navigationAction = action; node.disabled = disabled; return node; }
    function render(snapshot) {
      const active = container.contains(root.document.activeElement) ? root.document.activeElement : null;
      const focusAction = active?.dataset.navigationAction, focusToken = active?.dataset.navigationFocus;
      const disclosureOpen = container.querySelector('[data-navigation-backups]')?.open === true;
      const title = element('h2', 'Your journey');
      const status = element('p', routeText(snapshot)); status.dataset.navigationStatus = ''; status.dataset.navigationFocus = 'status'; status.tabIndex = -1; status.setAttribute('role', 'status');
      const cave = snapshot.sources.cave;
      const controls = element('div'); controls.dataset.navigationControls = '';
      const forward = button(snapshot.hearthEntry === 'existing-standalone-preview' ? 'Continue the Hearth opening' : 'Explore the Hearth opening', 'open-hearth', !snapshot.route.eligible); forward.dataset.navigationPrimary = ''; controls.append(forward);
      controls.append(button(cave.status === 'absent' ? 'Begin the Cave' : 'Return to the Cave', 'open-cave', !adapter.plan(snapshot, 'open-cave').allowed));
      if (developmentPreview === true) controls.append(button('Development preview · Hearth opening', 'preview-hearth', !snapshot.previewSafe));
      const limitation = element('p', 'The Hearth opening uses a separate saved game. Opening it keeps any existing Cave save; people and supplies do not carry over.');
      const legacy = element('details'); legacy.dataset.navigationBackups = ''; legacy.open = disclosureOpen;
      const summary = element('summary', 'Saved games and backups'); summary.dataset.navigationFocus = 'backups-summary'; legacy.append(summary);
      legacy.append(element('p', 'Download an original copy to keep it safe. Downloading does not replace or restore any game.'), button('Check saved games again', 'refresh'));
      const agriculture = element('p', 'The earlier Agriculture game is an unfinished preview. Its saves stay available below; this opening does not continue into Agriculture yet.'); agriculture.dataset.agricultureStatus = ''; legacy.append(agriculture);
      for (const kind of policy.KINDS) {
        const source = snapshot.sources[kind], row = element('div'); row.dataset.navigationSave = '';
        row.append(element('h3', labels[kind]), element('p', saveStates[source.status]));
        if (typeof source.raw === 'string') {
          row.append(button('Download original · ' + labels[kind], 'export:' + kind));
          row.append(element('small', 'Save key: ' + source.key + (source.schema === null ? '' : ' · file version ' + source.schema)));
        }
        legacy.append(row);
      }
      for (const source of snapshot.backups) {
        const row = element('div'); row.dataset.navigationSave = '';
        const name = labels[source.kind] + ' · copy ' + source.key.slice(source.key.lastIndexOf('.') + 1);
        row.append(element('h3', name), element('p', saveStates[source.status]));
        if (typeof source.raw === 'string') row.append(button('Download original · ' + name, 'export-backup:' + source.key));
        row.append(element('small', 'Save key: ' + source.key));
        legacy.append(row);
      }
      container.replaceChildren(title, status, controls, limitation, legacy);
      if (focusToken === 'backups-summary') summary.focus();
      else if (focusToken === 'status') status.focus();
      else if (focusAction) {
        const target = Array.from(container.querySelectorAll('[data-navigation-action]')).find(node => node.dataset.navigationAction === focusAction);
        if (target && !target.disabled && !target.closest('details:not([open])')) target.focus();
        else if (focusAction.startsWith('export')) { summary.focus(); status.textContent = 'That saved copy is no longer available. Check the remaining saved games and backups below.'; }
        else status.focus();
      }
    }
    async function read() {
      const raw = Object.create(null), unreadableKeys = [];
      let extraKeys = [];
      try { extraKeys = (await listSourceKeys()).filter(key => typeof key === 'string' && policy.backupKind(key)); }
      catch { unreadableKeys.push(policy.KEYS.rtsBackupV3); }
      for (const key of new Set([...Object.values(policy.KEYS), ...extraKeys])) {
        try { raw[key] = await readSource(key); } catch { raw[key] = null; unreadableKeys.push(key); }
      }
      return adapter.inspect(raw, {unreadableKeys});
    }
    async function refresh() {
      const ticket = ++generation;
      try {
        const snapshot = await read();
        if (disposed || ticket !== generation) return null;
        latest = snapshot; render(snapshot);
        return snapshot;
      } catch {
        if (!disposed && ticket === generation) {
          latest = null;
          const hadFocus = container.contains(root.document.activeElement);
          const message = element('p', 'Saved games could not be checked. Your saves have not been changed. Try again.'); message.setAttribute('role', 'status');
          const retry = button('Try checking saved games again', 'refresh');
          container.replaceChildren(message, retry);
          if (hadFocus) retry.focus();
        }
        return null;
      }
    }
    async function activate(action) {
      if (busy || disposed) return false;
      busy = true;
      let acceptedGeneration = null;
      try {
        const snapshot = await refresh();
        if (!snapshot || disposed) return false;
        acceptedGeneration = generation;
        if (action === 'refresh') return true;
        if (action.startsWith('export:')) {
          const kind = action.slice(7);
          if (!policy.KINDS.includes(kind) || typeof snapshot.sources[kind].raw !== 'string') return false;
          await exportSource(kind + '-original.json', snapshot.sources[kind].raw);
          return true;
        }
        if (action.startsWith('export-backup:')) {
          const source = snapshot.backups.find(source => source.key === action.slice(14));
          if (!source || typeof source.raw !== 'string') return false;
          await exportSource(source.key + '-original.json', source.raw);
          return true;
        }
        const intent = adapter.plan(snapshot, action, {developmentPreview});
        if (!intent.allowed) return false;
        await navigate(intent.target, intent);
        return true;
      } catch {
        if (!disposed && mounts.get(container) === controller && acceptedGeneration === generation) {
          const status = container.querySelector('[data-navigation-status]');
          if (status) status.textContent = 'This game could not be opened or its copy downloaded. Your saved games have not been changed by this panel.';
        }
        return false;
      } finally { busy = false; }
    }
    function click(event) {
      const target = event.target.closest('[data-navigation-action]');
      if (!target || !container.contains(target)) return;
      event.preventDefault();
      if (!target.disabled) void activate(target.dataset.navigationAction);
    }
    function changed(event) { if (event.key === null || Object.values(policy.KEYS).includes(event.key) || policy.backupKind(event.key)) void refresh(); }
    container.addEventListener('click', click);
    root.addEventListener('storage', changed);
    const controller = {refresh, activate, get snapshot() { return latest; }, dispose() { if (disposed) return; disposed = true; generation++; container.removeEventListener('click', click); root.removeEventListener('storage', changed); if (mounts.get(container) === controller) mounts.delete(container); }};
    mounts.set(container, controller);
    controller.ready = refresh();
    return Object.freeze(controller);
  }
  function download(name, raw) {
    let bytes, type = 'application/json;charset=utf-8';
    if (raw.isWellFormed()) bytes = new TextEncoder().encode(raw);
    else {
      // Blob(string) would replace unpaired surrogates. Preserve exact code units
      // instead, with an explicit encoding extension and no invented JSON wrapper.
      bytes = new Uint8Array(raw.length * 2);
      for (let i = 0; i < raw.length; i++) { const code = raw.charCodeAt(i); bytes[2 * i] = code & 255; bytes[2 * i + 1] = code >>> 8; }
      name = name.replace(/\.json$/, '.utf16le'); type = 'application/octet-stream';
    }
    const url = root.URL.createObjectURL(new Blob([bytes], {type}));
    const anchor = root.document.createElement('a'); anchor.href = url; anchor.download = name;
    root.document.body.append(anchor); anchor.click(); anchor.remove();
    root.setTimeout(() => root.URL.revokeObjectURL(url), 1000);
  }
  root.SingularityNavigationBrowser = Object.freeze({mount});
})(globalThis);
