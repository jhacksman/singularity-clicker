# Integrated persistence static closure

**Verdict: P-01/P-02/P-03 and the repeated-invalid-import test race are closed by the inspected source. No new persistence-source blocker was found. An immutable final commit and actual Spark results remain required before runtime closure.**

This review covers the persistence portions of the integrated working-tree view, the previously reviewed extraction clamp and explicit repair helper, and the associated roundtrip/bootstrap/recovery tests. It excludes the simultaneous broader pointer, touch, camera, Move, and key-control changes, which have a separate reviewer. No application runtime, parser, test, lint, build, or browser was executed on M6. No implementation was edited.

## Startup, validation, and original bytes

`view.js:11–22` now reads the current key once into `originalRaw` and records successful completion separately. Only `originalRaw === null` starts a new camp. Every present string, including zero bytes, passes through JSON parsing and a non-null, non-array object gate before construction. Falsy parsed primitives therefore cannot exploit the constructor's intentional empty-state fallback.

The catch uses the already captured value rather than re-reading storage. If the first read failed, it marks the original unreadable, builds a display fallback, pauses, and blocks writes/commands. The rest of initialization can attach handlers and render recovery information. If parsing, validation, migration, or a backup write failed after a successful read, the exact captured original remains available as `rejected`.

`ui()` at line 224 disables Export when original bytes were unreadable. Journey at line 244 gives the read-access warning, and the export handler at line 245 also independently guards unreadable state. For captured rejected input, `rejected !== null` preserves a zero-byte value instead of falling through to a new camp. The final startup message distinguishes unreadable storage, rejected captured bytes, recovered valid state, and ordinary loaded state.

## Explicit rounding repair and write ordering

The engine's strict validator remains unchanged. The extraction branch clamps only a successfully consumed extraction interval's residual; the explicit `repairWorkResidue()` helper clones eligible old states, limits the negative value and gathered-cargo conditions, and validates the complete candidate. Constructor repair is not implicit.

At startup, the view constructs `new Camp(repaired || state)` before doing any backup writes. Thus legacy migration and final current-schema validation must also succeed. For a repaired state it retains the exact source string under `.before-work-roundoff`, and any applicable legacy raw backups, before adopting the incoming game. Failure leaves the original main value untouched and the captured raw exportable. If the subsequent initial main write fails, the repaired valid camp can be exported while the original main bytes and already-retained raw backup survive; the existing `Saving stopped` message remains truthful.

At import, parsing, explicit repair, and full construction also precede confirmation and all writes. After confirmation, `.import-before-work-roundoff` and applicable legacy raw retention happen before the main write. Only after a successful main write does the code replace the live game, clear rejected/unreadable state, clear inspection/selection, and remain paused. A validation rejection, cancelled confirmation, backup failure, or main-write failure does not adopt the incoming camp. A failed import from an unreadable original retains that condition and gives the corresponding recovery message. The collision-safe `retainRaw()` behavior remains in place.

These source paths preserve the intended distinction between an invalid file and an explicit compatible-camp replacement. No compatibility requirement for null-to-reset imports was identified.

## Test closure

The confirmed stale-status oracle race is corrected. Each falsy-import iteration now opens Journey, asserts that its status does not already contain the rejection text, submits one file, waits for the new rejection, checks the old saved bytes, and closes the dialog. That wait can no longer succeed on the previous iteration's message. The no-confirmation assertion now follows completed rejection of every supplied case.

The old-subtraction negative control, ordinary earned seed, bounded per-tick sampling, exact carried-state reload, strict core round-trips, explicit repair immutability, and boot/import backup/main fault expectations remain as reviewed in `roundoff-browser-static-review.md`. The bootstrap expectations match the integrated code's actual memory/disk behavior, including repaired memory plus original disk on a failed initial main write.

The retained recovery fixture adds an `elementFromPoint` assertion requiring its original visible click to hit the canvas. It does not move the target, enlarge the viewport, or pre-focus the canvas. This strengthens the old/fixed focus control's precondition and will fail visibly if the new command tray covers that point.

The diagnostic and coverage limits from the earlier test review remain: early bootstrap waits can fail before exporting detailed failure diagnostics; read-denial cases are controlled faults rather than proof of every browser-policy configuration; the old-subtraction browser control demonstrates generation and validator rejection while keeping the new recovery path; and detailed unreadable-state transitions on cancelled/failed imports are established statically rather than each receiving a dedicated new browser fixture. None invalidates the reviewed positive/negative oracles, but none should be overstated as runtime evidence before Spark.

## Source identity and next gate

SHA-256 values observed for this working-tree review:

```text
src/hearth-rts/engine.js                  3b22d81b32f01f44fc033c488e68a91c027889780f82db380ea899f837f20be4
src/hearth-rts/view.js                    6393d773e1790dc40abea869fbbdba46a6a2ee8a3764825d552a460bdf12dd65
tests/hearth-rts.test.cjs                 d4ba3b345c1c60b7039b82a596de2df571b0953adac01325eb0555d68ed17f95
tests/browser/hearth-rts-roundtrip.cjs    320a22ca7bb4930d6318536d89392ed17c631eee235651300903c6d3225f66f9
tests/browser/hearth-rts-bootstrap.cjs    ed229b7086c1d9a0be85087fc0ccf8e87cbdb3d93f59129cb015e1eff25fe8ca
tests/browser/hearth-rts-recovery.cjs     e74a0f0e99a18184a3b564ca8399a6a09785cb954f6352b630ac0a1b575d6191
```

This is source closure at the recorded content, not an assertion that an uncommitted candidate passed syntax or execution. Final verification should identify the immutable commit and inspect Spark's syntax/unit/build/browser logs and the new roundtrip/bootstrap artifacts before any release claim.
