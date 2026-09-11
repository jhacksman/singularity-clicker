# Singularity Clicker

An incremental journey through human development, with a different style of play in each age. Browser first; macOS and iOS are intended release platforms.

## Play and build

No third-party runtime dependencies or external assets. Requires Node.js 22 or later to build and test.

```sh
npm run build
npm test
npm start
```

Open `http://127.0.0.1:8080` for The Cave, or `/hearth.html` for The Hearth. The generated HTML files can also be opened directly. Each page contains its scripts, styles, and artwork; no server is needed for the simulation.

- **Stage 0 — The Cave:** resource gathering, tools, communication, automation, traditions, and the first fire encounter.
- **Stage 1 — The Hearth:** playable first implementation of an isometric settlement and migration game. Assign villagers, build outlines, manage supplies, explore 61 persistent hexes, learn practices, establish gathering routes, manage animals, and complete the first plowing.
- **Stage 2 onward:** planned, not implemented. The ending honestly indicates this.

Stage 1's two-hour target is a design goal, not a measured playtest result. Its economy, tutorial, touch ergonomics, and minigames need further playtesting. Native apps have not yet been packaged or tested.

## Controls

The Hearth supports group selection and right-click assignment, dragging villagers onto work, and touch-friendly villager selection followed by tapping a target. Job buttons provide a larger alternative to small landscape targets. Space pauses, M toggles the map, scroll/pinch zooms, and Alt-drag pans the camp. Build outlines, then assign builders. Drag fences to place sections. The hearth is fueled automatically.

No enemies, combat, starvation, or villager deaths. Food and water shortages suspend demanding work; continued shortages prompt safe migration. Basic recovery gathering remains possible. Workers finish full gather/haul/deposit routines without repeated clicking. Pausing, hidden tabs, and closing the app stop the simulation.

## Source organization

- `src/engine.js`, `src/view.js`, `src/styles.css`, `src/shell.html`: existing Stage 0 implementation.
- `src/hearth/engine.js`: deterministic, platform-independent Stage 1 rules and save schema.
- `src/hearth/view.js`: Canvas 2D rendering, pointer controls, UI, and platform adapter.
- `src/hearth/styles.css`, `src/hearth/shell.html`: responsive browser interface.
- `assets/`: directly authored editable SVG drawings for Stage 0. Stage 1 draws directly with Canvas 2D.
- `docs/stage-1-design.md`: design baseline and decisions.
- `docs/platforms.md`: browser/macOS/iOS architecture and remaining native work.
- `tests/`: simulation and save-integrity tests.

All game art is authored directly. Do not introduce image-generator assets.

## Saves and native reuse

Stage 0 keeps `singularity-clicker.cave.v1`; Stage 1 uses `singularity-clicker.hearth.v1`. Opening Stage 1 does not alter Stage 0's save. Stage 1's optional completion prestige archives the finished world before resetting, with up to five inherited traditions. Import requires confirmation. Export/import supports manual transfer between devices; there is no account or cloud synchronization.

`Hearth` accepts serializable state and advances only through explicit `tick(seconds)` calls. Native hosts can provide `window.SingularityPlatform` with asynchronous `load(key)`, `save(key, text)`, and `download(name, text)` methods. The browser adapter uses device-local storage and JSON downloads. A native file/share bridge, application lifecycle wiring, and actual Apple builds remain future work.

## Project website and repository

Public repository: https://github.com/jhacksman/singularity-clicker

Project website: https://jhacksman.github.io/singularity-clicker/

The Jekyll site lives in `website/`. The workflow in `.github/workflows/pages.yml` tests and builds the game, builds Jekyll, and publishes both together on pushes to `main`. The Cave is served at `/play/`; The Hearth is served at `/play/hearth.html`.

Public-source exports exclude private hosting metadata and Git history. No open-source license has been selected by the owner. Making source public does not itself grant a software license.
