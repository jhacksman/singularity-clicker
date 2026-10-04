# Fresh independent IC02 Move skeptic

2026-10-04. Third fresh skeptical design review, before implementation. The only file authored by this reviewer is this report. Read-only Git inspection confirmed `hearth-rts-ic02` HEAD `3b15d6081f5396fcc579140c09d86e532674e2dd` and a clean application worktree. No application/runtime execution, parser, tests, builds, lint, browser, network, downloads, publication or app edits occurred on M6. Findings below are static reasoning; none is a locally reproduced runtime bug.

Reviewed `transition-plan.txt`, `engine-transition-proposal.txt`, `custody-review.txt`, `ui-navigation-plan.txt`, `critic-plan.md`; the actual RTS engine, view, core/storage tests and browser roundtrip/bootstrap/recovery tests; and frozen `singularity-all14-spec-v3/COMMAND-CONTRACT.md` §1 and IC02. No other fresh skeptic's report was used. Scope is immediate loaded Move, held arrival, typed custody, selected pending-share release and physical Stop return. Work-switch caches, capacity, general Hold/Resume, automation generations, complete IC02 and later navigation closure remain outside this verdict.

## Verdict and disagreements

I could not establish a new High conservation failure in the proposed transition. The dedicated v4 `carryMove` design is coherent if implemented as specified. This is a design assessment, not a passing source or runtime review.

- **IC02-P1 survives the disproof attempt, with a narrower status after root's correction.** The current negative control inherits the current engine's version, so changing the engine to v4 makes its checkpoint v4. Strict legacy-only recovery must reject it. The critic correctly identifies a test/evidence coupling. It is not an existing production failure and, after root explicitly selected separate legacy fixtures and v4 generation proof, it is no longer an unresolved design choice. The implementation and new evidence remain required.
- **IC02-P2 is resolved at design stage.** Root's choice to preserve `u.work` through Move/hold is consistent with a movement-only phase. Resetting at a subsequent ordinary work start preserves the current semantics and cannot bank this remainder into a different extraction task. The custody proposal's reset sentence is superseded. This is not a material-conservation defect.
- **The critic's command, build and receipt hazards are credible implementation traps, not additional reproduced findings.** The proposals already prescribe the necessary guards. Counting them again as unresolved production defects would overstate the review.
- **One additional route-validation gap was identified and resolved in the design discussion below.** It needs a concrete rejection test. It does not justify a broader pathfinder rewrite or a High label.

## Disproof of the residue-fixture concern

I tried the strongest alternatives: the imported seed might retain a legacy version; the recovery helper might normalize versions; or the old-subtraction patch might preserve the old engine as a whole. None matches the current code.

`tests/browser/hearth-rts-roundtrip.cjs:6-9` reads the current built HTML and replaces exactly one subtraction expression. Its page uses that engine's constructor, whose current assignment is `this.s.version=3` (`engine.js:64`) and is proposed to become 4. The exported checkpoint at browser lines 38-43 therefore follows the new schema. `tests/browser/hearth-rts-bootstrap.cjs:6-7` consumes that checkpoint directly and requires `repairWorkResidue` to succeed. `tests/hearth-rts.test.cjs:62-84` has the same current-source coupling. The helper's actual admission is explicitly `[1,2,3]` (`engine.js:52`), independently of constructor migration.

Bootstrap lines 58-59 and import line 70 also compare durable adopted state directly with the repair result. A repaired v3 object remains v3 until `new Camp` migrates it, so those comparisons need a separately expected v4 adoption state. Merely relabelling the browser artifact v3 without declaring that projection would obscure its provenance.

Required evidence: retain an immutable/generated legacy-v3 fixture or explicitly label a schema projection; preserve its original bytes; assert the normal migration separately, including storage, cargo, obligations and paid work. Keep a v4 negative-work control that is rejected by both strict construction and explicit repair. Do not globally replace all test references to future version 4 with 5: the v4 negative-work rejection remains meaningful even after v4 becomes a supported positive schema.

## Counterexamples against custody and command safety

| Attempted counterexample | Source-based result and remaining proof |
| --- | --- |
| Manual Move cancels a loaded transfer job and reclassifies wood as gathered production. | `releaseTransfer` only touches positive pending shares (`engine.js:129`); loaded actors are required to have zero pending (`:47`). `pruneTransfers` retains a job referenced by `u.transfer` (`:131`). Keeping that marker, type and amount defeats this counterexample. Verify the marker through arrival and Stop receipt; merely checking total stock is insufficient. |
| Moving one worker releases the whole multi-worker transfer, including its peer's stock. | Release indexes `j.pending[u.id]`, and the amount partition includes marked cargo separately (`:41-44`, `:129`). For a valid state it releases only that worker's unpicked share. Test both 5+1 assignments and one picked-up/one pending actor. A gathered wood load with a queued stone transfer is the strongest type distinction: the stone reservation releases while wood stays gathered cargo. |
| Holding at the original receiving store deposits through adjacency alone. | `receive` is called only by return/transfer phase in the current tick dispatcher (`:198`), not by ordinary idle. The dedicated carryMove arrival branch must preserve that separation. Store adjacency by itself does not authorize receipt. Wait many ticks beside a store, reload, then Stop; only the subsequent physical receipt may credit the proper counter. |
| Repeated Send silently takes a manually held carrier back. | Current `quoteTransfer` recognizes the existing job, and `transfer` returns its ID before issuing `command` (`:106`, `:110`, `:124`). Thus the proposed unchanged behavior cannot resume the carrier or debit another load. The actual problem is UI truthfulness: existing feedback says assigned although the state was unchanged. Check both state and text. |
| Sequential UI formation commands necessarily permit partial mutation after preflight. | Current `accepts`/`path` read terrain, not mutable reservations or peer paths (`:145-147`, `:165-171`). Move has one exact target; `route`'s free-target fallback resolves to the same target. Synchronous prior Move commits do not change terrain. This is not a demonstrated existing atomicity bug. Prepared routes must preserve that property; future fallible per-actor work cannot be inserted after the first release. Compare the entire serialization for rejection. |
| Paid work is lost when a builder moves away. | Building/knapping progress belongs to `b.work`/`s.knapping.work` and their reservations (`:37-38`, `:193`, `:207-208`), not worker `u.work`. A Move-only transition need not touch either. Verify funded partial construction and knapping independently of extraction remainder. |
| Holding a transfer load must keep advertising incoming inventory. | `stores` derives incoming solely from `dropoff` (`:77`). Removing it on acceptance removes the promise without changing stock or job custody. Keeping `u.transfer` does not itself create incoming inventory. |

The legacy queued-Move exception remains essential: `next=Move(X)` while returning is not an active Move. A deduplication predicate based only on `order.kind==='move'` is also too broad if it ignores phase. Define an actual active Move by the executing phase/state, then preserve its exact route on repeats. At held arrival `order=idle` must not suppress Stop; idle plus cargo still requires physical return. Clear the old Move before that return so `receive`/`start` cannot replay it (`engine.js:138`, `:153-154`).

## Additional route counterexample and accepted narrow guard

The initial proposed validation required integer unblocked path nodes and an exact final target. Those predicates alone do not establish legal connecting segments. Consider an otherwise coherent v4 carrier at `(17,2)`, with `order=Move(21,2)`, `path=[{x:21,y:2}]`, positive matching cargo, `next=null` and no dropoff. The sole node and target are integer and clear, but following that segment crosses the blocked river columns 18 and 19 outside the ford (`engine.js:140`). This is a hand-constructed import witness against the stated validator predicates, not a normally generated route or executed finding. The existing generic validator is also permissive about routes; this is not evidence of a new inventory exploit.

Root accepted this scoped v4 guard during the review:

1. Require integer, in-bounds, unblocked nodes and exact target tail.
2. Require consecutive path nodes to be cardinal grid neighbors.
3. Require the first node to equal the rounded current cell or be its cardinal neighbor, matching the current `path()` origin model.
4. Retain the exact empty-path-at-target boundary, and keep blocked `idle/order=Move/path=[]` holding loadable independently of active-route rules.

This rejects the concrete long-jump witness. It also admits generated route states: `path()` omits the rounded start and reconstructs cardinal neighbors; while following the first segment, the actor's rounded cell is the first node or its predecessor. A fractional redirect may begin with a short diagonal connector under the existing model, but the rounded origin remains the same cell until the forward axis rounds to the first node. If `path()` returns empty while actual coordinates differ, `[target]` has first node equal to the rounded current cell. These statements are static geometry reasoning, not runtime results.

Tests must cover both sides of the `.5` rounding boundary, mid-segment redirects, zero-distance commands and the near-final-node `.333332` tick identified by the critic. Exact endpoint snapping must occur only when the tick's actual movement budget reaches it. Do not require first-node cardinal distance directly from fractional coordinates: that would reject legitimate generated snapshots. This narrow guard does not prove full collision geometry for arbitrary legacy fractional positions, redefine the existing movement model, or authorize retroactive rejection of unrelated legacy states.

## Evidence that can falsify this assessment

Run on Sparks only, against the final immutable source:

- Use actually gathered partial/full loads and actually picked-up transfers. Record accepted command, next running displacement, fractional redirect, final node, arrival, long held wait, paused reload, Stop return and receipt. Assert typed material totals and each transfer partition every tick; compare exact restored continuation.
- Pair current behavior with the old return-first Move from the same earned pre-command state. Merely forging a carryMove snapshot establishes validator behavior, not command reachability.
- Add a legitimate funded building across an active Move route and then over its destination. Require same-target replan or stable blocked holding, never `home()`. Canceling the obstacle must not resume the blocked Move automatically. Preserve job progress, load and obligations.
- Exercise Stop while moving, on held idle cargo, and when storage is inaccessible. Follow long enough after receipt to detect a stale Move or gather restart. Check original-destination transfer delivery versus other-store recovery separately.
- Preserve the old F6 rejection set for transfer cargo in extract/construct/craft/walk/pickup (`tests/hearth-rts-storage.test.cjs:217-230`). Add each invalid carryMove predicate independently, including the route-jump witness, and the valid blocked-hold/empty-path arrival exceptions.
- Keep storage migration at `<3`: a real v3 world with local stores, pending and loaded transfers, queued legacy Move and partial paid work must retain those fields when only the outer schema changes. A frozen v3 reader must reject v4; a v4 reader must reject v5. Verify raw backup collisions and backup/main-write failure separately for ordinary migration and legacy residue recovery.
- Use actual M, Move-button/touch and contextual-ground input with truthful next-action and held-custody text. Preserve paused planning and check duplicate Send feedback. Browser automation proves these paths, not physical-touch ergonomics or novice predictions.

No unresolved new design blocker remains after the accepted route guard and P1 fixture split. Implementation, independent concrete-source verification and Spark evidence remain outstanding. No full IC02, exporter, capacity, navigation integration or release approval is claimed.
