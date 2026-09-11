# Platforms and delivery

## Approved direction — 9 September 2026

Every stage must support browser, macOS, and iOS. Browser is the first delivery platform. The public repository should be `jhacksman/singularity-clicker`.

The user's “make it so” is treated as acceptance of the six recommended design defaults: automatic time with pause and a single-step option; optional post-completion prestige with the completed world preserved; fertile-region discovery advantageous but not mandatory; newcomers joining well-supported camps; safe work suspension and eventual migration on supply shortages; and authored geography for the first map.

## Current architecture

The shipped browser game is dependency-free JavaScript, HTML, CSS, SVG, and Canvas 2D. No network requests, server processes, account, or platform-specific API are required by the simulation. Stage 0 remains intact, and Stage 1 is a separate browser entrypoint.

Stage 1 separates:

1. Serializable deterministic game state and resource rules (`Hearth`).
2. Input commands such as assignment, planning, learning, routing, and migration.
3. Canvas rendering and responsive interface.
4. Storage and download adapter (`SingularityPlatform`).

Mouse and touch must produce the same game commands. Right-click is a convenience, never the sole way to perform essential work. There is a tap/job-button alternative to dragging. Large interface controls supplement small world objects. Keyboard support remains useful for desktop.

The same simulation should be reused by macOS and iOS hosts. Canvas is suitable for the current stages, while future 3D stages may use a different renderer behind the same campaign/save interface. This is not a promise that every future stage fits the current renderer.

## Native packaging, not yet implemented

Choose and validate an Apple-host approach when native work begins: a web-view container using the existing browser surface is the lowest-rewrite starting point. Do not claim native support solely because a responsive page exists.

Native delivery requires application projects, bundle identifiers, icons, signing, sandbox entitlements, local storage/file export/share bridges, foreground/background lifecycle handling, offline resource bundling, safe-area and orientation behavior, accessibility validation, device profiling, and macOS/iOS builds on Apple tooling. No native binaries or App Store submissions are part of the current delivery.

The adapter interface is:

```js
window.SingularityPlatform = {
  async load(key) { /* return a saved JSON string or null */ },
  async save(key, text) { /* durably store the string */ },
  async download(name, text) { /* export through a file picker/share sheet */ }
};
```

Do not tie simulation speed to animation frame rate. Do not simulate unattended supply depletion when backgrounded. Validate imported saves before replacing the active journey.

## Known first-build limitations

- Two-hour pacing has not been established through human playtesting.
- Browser UI and touch interactions have not undergone a browser/device QA session in this delivery.
- macOS and iOS packaging has not been performed.
- The minigames currently share a simple timing interaction; distinct hunting, plant-identification, and knapping activities need further design/art work.
- Woodland regeneration and periodic field growth are modeled, but there is no full seasonal ecology, crop diversity, or detailed waste/sanitation simulation yet.
- Construction uses material reservation at the worksite and visible completion; individual trips carrying construction ingredients are abstracted.
- Fences occupy grid cells. Gates remain passable; repairs restore condition before fences disappear. Stone walls have no maintenance decay.
- Roads are built as a local project and reduce travel cost; terrain-wide road drawing is not implemented.
- Resident groups, recurring adjacent gathering parties, and emergency returns work; multi-hop logistics and configurable stock thresholds are not implemented.
- Buildings can be dismantled and reconstructed, and outlines moved. A separate portable-building carry animation is not implemented.
- The hidden fertile region obeys elevation visibility. A subtle northeast-migration observation is included; dynamic herd movement between hexes is not yet simulated.
- Stage 1 is directly accessible for development; Stage 0 completion is not enforced as a gate. No Stage 0 bonus conversion has been introduced without a defined rule.

These are explicit development boundaries, not revisions to the longer-term design.
