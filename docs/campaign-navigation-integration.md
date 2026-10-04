# Navigation adapter — native integration and historical artifact guide

The current branch integrates the reviewed `444d252c09b205e1f431ee870d2e328f1803214c`
artifact into the actual Cave completion modal on host base
`4e391c2e2ebf255e1cf0fb5b57bed6d123b51558`. It bundles scoped styles and pure
validators, recognizes RTS v4 and its raw-retention families, and supplies the
destination's repair-plus-constructor admission check without adopting or writing
the clone in Cave. Modal replacement/close and pagehide dispose the controller;
persisted pageshow remounts an open completion panel. The original Stay/Replay
controls and completed-Cave facts remain. New assembled-source Spark verification
is required; the standalone artifact's pass does not establish this integration.

The remainder of this guide records the original opt-in package and its historical
integration seam. Those pending/new-files-only/v3 statements describe `444d252`,
not the current native integration. See `hearth-native-navigation-increment.txt`
for the current change, exact evidence and remaining limits.

This new-files-only package targets clean Hearth storage candidate `d3116663cebd336ace24b39a84c171634aae0e88`. The original `05d132c` base had a parser defect discovered by the upstream Spark020 job; this branch rebases onto the main worker's corrected source rather than copying or changing its files. It does not modify an existing game file, generated page, build entry, save key or active worker's module. Integration remains pending the main Hearth worker's acceptance. No push or main merge is part of this package.

## Implemented scope

`src/campaign-navigation/adapter.cjs` is a pure, asynchronous inspection/navigation policy usable in Node and as a classic browser script. `browser.js` exports an opt-in semantic panel. Neither writes storage, runs a simulation, creates a campaign root, moves a person, supplies a starter, awards Observation/mastery, claims a durable receipt, or commits a handoff. The shared command/save worker owns those authoritative operations.

The intended Cave route is `hearth-rts.html`. Cave entry requires its bundled validator and fire phase 4. A validated completed baseline also retains access during a Cave replay; `everCompleted` alone is insufficient. A separately enabled developer preview is labeled and grants nothing. Current RTS completion is an opening milestone only. Legacy Agriculture first surplus never unlocks a full age. Handoff is explicitly `unavailable`, with `committed:false` and no destination world, until a separate integrated root adapter exists; no `prepared` or `saved` status is fabricated here.

Supported standalone inspection rows are Cave payload v1 and RTS payload v1/v2/v3 under the same RTS `.v1` key, using validators supplied from the pinned source. Other legacy sources and backups are retained/inspectable; their presence is not playable-continuation certification. Unknown versions, invalid data, unavailable validators and unreadable storage remain distinct. A save bearing campaign/content identity metadata is not interpreted by this standalone adapter. These are legacy-format inspection rows, not the future release compatibility manifest.

The adapter hashes exact well-formed UTF-8 source text with SHA-256, without parsing and reserializing it for identity. Whitespace changes therefore produce a different identity. The completed-Hearth archive is an unversioned array of serialized strings, identified as one preserved archive container. Its entries are not executed, certified or adopted; a future authoritative importer may relate byte-identical entry sources. Different-looking or merely equivalent sources are never merged here. Existing engine validation is required for Cave/RTS eligibility and receives a clone. A changed/new root profile must use its own authoritative compatibility path, not trust these legacy hashes as transfer authority.

All known keys remain untouched, including `singularity-clicker.hearth.v1.completed`, `.hearth-rts.v1.before-v2`, `.before-v3`, `.import-before-v3`, and each backup's positive numbered suffixes. The pinned v3 game itself retains original raw bytes into unused numbered slots on migration/import. This helper reads/exports those slots and does not replace them. Unrelated localStorage values are neither read nor displayed; enumeration uses names only to select these exact backup namespaces. Well-formed exports are exact UTF-8; malformed UTF-16 is ineligible for identity and downloads as explicit `.utf16le` code-unit bytes rather than silently replacing surrogates. Export does not delete/adopt/import anything.

## Integration seam — main owner only

Load the existing **pure** `src/engine.js` and `src/hearth-rts/engine.js` validators alongside `adapter.cjs`, then `browser.js`, before mounting. Include `src/campaign-navigation/styles.css` in the same page. Its rules are scoped to the helper's `data-campaign-navigation` container and provide readable primary/secondary controls, at least 44 CSS-pixel targets, keyboard focus and wrapping; it uses the host's ink/panel/accent variables with standalone fallbacks. Do not mount an unstyled panel. Pure engine script loading starts no simulation. Do not load another page's view script. A future build may extract certified validator bundles, but must keep their compatibility identity explicit.

At the actual Cave completion modal, the **main owner** must align its next-age description with the available RTS opening: gathering finite supplies, building an eastern outpost and establishing a workshop. Remove the previous destination's promises of ember tending and cooking from that introduction. Preserve the completed-Cave result and existing Stay/Replay controls. Suitable introductory copy is: “Next: the Hearth opening. Gather finite supplies, build an eastern outpost, and establish a workshop. This is the opening preview of the next age.” The helper then explains the separate save and absence of people/supply transfer.

Replace the current Continue anchor with a dedicated section, then mount:

```js
const oldContinue = document.querySelector('#modal a[href="hearth.html"]');
const container = document.createElement('section');
oldContinue.replaceWith(container);
const navigation = SingularityNavigationBrowser.mount({container});
await navigation.ready;
```

This is an opt-in seam, not an edit already applied to `src/view.js` or `build.mjs`. The browser fixture substitutes the slot and adjoining description in the real built Cave completion modal and follows the actual RTS URL. Installation must also dispose the old controller when the modal is replaced/closed; otherwise its storage listener persists. Mounting again in the same container disposes the previous controller automatically. `navigation.dispose()` removes listeners and prevents late refreshes from navigating. The helper never auto-mounts or observes arbitrary anchors. The main owner also retains the complete modal's focus trap, close/Stay/Replay behavior and geometry; helper styling does not alter them.

The browser presentation uses ordinary names and explanations while preserving the policy snapshot's precise values. Recovery details keep exact save keys and versions inside the optional Saved games and backups section. Download filenames and original bytes are unchanged. A focused navigation action becoming unavailable moves focus to its explanation, which remains stable through later refreshes; inspection failure offers a focused retry if focus was already inside the helper. Background refreshes must not steal external focus.

Default reads use localStorage. A native/other storage host must supply `readSource(key)` and `listSourceKeys()` for **the same profile**, plus its ordinary navigation/export adapters. Supplying only one storage read method with a different enumeration source is unsupported integration. `navigate(target, intent)` receives a constant relative target and a read-only **navigation-only** description. Treating that description as a saved handoff would violate this interface. Navigation is an explicit user action; a fresh read occurs before it, duplicate overlapping activations are suppressed, and stale asynchronous refreshes are rejected. This remains a read-only view over standalone keys, not an atomic cross-key transaction or writer lease.

The shared root/save implementation must later supply genuine lineage/branch/world/proof IDs and atomically preserve source, consume grant, create destination and link actors before full campaign entry is enabled. Full Hearth proof, live/dormant producer selection, read-only preserved visits, isolated replay and checkpoint branches are not implemented by this package. Do not expose current standalone pages as those campaign modes. Ordinary existing legacy URLs remain available outside this helper; the adapter does not change or delete those pages.

## Verification and ownership

New files owned here: the two navigation modules and scoped stylesheet, `tests/campaign-navigation.test.cjs`, `tests/browser/campaign-navigation.cjs`, this document and the unique review/evidence ledger. Existing game files, `build.mjs`, `package.json`, old test runners, generated output and the shared root/save harness remain owned by their current workers. The branch was advanced to the clean worker commit above; no dirty storage tree was copied.

Spark-only command:

```sh
node scripts/check-syntax.cjs && node --test tests/*.test.cjs && node build.mjs && node tests/browser/campaign-navigation.cjs
```

Use the existing reviewed ARM64 browser image, network `none`, `chromiumSandbox:true`, CPU 2 / 4 GiB, via the shared coordinator queue. No dependencies, installs, credentials, hardware, outbound network or Git metadata are needed. Unit tests use built-in Node modules and existing pure engines. The new browser runner uses the image's exact Playwright package, a loopback server, actual artifact controls/downloads, and the real compiled Cave/RTS pages. It writes screenshots, one integration video and a structured report under `artifacts/campaign-navigation/`.

Completion fixtures are deliberately labeled compatibility fixtures. They do not establish earned play, human pacing/fun, the rest of Hearth, full Agriculture, campaign durability or native support. The immutable Spark source/command/result and independent review ledger determine which assertions have actually passed; authoring these tests is not a pass.

Specification references: approved v3 manifest `1a1d987bd4efefdeb4b5f6a9356784ad9973dc726e6ec3e6943e87498f1ebbbc`; Campaign §§1–2; Technical §§3–5; L00-A/D/G, L01-O/P, L02-A/E; own gap backlog G01–G03/G14 and B00/B02/B10. This artifact addresses navigation and preservation boundaries only, not completion of those entire acceptance cases.
