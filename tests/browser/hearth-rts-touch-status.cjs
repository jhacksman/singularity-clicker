/* Spark only. Rendered P3 regression; public-command compatibility checkpoints,
 * emulated touch and a controlled clock are not physical-device/earned-play proof. */
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http'), crypto = require('node:crypto');
const {once} = require('node:events'), playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {Camp, KEY, valid} = require('../../src/hearth-rts/engine.js');
const root = path.resolve(__dirname, '../..'), output = path.join(root, 'artifacts/hearth-rts-touch-status');
const baseCommit = '82dc5ed120ff608cef977a33c77b6296185c3f4e', oldCSSHash = '022365f62483eaf6f0898c92682f28c0f9bd5c793ab1a6fa7bb45d74677d961c';
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const oldCSS = fs.readFileSync(path.join(root, 'tests/fixtures/hearth-rts-touch-status-before.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'dist/hearth-rts.html'), 'utf8'), styles = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)];
assert.equal(hash(oldCSS), oldCSSHash); assert.equal(styles.length, 1, 'The control replaces only the single assembled RTS stylesheet');
assert.equal(styles[0][1], fs.readFileSync(path.join(root, 'src/hearth-rts/styles.css'), 'utf8'), 'Run the current build before this browser gate');
assert.notEqual(hash(styles[0][1]), oldCSSHash, 'The candidate must include the separate P3 CSS correction');
const controlHTML = html.replace(styles[0][0], '<style>' + oldCSS + '</style>');
const withoutStyle = source => source.replace(/<style>[\s\S]*?<\/style>/, '<style>STYLE-ONLY-CONTROL</style>');
assert.equal(withoutStyle(controlHTML), withoutStyle(html), 'All markup and scripts must be identical in candidate/control');
fs.mkdirSync(output, {recursive: true});
const resources = ['wood', 'stone', 'food'], actor = (s, id) => s.units.find(u => u.id === id);
const loads = s => s.units.map(u => ({id: u.id, cargo: u.cargo, resource: u.resource}));
const conserved = s => Object.fromEntries(resources.map(r => [r, s.stock[r] + s.spent[r] + s.deposits.filter(d => d.kind === r).reduce((sum, d) => sum + d.amount, 0) + s.units.filter(u => u.resource === r).reduce((sum, u) => sum + u.cargo, 0)]));
function until(camp, predicate, label, bound = 12000) {
  for (let i = 0; i < bound && !predicate(camp.s); i++) camp.tick(.1);
  assert.ok(predicate(camp.s), 'Fixture did not reach ' + label); assert.ok(valid(camp.s));
}
function moveAndHold(camp, id, x, y) {
  assert.equal(camp.command([id], {kind: 'move', x, y}), 1);
  until(camp, s => actor(s, id).phase === 'idle', id + ' held at destination');
  assert.equal(actor(camp.s, id).x, x); assert.equal(actor(camp.s, id).y, y);
}
function gatherLoad(camp, id, target, amount, resource, x, y) {
  assert.equal(camp.command([id], {kind: 'gather', target}), 1);
  until(camp, s => actor(s, id).cargo >= amount, id + ' partial ' + resource);
  assert.equal(actor(camp.s, id).cargo, amount); assert.equal(actor(camp.s, id).resource, resource);
  moveAndHold(camp, id, x, y); assert.equal(actor(camp.s, id).cargo, amount);
}
// No resource, actor, order or position fields are authored into these saves.
// Engine commands can address unscouted deposits; these are compatibility inputs,
// not a claim that the resources were discovered through the browser UI.
const four = new Camp();
gatherLoad(four, 'u0', 'd0', 2, 'wood', 2, 3);
gatherLoad(four, 'u1', 'd2', 3, 'stone', 3, 3);
gatherLoad(four, 'u2', 'd3', 4, 'food', 4, 3); moveAndHold(four, 'u3', 5, 3);
const fourRaw = four.serialize(); assert.deepEqual(new Camp(JSON.parse(fourRaw)).s, four.s);
const eight = new Camp(JSON.parse(fourRaw));
assert.equal(eight.command(['u3'], {kind: 'gather', target: 'd3'}), 1);
until(eight, s => s.deposits.find(d => d.id === 'd3').amount === 0 && actor(s, 'u3').cargo === 0 && actor(s, 'u3').phase === 'idle', 'western food delivered');
assert.equal(eight.s.stock.food, 71);
assert.equal(eight.command(['u3'], {kind: 'gather', target: 'd7'}), 1);
until(eight, s => s.stock.food >= 100, 'recruitment food delivered');
assert.equal(eight.command(['u3'], {kind: 'idle'}), 1); assert.equal(actor(eight.s, 'u3').cargo, 0);
const recruitmentFood = eight.s.stock.food;
for (let i = 0; i < 4; i++) assert.equal(eight.train(), null);
assert.equal(eight.s.units.length, 8); assert.equal(eight.s.spent.food, 100); assert.equal(eight.s.stock.food, recruitmentFood - 100);
gatherLoad(eight, 'u7', 'd7', 4, 'food', 6, 3);
for (const id of ['u0', 'u1', 'u2']) assert.deepEqual(actor(eight.s, id), actor(four.s, id));
const eightRaw = eight.serialize(); assert.deepEqual(new Camp(JSON.parse(eightRaw)).s, eight.s);
fs.writeFileSync(path.join(output, 'four-held-public-commands.json'), fourRaw);
fs.writeFileSync(path.join(output, 'eight-held-public-commands.json'), eightRaw);
const report = {baseCommit, candidateHTML: hash(html), candidateCSS: hash(styles[0][1]), oldCSS: oldCSSHash, controlHTML: hash(controlHTML), identicalMarkupAndScripts: true, fixtures: {four: hash(fourRaw), eight: hash(eightRaw), provenance: 'Public Camp commands/ticks/train only; controlled compatibility fixtures, not browser-earned play'}, cases: [], limits: ['Desktop Chromium and emulated touch, not physical-device acceptance', 'Clock advances only by explicit runFor; moving capture has Pause control and physically advanced actor', '200% fixture enlarges measured roster name/status text only; not browser zoom or whole-page text resizing', 'Viewport screenshots and glyph geometry require independent artifact review; no claim of comprehension or full mobile UX']};
const server = http.createServer((request, response) => {
  if (new URL(request.url, 'http://localhost').pathname !== '/hearth-rts.html') { response.writeHead(404); response.end(); return; }
  response.setHeader('Content-Type', 'text/html;charset=utf-8'); response.end(html);
});
let browser, active;
(async () => {
  server.listen(0, '127.0.0.1'); await once(server, 'listening'); const url = 'http://127.0.0.1:' + server.address().port + '/hearth-rts.html';
  browser = await playwright.chromium.launch({headless: true, chromiumSandbox: true});
  async function open(label, raw, {control = false, desktop = false} = {}) {
    const viewport = desktop ? {width: 1440, height: 1100} : {width: 390, height: 844};
    const context = await browser.newContext({viewport, hasTouch: !desktop, isMobile: !desktop, recordVideo: {dir: path.join(output, 'videos'), size: viewport}});
    await context.addInitScript(({key, raw}) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, raw);
      window.__touchStatusEvents = [];
      for (const type of ['pointerdown', 'pointerup', 'click']) document.addEventListener(type, event => window.__touchStatusEvents.push({type, target: event.target.closest?.('[data-unit]')?.dataset.unit || event.target.closest?.('button')?.id || event.target.id, trusted: event.isTrusted, pointerType: event.pointerType || null}), true);
    }, {key: KEY, raw});
    if (control) await context.route('**/hearth-rts.html', route => route.fulfill({status: 200, contentType: 'text/html', body: controlHTML}));
    const page = await context.newPage(), errors = []; page.on('pageerror', error => errors.push(error.message));
    active = {label, page, context, errors};
    await page.clock.install({time: new Date('2026-01-01T00:00:00Z')}); await page.goto(url); await page.locator('[data-unit="u0"]').waitFor();
    assert.equal(await page.locator('#pause').innerText(), 'Resume');
    await page.clock.pauseAt(new Date('2026-01-01T01:00:00Z'));
    let sequence = 0;
    const press = selector => desktop ? page.locator(selector).click() : page.locator(selector).tap();
    async function exported(stage) {
      const scroll = await page.evaluate(() => ({x: scrollX, y: scrollY}));
      await press('#journey'); const event = page.waitForEvent('download'); await press('#export');
      const download = await event, filename = path.join(output, label + '-' + (++sequence) + '-' + stage + '.json'); await download.saveAs(filename);
      const raw = fs.readFileSync(filename, 'utf8'); assert.ok(valid(JSON.parse(raw)));
      await press('#close'); await page.evaluate(p => scrollTo(p.x, p.y), scroll); return raw;
    }
    async function placeCard(id, initial = false) {
      await page.evaluate(({id, initial}) => {
        const card = document.querySelector('[data-unit="' + id + '"]'), tray = document.getElementById('action-tray').getBoundingClientRect();
        if (initial) scrollTo(0, 0);
        else { const rect = card.getBoundingClientRect(), available = Math.min(innerHeight, tray.top); scrollTo(0, Math.max(0, scrollY + rect.top - Math.max(16, (available - rect.height) / 2))); }
      }, {id, initial});
    }
    async function select(id, initial = false) {
      await placeCard(id, initial); await press('[data-unit="' + id + '"]'); await placeCard(id, initial);
      assert.equal(await page.locator('[data-unit="' + id + '"]').getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('.unit-card[aria-pressed="true"]').count(), 1);
    }
    async function geometry(id) {
      return page.evaluate(id => {
        const card = document.querySelector('[data-unit="' + id + '"]'), tray = document.getElementById('action-tray'), issues = [];
        const rect = node => { const r = node.getBoundingClientRect(); return {x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom}; };
        const contains = (outer, inner) => inner.x >= outer.x - .75 && inner.y >= outer.y - .75 && inner.right <= outer.right + .75 && inner.bottom <= outer.bottom + .75;
        const intersects = (a, b) => Math.min(a.right, b.right) - Math.max(a.x, b.x) > .75 && Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y) > .75;
        const cardRect = rect(card), trayRect = rect(tray), viewport = {x: 0, y: 0, right: innerWidth, bottom: innerHeight};
        const texts = ['.unit-name', 'small'].map(selector => {
          const node = card.querySelector(selector), computed = getComputedStyle(node), glyphs = [], walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
          let text;
          while ((text = walker.nextNode())) for (let i = 0; i < text.textContent.length; i++) {
            if (!text.textContent[i].trim()) continue; const range = document.createRange(); range.setStart(text, i); range.setEnd(text, i + 1);
            const r = range.getBoundingClientRect(), glyph = {character: text.textContent[i], x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom}; glyphs.push(glyph);
            if (!r.width || !r.height || !contains(cardRect, glyph)) issues.push({kind: 'outside-card', selector, glyph});
            if (!contains(viewport, glyph)) issues.push({kind: 'outside-viewport', selector, glyph});
            if (intersects(trayRect, glyph)) issues.push({kind: 'tray-occlusion', selector, glyph});
            for (let ancestor = node; ancestor && ancestor !== document.body; ancestor = ancestor.parentElement) {
              const css = getComputedStyle(ancestor), bound = rect(ancestor);
              if (/(hidden|clip|auto|scroll)/.test(css.overflowX) && (glyph.x < bound.x - .75 || glyph.right > bound.right + .75)) issues.push({kind: 'horizontal-clipping', selector, glyph, ancestor: ancestor.className || ancestor.tagName});
              if (/(hidden|clip|auto|scroll)/.test(css.overflowY) && (glyph.y < bound.y - .75 || glyph.bottom > bound.bottom + .75)) issues.push({kind: 'vertical-clipping', selector, glyph, ancestor: ancestor.className || ancestor.tagName});
            }
            const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
            if (!card.contains(hit)) issues.push({kind: 'glyph-occluded', selector, glyph, hit: hit?.id || hit?.tagName});
          }
          return {selector, text: node.textContent, rect: rect(node), fontSize: parseFloat(computed.fontSize), lineHeight: computed.lineHeight, whiteSpace: computed.whiteSpace, overflowX: computed.overflowX, textOverflow: computed.textOverflow, scrollWidth: node.scrollWidth, clientWidth: node.clientWidth, glyphs};
        });
        const cards = [...document.querySelectorAll('.unit-card')].map(node => ({id: node.dataset.unit, rect: rect(node)}));
        for (const other of cards) if (other.id !== id && intersects(cardRect, other.rect)) issues.push({kind: 'card-overlap', other});
        const portrait = rect(card.querySelector('.portrait'));
        for (const text of texts) for (const glyph of text.glyphs) if (intersects(portrait, glyph)) issues.push({kind: 'portrait-overlap', selector: text.selector, glyph});
        if (document.documentElement.scrollWidth > innerWidth + 1) issues.push({kind: 'page-horizontal-overflow'});
        const controls = ['move', 'stop'].map(id => { const node = document.getElementById(id), r = rect(node), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return {id, rect: r, visible: contains(viewport, r), hit: node.contains(hit), disabled: node.disabled}; });
        for (const control of controls) if (!control.visible || !control.hit || control.disabled || control.rect.width < 44 || control.rect.height < 44) issues.push({kind: 'command-unreachable', control});
        return {id, viewport: {width: innerWidth, height: innerHeight}, scroll: {x: scrollX, y: scrollY}, card: cardRect, tray: trayRect, texts, cards, controls, issues};
      }, id);
    }
    async function capture(stage, id, {initial = false, expectClipping = false} = {}) {
      const before = await exported(stage + '-before-layout'), state = JSON.parse(before), u = actor(state, id), running = await page.locator('#pause').innerText() === 'Pause';
      assert.ok(u.cargo > 0); const status = u.phase === 'carryMove' ? running ? 'Moving' : 'Move planned' : u.phase === 'idle' ? 'Holding' : u.phase === 'return' ? running ? 'Returning' : 'Return planned' : null;
      assert.ok(status, 'Only truthful planned/moving/holding/returning states enter the oracle');
      assert.equal(await page.locator('[data-unit="' + id + '"] .unit-name').innerText(), u.name);
      assert.equal(await page.locator('[data-unit="' + id + '"] small').innerText(), status + ' · ' + u.cargo + ' ' + u.resource);
      await placeCard(id, initial); const measured = await geometry(id);
      const filename = label + '-' + stage; await page.screenshot({path: path.join(output, filename + '.png'), fullPage: false});
      fs.writeFileSync(path.join(output, filename + '-geometry.json'), JSON.stringify({state: {id, name: u.name, phase: u.phase, order: u.order, cargo: u.cargo, resource: u.resource, running}, ...measured}, null, 2));
      if (initial) assert.equal(measured.scroll.y, 0, 'The original selected-card issue is checked in the initial viewport');
      if (expectClipping) assert.ok(measured.issues.some(issue => issue.selector === 'small' && ['horizontal-clipping', 'outside-card'].includes(issue.kind)), 'Pinned old CSS must expose clipped selected status glyphs under the same oracle');
      else assert.deepEqual(measured.issues, [], label + '/' + stage + ' must visibly show the complete selected identity/state/load');
      assert.equal(await exported(stage + '-after-layout'), before, 'Layout/scroll/capture must preserve the exact live camp');
      report.cases.push({label, stage, expectedFailure: expectClipping, state: {id, name: u.name, phase: u.phase, cargo: u.cargo, resource: u.resource, running}, geometry: filename + '-geometry.json', image: filename + '.png', issues: measured.issues, fonts: measured.texts.map(text => ({selector: text.selector, size: text.fontSize}))});
      return {state, measured};
    }
    async function moveTo(x, y) {
      await press('#move'); assert.equal(await page.locator('#move').getAttribute('aria-pressed'), 'true');
      await page.locator('#world').scrollIntoViewIfNeeded();
      const point = await page.locator('#world').evaluate((canvas, target) => { const r = canvas.getBoundingClientRect(), scale = Number(canvas.dataset.cameraScale || 1); return {x: r.x + ((target.x + .5) * 32 * scale + Number(canvas.dataset.cameraX || 0)) / canvas.width * r.width, y: r.y + ((target.y + .5) * 32 * scale + Number(canvas.dataset.cameraY || 0)) / canvas.height * r.height}; }, {x, y});
      assert.equal(await page.evaluate(point => document.elementFromPoint(point.x, point.y)?.id, point), 'world', 'The real map touch must not hit the command tray');
      if (desktop) await page.mouse.click(point.x, point.y); else await page.touchscreen.tap(point.x, point.y);
    }
    async function scaleRoster() {
      const sizes = await page.locator('[data-unit="u0"]').evaluate(card => ({name: parseFloat(getComputedStyle(card.querySelector('.unit-name')).fontSize), status: parseFloat(getComputedStyle(card.querySelector('small')).fontSize)}));
      // Labeled text-only CSSOM fixture: no product markup or game state injected.
      await page.evaluate(sizes => { const sheet = document.styleSheets[0]; sheet.insertRule('#selection .unit-card .unit-name{font-size:' + sizes.name * 2 + 'px!important}', sheet.cssRules.length); sheet.insertRule('#selection .unit-card small{font-size:' + sizes.status * 2 + 'px!important}', sheet.cssRules.length); }, sizes);
      const changed = await page.locator('[data-unit="u0"]').evaluate(card => ({name: parseFloat(getComputedStyle(card.querySelector('.unit-name')).fontSize), status: parseFloat(getComputedStyle(card.querySelector('small')).fontSize)}));
      assert.equal(changed.name, sizes.name * 2); assert.equal(changed.status, sizes.status * 2); report.cases.push({label, stage: 'measured-roster-only-200-percent', before: sizes, after: changed});
    }
    async function close() {
      const events = await page.evaluate(() => window.__touchStatusEvents); fs.writeFileSync(path.join(output, label + '-events.json'), JSON.stringify(events, null, 2));
      assert.deepEqual(errors, []); await context.close(); active = null; return events;
    }
    assert.equal(await exported('boot'), raw, 'The seeded checkpoint must be adopted unchanged');
    return {page, context, press, exported, select, capture, moveTo, scaleRoster, close};
  }
  // Identical seed/selection/scroll/sizing and measurement function, old style only.
  { const f = await open('old-css-control', fourRaw, {control: true}); await f.select('u0', true); await f.capture('held-initial', 'u0', {initial: true, expectClipping: true}); await f.close(); }
  for (const mode of ['touch', 'touch-roster-200-percent']) {
    const f = await open(mode, fourRaw); await f.select('u0', true);
    assert.equal(await f.page.locator('.unit-card').count(), 4);
    if (mode === 'touch-roster-200-percent') await f.scaleRoster();
    await f.capture('held-initial', 'u0', {initial: true});
    for (const id of ['u1', 'u2']) { const before = await f.exported('before-select-' + id); await f.select(id); await f.capture('mixed-' + id, id); assert.equal(await f.exported('after-select-' + id), before); }
    await f.select('u0'); const before = JSON.parse(await f.exported('before-move'));
    await f.moveTo(13, 3); const planned = await f.capture('planned', 'u0');
    assert.equal(actor(planned.state, 'u0').phase, 'carryMove'); assert.deepEqual(actor(planned.state, 'u0').order, {kind: 'move', x: 13, y: 3});
    assert.deepEqual(loads(planned.state), loads(before)); assert.deepEqual(conserved(planned.state), conserved(before));
    await f.press('#pause'); assert.equal(await f.page.locator('#pause').innerText(), 'Pause'); await f.page.clock.runFor(300);
    const moving = await f.capture('moving', 'u0'); assert.equal(actor(moving.state, 'u0').phase, 'carryMove');
    assert.ok(moving.state.time > planned.state.time); assert.notDeepEqual([actor(moving.state, 'u0').x, actor(moving.state, 'u0').y], [actor(planned.state, 'u0').x, actor(planned.state, 'u0').y]);
    assert.deepEqual(loads(moving.state), loads(before));
    for (let i = 0; i < 40 && !(await f.page.locator('[data-unit="u0"] small').innerText()).startsWith('Holding'); i++) await f.page.clock.runFor(500);
    assert.match(await f.page.locator('[data-unit="u0"] small').innerText(), /^Holding/); await f.press('#pause');
    const held = await f.capture('held-after-move', 'u0'); assert.equal(actor(held.state, 'u0').x, 13); assert.equal(actor(held.state, 'u0').y, 3); assert.deepEqual(loads(held.state), loads(before));
    await f.press('#stop'); const returning = await f.capture('stop-and-return-planned', 'u0');
    assert.equal(actor(returning.state, 'u0').phase, 'return'); assert.deepEqual(loads(returning.state), loads(before)); assert.deepEqual(conserved(returning.state), conserved(before));
    for (const field of ['stock', 'spent', 'delivered', 'deposits']) assert.deepEqual(returning.state[field], before[field]);
    const events = await f.close();
    for (const target of ['u0', 'u1', 'u2', 'move', 'stop', 'world']) assert.ok(events.some(event => event.type === 'pointerdown' && event.trusted && event.pointerType === 'touch' && event.target === target), 'Real touch input must reach ' + target);
  }
  { const f = await open('touch-eight', eightRaw); assert.equal(await f.page.locator('.unit-card').count(), 8); await f.select('u7'); await f.capture('last-selected-with-scroll', 'u7');
    const before = await f.exported('before-selection'); await f.select('u1'); await f.capture('mixed-stone-with-scroll', 'u1'); assert.equal(await f.exported('after-selection'), before);
    const events = await f.close(); for (const target of ['u7', 'u1']) assert.ok(events.some(event => event.type === 'pointerdown' && event.trusted && event.pointerType === 'touch' && event.target === target)); }
  // The correction is mobile-only. Compare the same ordinary desktop held
  // surfaces under old/candidate style, rather than adding desktop gameplay scope.
  const desktopMeasurements = [];
  for (const control of [true, false]) {
    const f = await open(control ? 'desktop-old-css' : 'desktop', fourRaw, {control, desktop: true}), measured = [];
    for (const id of ['u0', 'u1', 'u2']) { await f.select(id); measured.push((await f.capture('held-' + id, id)).measured); }
    desktopMeasurements.push(measured); await f.close();
  }
  assert.deepEqual(desktopMeasurements[1], desktopMeasurements[0], 'Candidate CSS must preserve the same desktop roster, glyph, tray and control geometry');
  report.result = 'pass'; fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); console.log('PASS Hearth RTS selected touch status: old-CSS clipping control; actual four/eight roster, planned/moving/held, mixed loads, measured roster text enlargement, desktop and real Move/Stop controls');
})().catch(async error => {
  if (active && !active.page.isClosed()) {
    await active.page.screenshot({path: path.join(output, active.label + '-failure.png'), fullPage: false}).catch(() => {});
    report.failure = {label: active.label, error: String(error), pageErrors: active.errors, observed: await active.page.evaluate(() => ({body: document.body.innerText, scroll: {x: scrollX, y: scrollY}, events: window.__touchStatusEvents})).catch(() => null)};
  } else report.failure = {error: String(error)};
  fs.writeFileSync(path.join(output, 'failure.json'), JSON.stringify(report, null, 2)); console.error(error); process.exitCode = 1;
}).finally(async () => { if (browser) await browser.close(); server.close(); });
