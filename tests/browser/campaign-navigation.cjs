/* Spark-only browser contract test. Compatibility fixtures are labeled, not earned-play evidence. */
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const {once} = require('node:events');
const {Camp: Cave} = require('../../src/engine.js'), RTS = require('../../src/hearth-rts/engine.js');
const {Hearth} = require('../../src/hearth/engine.js'), {Village} = require('../../src/agriculture/engine.js');
const Navigation = require('../../src/campaign-navigation/adapter.cjs'), {KEYS} = Navigation;
const playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const repository = path.resolve(__dirname, '../..'), output = path.join(repository, 'artifacts/campaign-navigation');
fs.mkdirSync(output, {recursive: true});
const scripts = ['src/engine.js', 'src/hearth-rts/engine.js', 'src/campaign-navigation/adapter.cjs', 'src/campaign-navigation/browser.js'].map(p => `<script src="/${p}"></script>`).join('');
const stylesheet = '<link rel="stylesheet" href="/src/campaign-navigation/styles.css">';
const fixtureHTML = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Navigation adapter integration fixture</title>${stylesheet}<h1>Navigation contract fixture</h1><button id="outside">Outside the helper</button><section id="journey"></section>${scripts}</html>`;
const files = new Set(['src/engine.js', 'src/hearth-rts/engine.js', 'src/campaign-navigation/adapter.cjs', 'src/campaign-navigation/browser.js', 'src/campaign-navigation/styles.css']);
const server = http.createServer((request, response) => {
  const name = new URL(request.url, 'http://localhost').pathname.slice(1);
  if (name === 'navigation-fixture.html') { response.setHeader('Content-Type', 'text/html;charset=utf-8'); response.end(fixtureHTML); return; }
  if (!files.has(name) && !['index.html', 'hearth-rts.html'].includes(name)) { response.writeHead(404); response.end(); return; }
  response.setHeader('Content-Type', name.endsWith('.css') ? 'text/css;charset=utf-8' : files.has(name) ? 'text/javascript;charset=utf-8' : 'text/html;charset=utf-8');
  response.end(fs.readFileSync(path.join(repository, files.has(name) ? name : 'dist/' + name)));
});
function sources() {
  const cave = new Cave(null, 17); cave.r.innovation = 1200; cave.r.event = 1;
  for (let i = 0; i < 3; i++) cave.fireStep();
  const rts = new RTS.Camp().s; rts.version = 1; delete rts.tools; delete rts.knapping; delete rts.storage;
  const raw = ' \n' + JSON.stringify(rts) + '\n';
  const completed = new Hearth(); completed.s.complete = true; completed.s.plowed = 1;
  return {[KEYS.cave]: cave.serialize(), [KEYS.rts]: raw, [KEYS.rtsBackup]: 'occupied v2 backup', [KEYS.rtsBackupV3]: 'occupied v3 backup', [KEYS.rtsBackup + '.7']: raw + ' ', [KEYS.hearth]: new Hearth().serialize(), [KEYS.hearthCompleted]: ' \n' + JSON.stringify([completed.serialize()]) + '\n', [KEYS.agriculture]: new Village().serialize()};
}
const reports = [], errors = [], presentation = [], nativeEvidence = [];
let browser, nativeDiagnosticPage = null;
async function mount(page, options = {}) {
  await page.evaluate(async options => {
    window.navigationEvents = []; window.navigation = SingularityNavigationBrowser.mount({container: document.getElementById('journey'), ...options, navigate: (target, intent) => window.navigationEvents.push({target, intent})});
    await window.navigation.ready;
  }, options);
}
async function checkPresentation(page, label) {
  const measurements = await page.locator('[data-campaign-navigation]').evaluate(container => {
    const bounds = container.getBoundingClientRect();
    const targets = Array.from(container.querySelectorAll('button, summary')).filter(node => node.getClientRects().length && (!node.closest('details:not([open])') || node.tagName === 'SUMMARY')).map(node => {
      const r = node.getBoundingClientRect(); return {name: node.textContent, x: r.x, y: r.y, width: r.width, height: r.height, overflow: node.scrollWidth - node.clientWidth};
    });
    return {width: bounds.width, x: bounds.x, overflow: container.scrollWidth - container.clientWidth, fontSize: parseFloat(getComputedStyle(container).fontSize), targets};
  });
  assert.ok(measurements.overflow <= 1, label + ': panel must not overflow horizontally');
  for (const target of measurements.targets) {
    assert.ok(target.height >= 44 && target.width >= 44, label + ': target too small: ' + target.name);
    assert.ok(target.overflow <= 1, label + ': text clipped: ' + target.name);
    assert.ok(target.x >= measurements.x - 1 && target.x + target.width <= measurements.x + measurements.width + 1, label + ': target exceeds panel width');
  }
  for (let i = 0; i < measurements.targets.length; i++) for (let j = i + 1; j < measurements.targets.length; j++) {
    const a = measurements.targets[i], b = measurements.targets[j];
    assert.ok(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y, label + ': interactive targets overlap');
  }
  presentation.push({label, ...measurements});
}
(async () => {
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const origin = 'http://127.0.0.1:' + server.address().port;
  browser = await playwright.chromium.launch({headless: true, chromiumSandbox: true});
  const context = await browser.newContext({viewport: {width: 1280, height: 900}}), page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin + '/navigation-fixture.html');
  assert.equal(await page.locator('#journey').innerText(), '');
  const raw = sources(); await page.evaluate(raw => { for (const [key, value] of Object.entries(raw)) localStorage.setItem(key, value); }, raw);
  await mount(page);
  assert.equal(await page.evaluate(() => window.navigation.snapshot.sources.hearthCompleted.status), 'preserved-only');
  assert.equal(await page.locator('[data-navigation-action="open-hearth"]').isEnabled(), true);
  await page.locator('[data-navigation-action="open-hearth"]').focus(); await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.navigationEvents.length === 1);
  assert.equal(await page.evaluate(() => window.navigationEvents[0].target), 'hearth-rts.html');
  assert.equal(await page.evaluate(() => window.navigationEvents[0].intent.handoff.committed), false);
  assert.equal(await page.locator('a[href*="agriculture"]').count(), 0);
  assert.match(await page.locator('[data-agriculture-status]').textContent(), /unfinished preview/);
  assert.doesNotMatch(await page.locator('#journey').innerText(), /L02\.exit|payload|completion proofs|committed|validated-standalone/);
  assert.match(await page.locator('[data-navigation-status]').innerText(), /Continue your saved Hearth opening/);
  assert.deepEqual(await page.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), Object.keys(raw)), raw);
  await checkPresentation(page, 'standalone-desktop');
  await page.screenshot({path: path.join(output, 'navigation-states.png'), fullPage: true});
  reports.push('Opt-in mount, keyboard activation, intended RTS route, explicit unavailable handoff and exact source preservation');

  // A stale enabled button is re-evaluated from storage before any navigation.
  await page.evaluate(key => localStorage.setItem(key, '{"version":99}'), KEYS.rts);
  await page.locator('[data-navigation-action="open-hearth"]').click();
  await page.waitForFunction(() => window.navigation.snapshot.sources.rts.status === 'unsupported');
  assert.equal(await page.evaluate(() => window.navigationEvents.length), 1);
  assert.equal(await page.locator('[data-navigation-action="open-hearth"]').isDisabled(), true);
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.navigationFocus), 'status');
  await page.evaluate(() => window.navigation.refresh());
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.navigationFocus), 'status');
  await page.evaluate(key => { window.beforeStatusRefresh = window.navigation.snapshot; window.dispatchEvent(new StorageEvent('storage', {key})); }, KEYS.rts);
  await page.waitForFunction(() => window.navigation.snapshot !== window.beforeStatusRefresh);
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.navigationFocus), 'status');
  assert.match(await page.locator('[data-navigation-status]').innerText(), /saved Hearth opening cannot be opened here/);
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [KEYS.rts, raw[KEYS.rts]]);
  await page.evaluate(() => window.navigation.refresh());
  const results = await page.evaluate(() => Promise.all([window.navigation.activate('open-hearth'), window.navigation.activate('open-hearth')]));
  assert.deepEqual(results, [true, false]); assert.equal(await page.evaluate(() => window.navigationEvents.length), 2);
  reports.push('Stale source blocks entry and overlapping activations produce one navigation');

  // Downloads inspect the helper's real bytes, not a replacement export callback.
  await page.locator('summary').focus(); await page.keyboard.press('Enter');
  assert.equal(await page.locator('details').evaluate(node => node.open), true);
  await page.keyboard.press('Space'); assert.equal(await page.locator('details').evaluate(node => node.open), false);
  await page.keyboard.press('Space'); assert.equal(await page.locator('details').evaluate(node => node.open), true);
  await page.evaluate(key => { window.beforeStorageRefresh = window.navigation.snapshot; window.dispatchEvent(new StorageEvent('storage', {key})); }, KEYS.rts);
  await page.waitForFunction(() => window.navigation.snapshot !== window.beforeStorageRefresh);
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.navigationFocus), 'backups-summary');
  const archiveEvent = page.waitForEvent('download');
  await page.locator('[data-navigation-action="export:hearthCompleted"]').focus(); await page.keyboard.press('Enter');
  assert.equal(fs.readFileSync(await (await archiveEvent).path(), 'utf8'), raw[KEYS.hearthCompleted]);
  assert.equal(await page.locator('details').evaluate(node => node.open), true);
  assert.equal(await page.evaluate(() => document.activeElement.dataset.navigationAction), 'export:hearthCompleted');
  for (const [action, expected, filename] of [['export:rts', raw[KEYS.rts], 'rts-original.json'], ['export-backup:' + KEYS.rtsBackup + '.7', raw[KEYS.rtsBackup + '.7'], KEYS.rtsBackup + '.7-original.json']]) {
    const event = page.waitForEvent('download');
    await page.locator('[data-navigation-action]').evaluateAll((nodes, action) => nodes.find(node => node.dataset.navigationAction === action).focus(), action); await page.keyboard.press('Enter');
    const download = await event; assert.equal(download.suggestedFilename(), filename);
    assert.equal(fs.readFileSync(await download.path(), 'utf8'), expected);
    assert.equal(await page.locator('details').evaluate(node => node.open), true);
    assert.equal(await page.evaluate(() => document.activeElement.dataset.navigationAction), action);
  }
  await page.evaluate(key => localStorage.setItem(key, '"\ud800"'), KEYS.rts);
  await page.evaluate(() => window.navigation.refresh());
  const malformedEvent = page.waitForEvent('download'); await page.locator('[data-navigation-action="export:rts"]').click();
  const malformed = await malformedEvent; assert.equal(malformed.suggestedFilename(), 'rts-original.utf16le');
  assert.equal(fs.readFileSync(await malformed.path()).toString('utf16le'), '"\ud800"');
  await page.locator('summary').focus(); await page.keyboard.press('Enter');
  await page.evaluate(() => window.navigation.refresh()); assert.equal(await page.locator('details').evaluate(node => node.open), false);
  assert.equal(await page.evaluate(() => document.activeElement.dataset.navigationFocus), 'backups-summary');
  reports.push('Real exports retain archive/backup bytes and malformed UTF-16; keyboard disclosure and focus persist across consecutive exports and refresh');

  // No storage method capable of mutation is needed by the adapter.
  await page.evaluate(() => {
    window.navigation.dispose();
    Storage.prototype.setItem = Storage.prototype.removeItem = Storage.prototype.clear = () => { throw Error('A navigation helper must not write'); };
    window.navigation = SingularityNavigationBrowser.mount({container: document.getElementById('journey'), readSource: () => { throw Error('read unavailable'); }, navigate: () => { throw Error('must not navigate'); }});
    return window.navigation.ready;
  });
  assert.equal(await page.locator('[data-navigation-action="open-hearth"]').isDisabled(), true);
  assert.match(await page.locator('[data-navigation-status]').innerText(), /cannot be read/);
  reports.push('Read failure is explicit; no fallback save, deletion or navigation');
  await context.close();

  const races = await browser.newContext(), race = await races.newPage(); race.on('pageerror', error => errors.push(error.message));
  await race.goto(origin + '/navigation-fixture.html');
  await race.evaluate(raw => { for (const [key, value] of Object.entries(raw)) localStorage.setItem(key, value); }, sources()); await mount(race);
  await race.evaluate(() => {
    const original = crypto.subtle.digest.bind(crypto.subtle); let hold = true;
    crypto.subtle.digest = async (...args) => { if (hold) { hold = false; await new Promise(resolve => window.releaseDigest = resolve); } return original(...args); };
    window.oldActivation = window.navigation.activate('open-hearth');
  });
  await race.waitForFunction(() => typeof window.releaseDigest === 'function');
  await race.evaluate(key => localStorage.setItem(key, '{"version":99}'), KEYS.rts);
  await race.evaluate(() => window.navigation.refresh());
  await race.evaluate(() => window.releaseDigest());
  assert.equal(await race.evaluate(() => window.oldActivation), false); assert.equal(await race.evaluate(() => window.navigationEvents.length), 0);
  assert.equal(await race.evaluate(() => window.navigation.snapshot.sources.rts.status), 'unsupported');
  // Rejection of a disposed host callback must not write into its replacement.
  await race.evaluate(raw => { for (const [key, value] of Object.entries(raw)) localStorage.setItem(key, value); }, sources());
  for (const action of ['export:rts', 'open-hearth']) {
    await race.evaluate(async action => {
      const pending = () => new Promise((resolve, reject) => window.rejectOldCallback = reject);
      window.navigation = SingularityNavigationBrowser.mount({container: document.getElementById('journey'), exportSource: pending, navigate: pending});
      await window.navigation.ready; window.pendingOld = window.navigation.activate(action);
    }, action);
    await race.waitForFunction(() => typeof window.rejectOldCallback === 'function');
    await race.evaluate(async () => { window.navigation = SingularityNavigationBrowser.mount({container: document.getElementById('journey'), navigate: () => {}}); await window.navigation.ready; window.replacementDOM = document.getElementById('journey').innerHTML; window.replacementSnapshot = JSON.stringify(window.navigation.snapshot); });
    await race.evaluate(() => { window.rejectOldCallback(Error('old host failure')); window.rejectOldCallback = undefined; });
    assert.equal(await race.evaluate(() => window.pendingOld), false);
    assert.equal(await race.evaluate(() => document.getElementById('journey').innerHTML === window.replacementDOM), true);
    assert.equal(await race.evaluate(() => JSON.stringify(window.navigation.snapshot) === window.replacementSnapshot), true);
  }
  // Focus remains local to the user's task, including errors and missing exports.
  await race.locator('#outside').focus(); await race.evaluate(() => window.navigation.refresh());
  assert.equal(await race.evaluate(() => document.activeElement.id), 'outside');
  await race.locator('[data-navigation-action="open-hearth"]').focus();
  await race.evaluate(() => { window.workingDigest = crypto.subtle.digest; crypto.subtle.digest = async () => { throw Error('inspection unavailable'); }; return window.navigation.refresh(); });
  assert.equal(await race.evaluate(() => document.activeElement?.dataset.navigationAction), 'refresh');
  assert.match(await race.locator('[role="status"]').innerText(), /could not be checked/);
  await race.evaluate(() => { crypto.subtle.digest = window.workingDigest; });
  await race.keyboard.press('Enter'); await race.waitForFunction(() => window.navigation.snapshot !== null);
  assert.equal(await race.evaluate(() => document.activeElement?.dataset.navigationFocus), 'status');
  await race.locator('summary').focus(); await race.keyboard.press('Enter');
  await race.locator('[data-navigation-action="export:rtsBackup"]').focus();
  await race.evaluate(key => { localStorage.removeItem(key); return window.navigation.refresh(); }, KEYS.rtsBackup);
  assert.equal(await race.evaluate(() => document.activeElement?.dataset.navigationFocus), 'backups-summary');
  assert.match(await race.locator('[data-navigation-status]').innerText(), /copy is no longer available/);
  await race.locator('[data-navigation-action="refresh"]').focus();
  await race.evaluate(() => {
    window.beforeKeyboardRefresh = window.navigation.snapshot;
    window.beforeRefreshButton = document.activeElement;
    window.refreshOriginalDigest = crypto.subtle.digest.bind(crypto.subtle);
    let hold = true;
    crypto.subtle.digest = async (...args) => {
      if (hold) { hold = false; await new Promise(resolve => window.releaseKeyboardRefresh = resolve); }
      return window.refreshOriginalDigest(...args);
    };
  });
  await race.keyboard.press('Enter');
  await race.waitForFunction(() => typeof window.releaseKeyboardRefresh === 'function');
  assert.equal(await race.evaluate(() => window.navigation.snapshot === window.beforeKeyboardRefresh), true);
  assert.equal(await race.evaluate(() => document.activeElement === window.beforeRefreshButton && window.beforeRefreshButton.isConnected), true);
  await race.evaluate(() => window.releaseKeyboardRefresh());
  await race.waitForFunction(() => window.navigation.snapshot !== null && window.navigation.snapshot !== window.beforeKeyboardRefresh);
  assert.equal(await race.evaluate(() => document.activeElement?.dataset.navigationAction), 'refresh');
  assert.equal(await race.evaluate(() => window.beforeRefreshButton.isConnected), false);
  await race.evaluate(() => { crypto.subtle.digest = window.refreshOriginalDigest; });
  // Copy follows real policy states; it cannot replace an unavailable action.
  await race.evaluate(key => localStorage.removeItem(key), KEYS.rts); await race.evaluate(() => window.navigation.refresh());
  assert.match(await race.locator('[data-navigation-status]').innerText(), /new saved game/);
  assert.match(await race.locator('[data-navigation-action="open-hearth"]').innerText(), /Explore/);
  await race.evaluate(([key, raw]) => localStorage.setItem(key, raw), [KEYS.cave, new Cave(null, 23).serialize()]); await race.evaluate(() => window.navigation.refresh());
  assert.equal(await race.locator('[data-navigation-action="open-hearth"]').isDisabled(), true);
  assert.match(await race.locator('[data-navigation-status]').innerText(), /finish tending the fire/);
  assert.doesNotMatch(await race.locator('#journey').innerText(), /L02\.exit|payload|completion proofs|committed|validated-standalone/);
  await races.close(); reports.push('A newer refresh fences off older asynchronous inspection and activation');
  reports.push('Disposed asynchronous export/navigation rejections leave replacement status, controls and snapshot unchanged');
  reports.push('Plain player guidance, stable status/retry/export focus, keyboard disclosure and no external focus stealing');

  // Native assembled-page cases below never call mount or replace product DOM.
  // Only the opt-in fixture above drives the helper API itself. This telemetry
  // calls the real host-requested mount once, with the exact options and result.
  async function nativePage(label, fixtures) {
    const context = await browser.newContext({viewport: {width: 1440, height: 1100}, recordVideo: {dir: path.join(output, 'videos'), size: {width: 1440, height: 1100}}});
    await context.addInitScript(fixtures => {
      if (!sessionStorage.getItem('native-navigation-fixture-seeded')) { for (const [key, value] of Object.entries(fixtures)) localStorage.setItem(key, value); sessionStorage.setItem('native-navigation-fixture-seeded', 'yes'); }
      window.__nativeMounts = []; window.__nativeLifecycle = []; window.__nativeDocument = crypto.randomUUID();
      for (const type of ['pagehide', 'pageshow']) window.addEventListener(type, event => window.__nativeLifecycle.push({type, persisted: event.persisted, trusted: event.isTrusted}));
      function observeStorage() {
        const methods = ['setItem', 'removeItem', 'clear'], originals = Object.fromEntries(methods.map(method => [method, Storage.prototype[method]]));
        const observation = {calls: [], active: true, stop() { for (const method of methods) Storage.prototype[method] = originals[method]; observation.active = false; }};
        for (const method of methods) Storage.prototype[method] = function (...args) { observation.calls.push({method, storage: this === localStorage ? 'localStorage' : this === sessionStorage ? 'sessionStorage' : 'other', args}); return Reflect.apply(originals[method], this, args); };
        window.__nativeStorageObservation = observation;
      }
      let exposed;
      Object.defineProperty(window, 'SingularityNavigationBrowser', {configurable: true, get: () => exposed, set(api) {
        exposed = Object.freeze({...api, mount(options) {
          // The host already opened/paused the modal. Observe the successful
          // helper window before its first instruction, not earlier Cave saves.
          if (window.__observeStorageOnMount) { window.__observeStorageOnMount = false; observeStorage(); }
          const controller = api.mount(options); window.__nativeMounts.push({controller, ready: controller.ready}); return controller;
        }});
      }});
    }, fixtures);
    const page = await context.newPage(); page.on('pageerror', error => errors.push(label + ': ' + error.message));
    nativeDiagnosticPage = page;
    await page.goto(origin + '/index.html'); await page.locator('#event-action').waitFor({state: 'visible'});
    assert.equal(await page.evaluate(() => window.__nativeMounts.length), 0, 'The native host mounts only when completion is opened');
    return {context, page, fixtures, label};
  }
  const rawSources = (page, keys) => page.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), keys);
  async function readyNative(page) {
    await page.waitForFunction(() => window.__nativeMounts.length > 0);
    await page.evaluate(() => window.__nativeMounts.at(-1).ready.then(() => null));
    await page.locator('#campaign-navigation [data-navigation-status]').waitFor();
  }
  async function openCompletion(page) { await page.locator('#event-action').click(); await readyNative(page); assert.equal(await page.locator('#modal').evaluate(node => node.open), true); }
  async function nativeFocusState(page) {
    return page.evaluate(() => {
      const modal = document.getElementById('modal'), active = document.activeElement;
      return {tag: active?.tagName || null, id: active?.id || '', action: active?.dataset.navigationAction || null, outerHTML: active?.outerHTML.slice(0, 240) || null, inside: !!active && modal.contains(active), open: modal.open, modal: modal.matches(':modal'), hasFocus: document.hasFocus()};
    });
  }
  async function nativeFocusBoundary(page, key, expected, label) {
    const steps = [];
    // Native focus navigation may visit browser controls before re-entering the
    // modal. Never infer that boundary from an empty element id alone.
    for (let count = 0; count < 8; count++) {
      await page.keyboard.press(key); const state = await nativeFocusState(page); steps.push(state);
      fs.writeFileSync(path.join(output, 'native-focus-' + label + '.json'), JSON.stringify({key, expected, steps, events: await page.evaluate(() => window.__nativeFocusEvents)}, null, 2));
      assert.ok(state.open && state.modal, 'The native modal must remain open throughout keyboard navigation');
      if (state.inside) { assert.equal(state.hasFocus, true, 'Return requires actual document focus'); assert.equal(state.id, expected); return steps; }
      assert.ok(!state.hasFocus && ['BODY', 'HTML'].includes(state.tag), 'Only an observed out-of-document boundary is allowed; background or unexplained in-document focus fails');
    }
    assert.fail('Keyboard focus did not return to the native modal within eight inputs');
  }
  async function nativeExport(page, action, name) {
    const details = page.locator('#campaign-navigation details'); if (!await details.evaluate(node => node.open)) await page.locator('#campaign-navigation summary').click();
    const event = page.waitForEvent('download'); await page.locator('#campaign-navigation [data-navigation-action="' + action + '"]').click();
    const download = await event, filename = path.join(output, name); await download.saveAs(filename); return fs.readFileSync(filename, 'utf8');
  }
  async function enterRTS(page) {
    await Promise.all([page.waitForURL('**/hearth-rts.html'), page.locator('#campaign-navigation [data-navigation-action="open-hearth"]').click()]);
    await page.locator('[data-unit="u0"]').waitFor(); assert.equal(await page.locator('#pause').innerText(), 'Resume');
    const state = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEYS.rts); assert.equal(state.version, 4); assert.ok(RTS.valid(state)); return state;
  }
  async function backToCave(page, prior, label) {
    await page.goBack({waitUntil: 'domcontentloaded'}); await page.locator('#event-action').waitFor({state: 'visible'});
    await page.waitForFunction(prior => { const last = window.__nativeLifecycle.at(-1); return last?.type === 'pageshow' && last.trusted && (window.__nativeDocument !== prior.document || window.__nativeMounts.length > prior.mounts); }, prior);
    const returned = await page.evaluate(() => ({document: window.__nativeDocument, events: window.__nativeLifecycle, mounts: window.__nativeMounts.length, open: document.getElementById('modal').open}));
    const show = returned.events.filter(event => event.type === 'pageshow').at(-1); assert.ok(show && show.trusted, 'Record the actual browser return, not a simulated lifecycle event');
    if (show.persisted) { assert.equal(returned.document, prior.document); assert.equal(returned.open, true); assert.equal(returned.mounts, prior.mounts + 1, 'BFCache restores the disposed native completion controller'); await readyNative(page); }
    else { assert.notEqual(returned.document, prior.document); assert.equal(returned.mounts, 0); await openCompletion(page); }
    nativeEvidence.push({case: label, returnMode: show.persisted ? 'actual-bfcache' : 'actual-full-reload', events: returned.events});
  }
  const nativePosition = page => page.evaluate(() => ({document: window.__nativeDocument, mounts: window.__nativeMounts.length}));
  async function importRTS(page, incoming, label) {
    await page.locator('#journey').click(); assert.doesNotMatch(await page.locator('#save-status').innerText(), /Import could not be saved|not a compatible/);
    page.once('dialog', dialog => dialog.accept()); await page.locator('#file').setInputFiles({name: label + '.json', mimeType: 'application/json', buffer: Buffer.from(incoming)});
    await page.locator('#dialog').waitFor({state: 'hidden'}); // this attempt's completed handler, never a stale version==4 predicate
    const state = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEYS.rts);
    assert.deepEqual(state, new RTS.Camp(RTS.repairWorkResidue(JSON.parse(incoming)) || JSON.parse(incoming)).s); assert.equal(state.version, 4); assert.equal(await page.locator('#pause').innerText(), 'Resume');
  }

  const integrationFixtures = {...sources(), [KEYS.rtsBackupV4]: 'occupied v4 backup'};
  const integration = await nativePage('native-route', integrationFixtures), integrated = integration.page;
  await integrated.evaluate(() => { window.__observeStorageOnMount = true; });
  await openCompletion(integrated); assert.deepEqual(await rawSources(integrated, Object.keys(integrationFixtures)), integrationFixtures);
  assert.equal(await integrated.locator('[data-navigation-action="open-hearth"]').isEnabled(), true);
  await integrated.locator('#campaign-navigation summary').click();
  await integrated.evaluate(() => { window.__beforeObservedRefresh = window.__nativeMounts[0].controller.snapshot; });
  await integrated.locator('#campaign-navigation [data-navigation-action="refresh"]').click();
  await integrated.waitForFunction(() => window.__nativeMounts[0].controller.snapshot !== window.__beforeObservedRefresh && window.__nativeMounts[0].controller.snapshot?.sources.rts.status === 'validated-standalone');
  assert.equal(await nativeExport(integrated, 'export:rts', 'native-observed-original.json'), integrationFixtures[KEYS.rts]);
  const observedMutations = await integrated.evaluate(() => { const observation = window.__nativeStorageObservation; observation.stop(); return {active: observation.active, calls: observation.calls}; });
  fs.writeFileSync(path.join(output, 'native-successful-storage-observation.json'), JSON.stringify({scope: 'before original native mount through completed ready, visible refresh and actual export; stopped before host close/pagehide/Replay or destination writes', ...observedMutations}, null, 2));
  assert.equal(observedMutations.active, false); assert.deepEqual(observedMutations.calls, [], 'Successful native inspection, refresh and export must call no Storage mutation method, even with identical bytes or temporary keys');
  assert.deepEqual(await rawSources(integrated, Object.keys(integrationFixtures)), integrationFixtures); await integrated.locator('#campaign-navigation summary').click();
  nativeEvidence.push({case: 'successful-native-mount-refresh-export-zero-writes', mutationCalls: observedMutations.calls.length, forwarding: 'original Storage receiver/arguments/result preserved; no mutation blocked'});
  assert.equal(await integrated.locator('#modal a[href="hearth.html"]').count(), 0);
  assert.match(await integrated.locator('#modal-content').innerText(), /finite supplies/i); assert.match(await integrated.locator('#modal-content').innerText(), /eastern outpost/i); assert.match(await integrated.locator('#modal-content').innerText(), /workshop/i);
  assert.doesNotMatch(await integrated.locator('#modal-content').innerText(), /Tending embers|cooking|L02\.exit|completion proofs/);
  assert.equal(await integrated.locator('#modal .modal-facts strong').count(), 4, 'Completion facts remain in the native modal');
  await checkPresentation(integrated, 'cave-desktop');
  await integrated.locator('[data-navigation-action="open-hearth"]').focus(); await integrated.keyboard.press('Tab'); assert.equal(await integrated.evaluate(() => document.activeElement.dataset.navigationAction), 'open-cave');
  await integrated.keyboard.press('Shift+Tab'); assert.equal(await integrated.evaluate(() => document.activeElement.dataset.navigationAction), 'open-hearth');
  const focus = await integrated.locator('[data-navigation-action="open-hearth"]').evaluate(node => { const style = getComputedStyle(node); return {visible: node.matches(':focus-visible'), outline: style.outlineStyle, width: parseFloat(style.outlineWidth)}; });
  assert.equal(focus.visible, true); assert.notEqual(focus.outline, 'none'); assert.ok(focus.width >= 2);
  await integrated.evaluate(() => {
    window.__nativeFocusEvents = [];
    const record = event => { const active = document.activeElement; window.__nativeFocusEvents.push({type: event.type, key: event.key || null, shift: event.shiftKey || false, trusted: event.isTrusted, target: event.target === window ? 'WINDOW' : event.target.tagName, id: event.target.id || '', activeTag: active?.tagName || null, activeId: active?.id || '', hasFocus: document.hasFocus()}); };
    for (const type of ['focusin', 'focusout']) document.addEventListener(type, record, true);
    for (const type of ['keydown', 'keyup']) document.addEventListener(type, event => { if (['Tab', 'Enter'].includes(event.key)) record(event); }, true);
    for (const type of ['focus', 'blur']) window.addEventListener(type, record);
  });
  await integrated.locator('#replay').focus(); const boundaryStart = await nativeFocusState(integrated);
  assert.ok(boundaryStart.inside && boundaryStart.hasFocus); assert.equal(boundaryStart.id, 'replay');
  const forwardFocus = await nativeFocusBoundary(integrated, 'Tab', 'modal-close', 'forward');
  const backwardFocus = await nativeFocusBoundary(integrated, 'Shift+Tab', 'replay', 'backward');
  const inertProbes = await integrated.evaluate(() => {
    const before = document.activeElement, modal = document.getElementById('modal');
    return ['pause', 'focus-action', 'settings'].map(id => {
      const target = document.getElementById(id); target.focus({preventScroll: true});
      return {requested: id, retained: document.activeElement === before, actual: document.activeElement.id, inside: modal.contains(document.activeElement), open: modal.open, modal: modal.matches(':modal'), hasFocus: document.hasFocus()};
    });
  });
  fs.writeFileSync(path.join(output, 'native-focus-background-probes.json'), JSON.stringify({scope: 'Programmatic focus probes, separate from real Tab boundary inputs', inertProbes}, null, 2));
  for (const probe of inertProbes) { assert.ok(probe.retained && probe.inside && probe.open && probe.modal && probe.hasFocus); assert.equal(probe.actual, 'replay'); }
  await integrated.keyboard.press('Shift+Tab'); const stayFocus = await nativeFocusState(integrated);
  assert.ok(stayFocus.inside && stayFocus.hasFocus && stayFocus.modal); assert.equal(stayFocus.id, 'keep-flame');
  const priorController = await integrated.evaluate(() => { window.__beforeKeyboardClose = window.__nativeMounts.at(-1).controller; return window.__nativeMounts.length; });
  await integrated.keyboard.press('Enter'); await integrated.locator('#modal').waitFor({state: 'hidden'});
  assert.deepEqual(await rawSources(integrated, Object.keys(integrationFixtures)), integrationFixtures);
  await openCompletion(integrated);
  assert.equal(await integrated.evaluate(() => window.__nativeMounts.length), priorController + 1);
  assert.equal(await integrated.evaluate(() => window.__nativeMounts.at(-1).controller !== window.__beforeKeyboardClose), true);
  assert.equal(await integrated.locator('[data-navigation-action="open-hearth"]').isEnabled(), true);
  assert.deepEqual(await rawSources(integrated, Object.keys(integrationFixtures)), integrationFixtures);
  nativeEvidence.push({case: 'native-keyboard-boundaries-inert-background-stay-and-reopen', setup: 'Programmatic Replay focus only before the first boundary; no focus resets during real Tab sequences', forwardFocus, backwardFocus, inertProbes, stayFocus, focusEvents: await integrated.evaluate(() => window.__nativeFocusEvents), keyboardStay: true, freshController: true});
  await integrated.screenshot({path: path.join(output, 'cave-native-route.png'), fullPage: true});
  await integrated.setViewportSize({width: 390, height: 844}); await integrated.locator('[data-navigation-action="open-hearth"]').scrollIntoViewIfNeeded(); await checkPresentation(integrated, 'cave-narrow');
  await integrated.screenshot({path: path.join(output, 'cave-narrow.png')}); await integrated.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  await integrated.locator('#campaign-navigation summary').focus(); await integrated.keyboard.press('Enter'); await checkPresentation(integrated, 'cave-narrow-200-percent-text');
  assert.ok(presentation.at(-1).fontSize >= presentation.find(item => item.label === 'cave-narrow').fontSize * 1.99);
  for (const target of await integrated.locator('[data-campaign-navigation] button, [data-campaign-navigation] summary').all()) {
    if (await target.isDisabled()) continue; await target.scrollIntoViewIfNeeded();
    assert.equal(await target.evaluate(node => { const r = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + Math.min(r.height / 2, 22))); }), true, 'Visible native actions remain reachable by vertical scrolling');
  }
  await integrated.screenshot({path: path.join(output, 'cave-narrow-large-text.png')}); assert.deepEqual(await rawSources(integrated, Object.keys(integrationFixtures)), integrationFixtures);
  await integrated.evaluate(() => { document.documentElement.style.fontSize = ''; }); await integrated.setViewportSize({width: 1440, height: 1100});
  const firstPosition = await nativePosition(integrated), migrated = await enterRTS(integrated);
  assert.deepEqual(migrated, new RTS.Camp(JSON.parse(integrationFixtures[KEYS.rts])).s);
  const preservedKeys = Object.keys(integrationFixtures).filter(key => key !== KEYS.rts);
  assert.deepEqual(await rawSources(integrated, preservedKeys), Object.fromEntries(preservedKeys.map(key => [key, integrationFixtures[key]])));
  for (const key of [KEYS.rtsBackup, KEYS.rtsBackupV3, KEYS.rtsBackupV4]) assert.equal((await rawSources(integrated, [key + '.1']))[key + '.1'], integrationFixtures[KEYS.rts]);
  await integrated.reload(); await integrated.locator('[data-unit="u0"]').waitFor(); assert.equal(await integrated.locator('#pause').innerText(), 'Resume'); assert.deepEqual(JSON.parse((await rawSources(integrated, [KEYS.rts]))[KEYS.rts]), migrated);
  await backToCave(integrated, firstPosition, 'native-route-back-after-migration');
  assert.equal(await nativeExport(integrated, 'export:rtsBackupV4', 'native-existing-v4-backup.json'), integrationFixtures[KEYS.rtsBackupV4]);
  for (const key of [KEYS.rtsBackup, KEYS.rtsBackupV3, KEYS.rtsBackupV4]) assert.equal(await nativeExport(integrated, 'export-backup:' + key + '.1', 'native-' + key + '.1.json'), integrationFixtures[KEYS.rts]);
  const importPosition = await nativePosition(integrated); await enterRTS(integrated);
  const v2 = new RTS.Camp().s; v2.version = 2; delete v2.storage;
  const importRaws = [' \n' + JSON.stringify(v2) + '\n', '\n\n' + JSON.stringify(v2) + ' '];
  for (const incoming of importRaws) await importRTS(integrated, incoming, 'projected-legacy-v2');
  for (const key of [KEYS.rtsImportBackupV3, KEYS.rtsImportBackupV4]) { assert.equal((await rawSources(integrated, [key]))[key], importRaws[0]); assert.equal((await rawSources(integrated, [key + '.1']))[key + '.1'], importRaws[1]); }
  await backToCave(integrated, importPosition, 'native-route-back-after-imports');
  for (const kind of ['rtsImportBackupV3', 'rtsImportBackupV4']) {
    assert.equal(await nativeExport(integrated, 'export:' + kind, 'native-' + kind + '.json'), importRaws[0]);
    assert.equal(await nativeExport(integrated, 'export-backup:' + KEYS[kind] + '.1', 'native-' + kind + '-1.json'), importRaws[1]);
  }
  const beforeReload = await rawSources(integrated, Object.values(KEYS)); await integrated.reload(); await integrated.locator('#event-action').waitFor(); assert.equal(await integrated.evaluate(() => window.__nativeMounts.length), 0); await openCompletion(integrated);
  assert.deepEqual(await rawSources(integrated, Object.values(KEYS)), beforeReload); await integration.context.close();
  reports.push('Native unmodified Cave build, focus trap and presentation; actual v1 migration and v2 imports into v4; real Back/reload and native exact backup exports');

  // Delayed inspection is a labeled lifecycle fault fixture. It does not replace
  // host options, controller methods or product markup, and awaits original ready.
  async function holdDigest(page) {
    await page.evaluate(() => {
      const original = crypto.subtle.digest; let first = true;
      window.__digestGate = {promises: [], restore: () => { crypto.subtle.digest = original; }};
      crypto.subtle.digest = function (...args) { const task = (async () => { if (first) { first = false; await new Promise(resolve => window.__digestGate.release = resolve); } return original.apply(this, args); })(); window.__digestGate.promises.push(task); return task; };
    });
  }
  async function releaseDigest(page) {
    await page.evaluate(async () => {
      const gate = window.__digestGate; gate.release(); let drained = 0;
      // Inspection hashes primary sources before starting its separate backup
      // batch. Drain newly appended work too; one Promise.all snapshot is stale.
      do { const batch = gate.promises.slice(drained); drained = gate.promises.length; await Promise.allSettled(batch); await new Promise(resolve => setTimeout(resolve, 0)); } while (drained < gate.promises.length);
      gate.restore();
    });
  }
  for (const action of ['close', 'stay', 'escape', 'replay', 'replacement']) {
    const fixture = await nativePage('pending-' + action, sources()), p = fixture.page; await holdDigest(p); await p.locator('#event-action').click();
    await p.waitForFunction(() => typeof window.__digestGate.release === 'function'); assert.equal(await p.evaluate(() => window.__nativeMounts.length), 1);
    await p.evaluate(() => { window.__oldSlot = document.getElementById('campaign-navigation'); window.__oldSlotHTML = window.__oldSlot.innerHTML; });
    let expectedCave = fixture.fixtures[KEYS.cave];
    if (action === 'close') await p.locator('#modal-close').click();
    if (action === 'stay') await p.locator('#keep-flame').click();
    if (action === 'escape') await p.keyboard.press('Escape');
    if (action === 'replay') await p.locator('#replay').click();
    if (action === 'replacement') {
      const sender = await fixture.context.newPage(); await sender.goto(origin + '/navigation-fixture.html'); expectedCave += ' ';
      await sender.evaluate(([key, raw]) => localStorage.setItem(key, raw), [KEYS.cave, expectedCave]); await p.locator('#reload-camp').waitFor(); await sender.close();
    } else await p.locator('#modal').waitFor({state: 'hidden'});
    const replacement = action === 'replacement' ? await p.locator('#modal-content').innerHTML() : null;
    await releaseDigest(p); assert.equal(await p.evaluate(() => window.__nativeMounts[0].ready), null, 'A disposed initial refresh cannot adopt a snapshot');
    assert.equal(await p.evaluate(() => window.__oldSlot.innerHTML), await p.evaluate(() => window.__oldSlotHTML)); assert.equal(p.url(), origin + '/index.html');
    if (replacement !== null) { assert.equal(await p.locator('#modal-content').innerHTML(), replacement); assert.equal(await p.locator('#modal').evaluate(node => node.open), true); }
    if (action === 'replay') {
      await p.locator('#pause').click(); const state = JSON.parse((await rawSources(p, [KEYS.cave]))[KEYS.cave]), original = JSON.parse(fixture.fixtures[KEYS.cave]);
      assert.equal(state.run.complete, false); assert.equal(state.run.event, 0); assert.equal(state.run.innovation, 0); assert.equal(state.everCompleted, true); assert.deepEqual(state.baseline, original.baseline); assert.deepEqual(state.records, original.records);
      assert.deepEqual(await rawSources(p, Object.keys(fixture.fixtures).filter(key => key !== KEYS.cave)), Object.fromEntries(Object.entries(fixture.fixtures).filter(([key]) => key !== KEYS.cave)));
      await p.reload(); await p.locator('#focus-action').waitFor(); assert.equal(await p.evaluate(() => window.__nativeMounts.length), 0); assert.equal(JSON.parse((await rawSources(p, [KEYS.cave]))[KEYS.cave]).run.complete, false);
    } else {
      assert.deepEqual(await rawSources(p, Object.keys(fixture.fixtures)), {...fixture.fixtures, [KEYS.cave]: expectedCave});
      if (action !== 'replacement') { await openCompletion(p); assert.equal(await p.evaluate(() => window.__nativeMounts.length), 2); assert.equal(await p.locator('[data-navigation-action="open-hearth"]').isEnabled(), true); }
    }
    nativeEvidence.push({case: 'delayed-native-initial-refresh-' + action, originalReady: null, fixture: 'controlled completed Cave and delayed SHA-256'}); await fixture.context.close();
  }

  // Synchronous control activation specifically exposes a queued old close event;
  // this is a lifecycle fault fixture, not a claim of trusted pointer input.
  { const f = await nativePage('queued-close', sources()), p = f.page; await openCompletion(p);
    await p.evaluate(() => {
      const modal = document.getElementById('modal'); window.__queuedCloseEvents = [];
      modal.addEventListener('close', event => window.__queuedCloseEvents.push({trusted: event.isTrusted, open: modal.open, mounts: window.__nativeMounts.length, rendered: !!document.querySelector('#campaign-navigation [data-navigation-status]')}));
      document.getElementById('keep-flame').click(); document.getElementById('event-action').click();
    });
    await p.waitForFunction(() => window.__queuedCloseEvents.some(event => event.trusted)); await readyNative(p);
    const closeEvents = await p.evaluate(() => window.__queuedCloseEvents); assert.equal(closeEvents.length, 1); assert.equal(closeEvents[0].open, true); assert.equal(closeEvents[0].mounts, 2);
    fs.writeFileSync(path.join(output, 'native-queued-close-event.json'), JSON.stringify(closeEvents, null, 2));
    assert.equal(await p.locator('#modal').evaluate(node => node.open), true); assert.equal(await p.evaluate(() => window.__nativeMounts.length), 2);
    await p.locator('[data-navigation-action="open-hearth"]').focus();
    await p.evaluate(key => { window.__afterCloseSnapshot = window.__nativeMounts[1].controller.snapshot; window.dispatchEvent(new StorageEvent('storage', {key})); }, KEYS.rts);
    await p.waitForFunction(() => window.__nativeMounts[1].controller.snapshot !== window.__afterCloseSnapshot && window.__nativeMounts[1].controller.snapshot?.sources.rts.status === 'validated-standalone');
    assert.equal(await p.evaluate(() => document.getElementById('modal').contains(document.activeElement) && document.activeElement.dataset.navigationAction === 'open-hearth'), true, 'The post-close refresh preserves focus inside the replacement modal');
    assert.equal(await nativeExport(p, 'export:rts', 'native-after-queued-close-original.json'), f.fixtures[KEYS.rts], 'A real native action must still work after the old close event and fresh storage inspection');
    assert.deepEqual(await rawSources(p, Object.keys(f.fixtures)), f.fixtures);
    nativeEvidence.push({case: 'synthetic-synchronous-stay-reopen', closeEvents, postEventRecognizedStorageRefresh: true, actualExport: true, pauseLimit: 'Completed Cave advance is inert; unchanged counters do not prove the host pause flag'}); await f.context.close(); }
  // Exercise the persisted branch even if this Chromium's actual Back reloads.
  { const f = await nativePage('synthetic-persisted', sources()), p = f.page; await holdDigest(p); await p.locator('#event-action').click(); await p.waitForFunction(() => typeof window.__digestGate.release === 'function');
    await p.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', {persisted: true}))); await releaseDigest(p);
    assert.equal(await p.evaluate(() => window.__nativeMounts[0].ready), null, 'pagehide must dispose the original pending refresh before any remount can hide a leak');
    assert.equal(await p.locator('#modal').evaluate(node => node.open), true); await p.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', {persisted: true})));
    await readyNative(p); assert.equal(await p.evaluate(() => window.__nativeMounts.length), 2); assert.equal(await p.locator('#modal').evaluate(node => node.open), true);
    assert.equal(await p.evaluate(() => window.__nativeMounts[0].controller.snapshot), null); assert.deepEqual(await rawSources(p, Object.keys(f.fixtures)), f.fixtures);
    await p.locator('#keep-flame').click(); await p.evaluate(() => { window.dispatchEvent(new PageTransitionEvent('pagehide', {persisted: true})); window.dispatchEvent(new PageTransitionEvent('pageshow', {persisted: true})); });
    assert.equal(await p.evaluate(() => window.__nativeMounts.length), 2, 'A closed completion modal cannot remount during pageshow');
    nativeEvidence.push({case: 'synthetic-persisted-events-open-and-closed', actualBFCache: false}); await f.context.close(); }
  { const f = await nativePage('pending-action-close', sources()), p = f.page; await openCompletion(p); await holdDigest(p);
    await p.locator('[data-navigation-action="open-hearth"]').click(); await p.waitForFunction(() => typeof window.__digestGate.release === 'function'); await p.locator('#modal-close').click(); await releaseDigest(p);
    assert.equal(p.url(), origin + '/index.html'); assert.equal(await p.locator('#modal').evaluate(node => node.open), false); assert.deepEqual(await rawSources(p, Object.keys(f.fixtures)), f.fixtures);
    await openCompletion(p); assert.equal(await p.evaluate(() => window.__nativeMounts.length), 2); assert.equal(await p.locator('[data-navigation-action="open-hearth"]').isEnabled(), true);
    nativeEvidence.push({case: 'native-action-close-before-delayed-inspection-finishes', callbackRaces: 'separate opt-in cases above await original activation promises'}); await f.context.close(); }
  reports.push('Native Close/Stay/Escape/Replay/storage-conflict replacement dispose delayed initial refresh; queued-close and labeled synthetic persisted lifecycle controls; actual Back mode recorded separately');

  // Self-contained compatibility fixtures; no browser-earned Cave or resource
  // progression is claimed. The negative residue is deliberately authored here.
  const currentCamp = new RTS.Camp(); currentCamp.tick(.1); const currentRaw = currentCamp.serialize();
  const recoveryCamp = new RTS.Camp(), recoveryUnit = recoveryCamp.s.units[0];
  Object.assign(recoveryUnit, {x: 5, y: 7, cargo: 2, resource: 'wood', phase: 'extract', order: {kind: 'gather', target: 'd0'}, next: null, path: [], work: 0});
  recoveryCamp.s.deposits[0].amount -= 2; recoveryCamp.reveal();
  const residue = {...structuredClone(recoveryCamp.s), version: 3}; residue.units[0].work = -5.551115123125783e-17;
  const residueRaw = ' \n' + JSON.stringify(residue) + '\n', repaired = RTS.repairWorkResidue(residue); assert.ok(repaired && RTS.valid(repaired)); assert.equal(repaired.version, 3);
  const onlyWork = structuredClone(residue); onlyWork.units[0].work = 0; assert.deepEqual(repaired, onlyWork); assert.deepEqual(new RTS.Camp(repaired).s, {...onlyWork, version: 4});
  const currentNegative = {...structuredClone(residue), version: 4}; assert.equal(RTS.repairWorkResidue(currentNegative), null);
  const postMigrationInvalid = new RTS.Camp().s; postMigrationInvalid.version = 2; delete postMigrationInvalid.storage; postMigrationInvalid.nextId = 2;
  postMigrationInvalid.buildings.push({id: 'b1', kind: 'workshop', x: 12, y: 14, done: false, work: 0, cost: {wood: 40, stone: 30}});
  assert.ok(RTS.valid(postMigrationInvalid)); assert.throws(() => new RTS.Camp(postMigrationInvalid), /compatible/);
  for (const [label, state] of [['current-v4-negative', currentNegative], ['unknown-v5', {...currentCamp.s, version: 5}], ['legacy-v2-post-migration-invalid', postMigrationInvalid]]) {
    const raw = ' \n' + JSON.stringify(state) + '\n', fixtures = {...sources(), [KEYS.rts]: raw}, f = await nativePage(label, fixtures), p = f.page; await openCompletion(p);
    assert.equal(await p.locator('[data-navigation-action="open-hearth"]').isDisabled(), true); assert.match(await p.locator('[data-navigation-status]').innerText(), /cannot be opened/);
    assert.equal(await nativeExport(p, 'export:rts', label + '-original.json'), raw); assert.deepEqual(await rawSources(p, Object.keys(fixtures)), fixtures);
    assert.equal((await rawSources(p, [KEYS.rtsBackupV4, KEYS.rtsWorkRoundoffBackup]))[KEYS.rtsBackupV4], null); assert.equal((await rawSources(p, [KEYS.rtsWorkRoundoffBackup]))[KEYS.rtsWorkRoundoffBackup], null);
    nativeEvidence.push({case: 'native-admission-' + label, routeAllowed: false, exactExport: true}); await f.context.close();
  }
  // Generate the two loaded checkpoints only through public engine commands and
  // ticks. These are compatibility fixtures, not additional UI gameplay evidence.
  const loadedCamp = new RTS.Camp(); assert.equal(loadedCamp.command(['u0'], {kind: 'gather', target: 'd0'}), 1);
  for (let step = 0; step < 600 && loadedCamp.s.units[0].cargo < 2; step++) loadedCamp.tick(.1);
  assert.equal(loadedCamp.s.units[0].cargo, 2); assert.equal(loadedCamp.s.units[0].resource, 'wood');
  assert.equal(loadedCamp.command(['u0'], {kind: 'move', x: 2, y: 3}), 1); loadedCamp.tick(.1);
  assert.equal(loadedCamp.s.units[0].phase, 'carryMove'); const movingRaw = loadedCamp.serialize();
  for (let step = 0; step < 600 && loadedCamp.s.units[0].phase !== 'idle'; step++) loadedCamp.tick(.1);
  assert.equal(loadedCamp.s.units[0].phase, 'idle'); assert.equal(loadedCamp.s.units[0].cargo, 2); assert.equal(loadedCamp.s.units[0].x, 2); assert.equal(loadedCamp.s.units[0].y, 3); const heldRaw = loadedCamp.serialize();
  for (const [label, raw] of [['current-v4-idle', currentRaw], ['current-v4-carry-move', movingRaw], ['current-v4-held', heldRaw]]) {
    const expected = JSON.parse(raw); assert.ok(RTS.valid(expected)); const fixtures = {...sources(), [KEYS.rts]: raw}, f = await nativePage(label, fixtures), p = f.page; await openCompletion(p);
    assert.equal(await p.locator('[data-navigation-action="open-hearth"]').isEnabled(), true); assert.equal(await nativeExport(p, 'export:rts', 'native-' + label + '-original.json'), raw); assert.deepEqual(await rawSources(p, Object.keys(fixtures)), fixtures);
    assert.deepEqual(await enterRTS(p), expected); assert.equal(await p.locator('#stop').isDisabled(), false);
    await p.reload(); await p.locator('[data-unit="u0"]').waitFor(); assert.equal(await p.locator('#pause').innerText(), 'Resume'); assert.equal(await p.locator('#stop').isDisabled(), false);
    assert.deepEqual(JSON.parse((await rawSources(p, [KEYS.rts]))[KEYS.rts]), expected);
    await p.locator('#journey').click(); const event = p.waitForEvent('download'); await p.locator('#export').click(); const download = await event, filename = path.join(output, 'destination-' + label + '-reloaded.json'); await download.saveAs(filename); assert.equal(fs.readFileSync(filename, 'utf8'), raw);
    const foreign = [KEYS.cave, KEYS.hearth, KEYS.hearthCompleted, KEYS.agriculture]; assert.deepEqual(await rawSources(p, foreign), Object.fromEntries(foreign.map(key => [key, fixtures[key]])));
    nativeEvidence.push({case: 'native-admission-' + label, routeAllowed: true, exactExport: true, exactPausedReload: true, fixture: 'public engine commands/ticks; controlled completed Cave compatibility source'}); await f.context.close();
  }
  { const fixtures = {...sources(), [KEYS.rts]: residueRaw, [KEYS.rtsBackupV4]: 'occupied before-v4', [KEYS.rtsWorkRoundoffBackup]: 'occupied before-work-roundoff'}, f = await nativePage('legacy-residue', fixtures), p = f.page;
    await openCompletion(p); assert.equal(await p.locator('[data-navigation-action="open-hearth"]').isEnabled(), true); assert.equal(await nativeExport(p, 'export:rts', 'native-legacy-residue-original.json'), residueRaw); assert.deepEqual(await rawSources(p, Object.keys(fixtures)), fixtures);
    const position = await nativePosition(p); assert.deepEqual(await enterRTS(p), new RTS.Camp(repaired).s);
    for (const key of [KEYS.rtsBackupV4, KEYS.rtsWorkRoundoffBackup]) { assert.equal((await rawSources(p, [key]))[key], fixtures[key]); assert.equal((await rawSources(p, [key + '.1']))[key + '.1'], residueRaw); }
    const residueImports = [residueRaw, '\n' + residueRaw + ' ']; for (const incoming of residueImports) await importRTS(p, incoming, 'controlled-legacy-v3-residue');
    await backToCave(p, position, 'native-back-after-legacy-residue-imports');
    for (const kind of ['rtsBackupV4', 'rtsWorkRoundoffBackup']) { assert.equal(await nativeExport(p, 'export:' + kind, 'native-' + kind + '-occupied.json'), fixtures[KEYS[kind]]); assert.equal(await nativeExport(p, 'export-backup:' + KEYS[kind] + '.1', 'native-' + kind + '-residue.json'), residueRaw); }
    for (const kind of ['rtsImportBackupV4', 'rtsImportWorkRoundoffBackup']) { assert.equal(await nativeExport(p, 'export:' + kind, 'native-' + kind + '-residue.json'), residueImports[0]); assert.equal(await nativeExport(p, 'export-backup:' + KEYS[kind] + '.1', 'native-' + kind + '-residue-1.json'), residueImports[1]); }
    const foreign = [KEYS.cave, KEYS.hearth, KEYS.hearthCompleted, KEYS.agriculture]; assert.deepEqual(await rawSources(p, foreign), Object.fromEntries(foreign.map(key => [key, fixtures[key]])));
    nativeEvidence.push({case: 'native-legacy-v3-residue-repair-and-import', fixture: 'controlled balanced gathered cargo, deliberately authored residue; not earned play', exactOriginalExports: true}); await f.context.close(); }
  reports.push('Native clone-only admission accepts current4 and explicit legacy3 recovery; rejects current4 negatives, unknown5 and legacy post-migration invalidity; destination alone adopts and retains exact v4/roundoff backup families');
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({baseCommit: Navigation.BASE_COMMIT, result: 'pass', checks: reports, nativeEvidence, presentation, pageErrors: errors, limits: ['Native integration uses the ordinary unmodified built Cave page; separate opt-in fixtures still test helper APIs', 'Completed-source and recovery compatibility fixtures, not earned-play/pacing/enjoyment evidence', 'Completed Cave advance is inert; unchanged completed-camp counters do not prove dialog pause', 'Synthetic persisted events are labeled separately from actual Back/BFCache observations', 'No durable campaign handoff, grant, branch or full-age completion implemented', 'Desktop headless Chromium only; native/accessibility-device support not claimed', '200% text is simulated by doubling the root font size; browser zoom and assistive devices are not tested']}, null, 2) + '\n');
  console.log('PASS campaign navigation browser:', reports.join('; '));
})().catch(async error => {
  const page = nativeDiagnosticPage;
  if (page && !page.isClosed()) await page.screenshot({path: path.join(output, 'native-failure.png'), fullPage: true}).catch(() => {});
  const observed = page && !page.isClosed() ? await page.evaluate(() => { const active = document.activeElement, modal = document.getElementById('modal'); return {url: location.href, body: document.body.innerText, lifecycle: window.__nativeLifecycle, closeEvents: window.__queuedCloseEvents, storageCalls: window.__nativeStorageObservation?.calls, mounts: window.__nativeMounts?.length, focus: {tag: active?.tagName || null, id: active?.id || '', outerHTML: active?.outerHTML.slice(0, 240) || null, inside: !!active && !!modal?.contains(active), open: modal?.open || false, modal: modal?.matches(':modal') || false, hasFocus: document.hasFocus()}, focusEvents: window.__nativeFocusEvents}; }).catch(() => null) : null;
  fs.writeFileSync(path.join(output, 'failure.json'), JSON.stringify({error: String(error), nativeEvidence, pageErrors: errors, observed}, null, 2)); console.error(error); process.exitCode = 1;
}).finally(async () => { if (browser) await browser.close(); server.close(); });
