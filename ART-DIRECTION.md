# Level 2–3 art direction · 9 October 2026

Implemented locally from the accepted M6 source at `f582cc6a906f95aabeb5d92da6bb944e3a1e6593` (`codex/hearth-cultivation-guidance`). The original checkout and NAS are untouched. This branch is `codex/level-2-3-art-overhaul`.

Player levels 2 and 3 correspond to zero-based stage 1 (Hearth) and stage 2 (Agriculture). The current accepted local cultivation continuation is also covered, along with its RTS opening. The 14-stage plan in `docs/campaign-readiness.txt` is preserved. Agriculture remains its existing first-surplus slice; writing, exchange, copper and Bronze are not newly implemented.

The 28 supplied screenshots were inspected as a contact sheet, with selected full-resolution inspections of camp, farming village, resource medallions, waterside settlement, writing and sunset. References informed original code drawings; no reference pixels were embedded or traced. No historical identification is claimed for the writing image.

## Implemented

- Shared original Canvas drawing vocabulary: rounded trees, bushes, rocks, purple/gold tents, cyan walls and golden roofs, clay jars, stacked logs, grain, people and sheep. All artwork stays embedded in the standalone builds.
- Raised isometric Hearth ground, winding paths, cyan water, brighter settlements and new map palette. Existing mature/protected tree, herd, buildings, cargo, field and plowing state remain authoritative.
- Rebuilt Agriculture landscape: six selectable crop beds, settlement housing, storage jars, assigned workers, crop maturation, construction scaffolds, granary and irrigation. The first-surplus milestone brings the sand/peach/terracotta palette into the landscape.
- Consistent cream surfaces, purple selection states, rounded resource badges with authored SVG icons, readable shortages, preserved control labels and visible keyboard focus.
- RTS/cultivation rendering preserves the grid and camera coordinate system, fog visibility, resource depletion, construction supply/progress, carried cargo, selected routes and paid crop states.
- A synchronous map redraw on switching modes prevents the first click from racing the next animation frame.

The engines, resource costs, rates, caps, population, gates, save schemas, storage keys and campaign documents are unchanged. The only nonvisual production change is the map redraw synchronization and an optional `PORT` environment variable for the existing loopback development server.

## Play

Using an existing Node 22+ runtime, run `node build.mjs`, then `PORT=18765 node scripts/serve.cjs`. Open `http://127.0.0.1:18765/hearth.html`, `/agriculture.html`, `/hearth-rts.html` or `/hearth-cultivation.html`. Use a dedicated browser profile for review to keep personal save slots isolated. No dependency installation is required. Cultivation uses Web Locks and should be served on localhost (or another secure origin).

Source artwork is in `src/settlement-art/`. Page views supply actual game state to the shared painter. The existing engines remain independent of presentation.

## Evidence

See the sibling `evidence/` directory and final review package for before/after PNGs, exact earned saves, build and test logs, and a validation report. Review fixtures were earned through ordinary controls; loading those copies in disposable browser contexts is only for comparing rendering. Automated simulated time is not a human pacing or enjoyment test. Optional video was disabled because its codec runtime is absent; no software was installed.

The tracked `dist/` files in the accepted source were stale. Rebuilding refreshes those files; the generated Cave page is byte-identical to the preserved baseline build, despite its tracked-file diff. The final mobile composition reserves more room below captions. Restored Agriculture milestones now show their saved status immediately.

The independent review follow-up restores worker job/rest cues, gives resident
counts contrasting map badges, aligns field-badge input with the painted bounds,
and wraps the cultivation header before it overflows. See [REVIEW-FIXES.md](REVIEW-FIXES.md)
for the four fixes and targeted browser evidence.
