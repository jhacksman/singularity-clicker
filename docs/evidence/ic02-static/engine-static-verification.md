# IC02 concrete engine verification

## Current verdict after E1 correction: static closure, runtime pending

The engine owner's subsequent frozen correction closes IC02-E1 at source level. I independently re-read the actual engine diff and revised Move tests, and verified the core/storage test hashes are unchanged from the first review. No further concrete counterexample was found in this targeted correction. The mixed-reachability coverage limitation below is also addressed by the added test. This is still a working-tree file freeze under HEAD `b3c8fbad63881008657f376dcce9e9b5f770afcb`, not approval of an immutable final release or a claim that tests ran.

Corrected snapshot SHA-256 values:

| File | SHA-256 |
| --- | --- |
| `src/hearth-rts/engine.js` | `ea412f31690fd5b398263dfd5cdaeb1c81aef23a21bdc2ab3dab4ceb9ec4cb55` |
| `tests/hearth-rts.test.cjs` | `2729e5bfdbffc4a871ed69e2db0d76b521d9269f214afd9186d6c37c9193a0bc` |
| `tests/hearth-rts-storage.test.cjs` | `18da846ec14493349faae43ad5eecca844417e6a417d0034eeac0d7e8404f65f` |
| `tests/hearth-rts-move.test.cjs` | `2415c5e0819d9d55eada55729367ae491d73e47b9ef51d2de63948745aa0d9d1` |

`approachPath()` at engine lines 157–158 preserves null and nonempty paths and preserves an empty path when the actor is already at its rounded cell. Only a successful empty route plus a nonzero physical offset becomes a one-node connector to that rounded cell. Because `path()` returns `[]` only when its rounded start is already among the filtered legal goals, this connector has an eligible clear endpoint; it does not guess a receiver or invent a route through an unavailable goal.

`home()` at line 160 still finds, filters and ranks the original store paths first. It then applies the connector to the chosen path, so the repair does not turn a zero-length route into a one-length candidate before comparison and change store tie/ranking behavior. `route()` at line 159 applies the same connector only after route success. That covers `transferHome()`'s receiver approach and generic Move/work/pickup routes as well as the direct Stop return. Genuine path failure still yields the existing blocked state. Command acceptance does not change coordinates; cargo, resource, marker and counters are unchanged. Receipt adjacency and the ordinary movement budget were not loosened.

The original generic movement branch still uses its existing small early-pop tolerance. That is not a reintroduction of E1: its residual is smaller than the unchanged receipt tolerance, while a larger fractional offset now has an actual path segment. The dedicated carryMove branch retains its stricter exact-arrival rule. This verification does not claim a wholesale movement rewrite or zero numerical tolerance in legacy return phases.

The revised `hearth-rts-move.test.cjs:31–39` asserts an earned transfer's exact source edge, the real `.3` outward movement, the old raw `path()==[]` precondition, and Stop installing `[edge]` without moving or depositing. It tests repeated Stop, exact paused reconstruction, a `.05` physical return step, continued exact reload replay and precisely one five-wood source receipt at actual adjacency. Source versus outpost balances, gathered/transfer counters, marker cleanup and no stale Move continuation are asserted.

The isolated negative control at lines 41–47 replaces exactly one expression in the current source: only home's connector assignment becomes its former raw-path assignment. It starts both implementations from the same naturally earned fractional state. The test expects the old control to stay in return with unchanged position/cargo/source stock for 30 ticks, while the corrected source settles once. Corrected `route()` cannot rescue this control because failed receipt retries `home()` directly. This is a faithful targeted causal oracle; it is not presented as an untouched historical application or as already executed evidence.

The receiver regression at lines 49–55 earns a transfer and waits for a genuine fractional final approach, proves the raw rounded route is empty, then invokes `transferHome()` (the helper construction rerouting uses). It requires unchanged position/custody, a restored physical segment, a budget-limited first step with no credit, eventual original-receiver receipt and no duplicate credit. This directly verifies the helper, not a complete browser construction interaction.

The added mixed-reachability case at lines 96–101 explicitly labels its controlled enclosure, proves a valid target is reachable by u0 and unreachable by u1, and gives u0 an actual unpicked five-wood transfer allocation. The selected order causes u0's route to be prepared first and u1's route to fail next. Complete serialization, pending allocation and reserved stock must remain identical. This addresses the previously missing group-admission oracle without claiming the enclosing geometry was built through ordinary play.

File inspection counts 22 Move, 30 storage and 15 core test declarations, all authored and unexecuted in this review. Spark still must parse and run the immutable candidate, establish positive/negative-control outcomes, and supply actual browser/persistence artifacts. T1–T3 browser-oracle closure, full persistence/raw-backup closure and assembled integration are separate; this source verdict does not approve publication or full IC02 completion. No M6 application, parser, test, build, lint or browser execution was performed.

## Original pre-correction review (retained as evidence)

2026-10-04. Independent static verification of the engine owner's released candidate in `hearth-rts-ic02`, against base `b3c8fbad63881008657f376dcce9e9b5f770afcb`. This is a working-tree snapshot, not an immutable release commit. No source edits, execution, parser, test, lint, build or browser run occurred. Only this report was written.

Reviewed file SHA-256 values:

| File | SHA-256 |
| --- | --- |
| `src/hearth-rts/engine.js` | `7d41a0cee6723a2fcba59184fbfcb7ad5748038a34a9b9b70f6a1210007106dd` |
| `tests/hearth-rts.test.cjs` | `2729e5bfdbffc4a871ed69e2db0d76b521d9269f214afd9186d6c37c9193a0bc` |
| `tests/hearth-rts-storage.test.cjs` | `18da846ec14493349faae43ad5eecca844417e6a417d0034eeac0d7e8404f65f` |
| `tests/hearth-rts-move.test.cjs` | `970feb785a052531244b9ccccc0d29e17c3dc2ddeab2555fefb3bf4d9e63b5e8` |

## Original verdict: blocked by IC02-E1

One Medium settlement/control failure remains in the candidate's integration with `home()`. It is statically reachable through ordinary commands, with no forged custody. A new authored test appears to exercise it. Root and engine owner were notified before any fix; fresh skeptical review is required by the workflow. There is no claim that the new tests passed.

The remaining reviewed Move transitions and narrow validation/migration changes are statically coherent. This is bounded source review, not proof of the entire command contract, persistence UI, browser input, navigation, capacity or exporter behavior.

## IC02-E1 — Medium: fractional Stop near storage loops without returning or receiving

Source: `engine.js:138–144` (physical receipt), `151–153` (rounded path origin), `158` (`home`), `181–183` (loaded Stop), `204–215` (movement/receipt tick). New test: `hearth-rts-move.test.cjs:31–33`.

`home()` obtains its route with `path(u, storeEdges)`. `path()` rounds the physical position and returns an empty array if that rounded tile is already a goal. `home()` treats that array as success, installs `phase='return'`, and leaves the physical position unchanged. `receive()` requires the actual coordinates to be within `.001` of a store edge. If they are not, it calls `home()` again. The new final connector in `movePath()` is not used by this return route.

An ordinary, precise witness needs no world editing:

1. Gather a positive wood load with u0, then issue loaded Move to `(10,12)`, the free eastern hearth edge, and let it hold there. This is an explicitly supported new behavior; no receipt occurs merely because Move ends beside a store.
2. Issue Move toward `(14,8)` and run one `.1` tick. Its first route segment is east to `(11,12)` in this open part of the map, so u0 reaches approximately `(10.3,12)` while retaining its cargo.
3. Issue Stop. The rounded position `(10,12)` is a free hearth edge, so `home()` chooses `[]` and returns success. Cargo stays at `(10.3,12)` in return phase.
4. Every subsequent tick sees no path, calls `receive()`, fails actual adjacency, and calls `home()` again. Neither position nor cargo changes; repeated Stop or save/reload does not supply the missing segment.

The transfer-specific authored test already uses a closely related natural witness: `carriedTransfer()` stops at the actual source pickup edge; it issues Move, ticks once, then Stop. All other workers remain in the expanded eastern camp, leaving that source edge available. The `.3` displacement rounds back to the same edge. The subsequent 300 ticks and reload comparison can preserve a perfectly valid but stuck return state; the final `cargo===0` assertion should expose it. This is a static prediction, not an observed test result.

Impact: an accepted Stop fails its physical-return/settlement promise and leaves a worker indefinitely carrying goods with a returning status. Quantity/type and the transfer marker are retained, so this is not an item-loss or duplication claim. A user can recover by explicitly Moving to an exact clear tile and then Stopping. The rounded-path behavior predates this patch; the new loaded-Move/Stop integration exposes it within the feature's required flow, so it still blocks that flow's closure.

Required correction after skeptic confirmation: a successful return route must include the missing physical connector when its rounded goal is reached but the actor is not actually there. Do not repair this by loosening receipt adjacency to grant remote deposits or teleporting at command acceptance. Preserve the selected receiver and existing accounting. Keep genuine no-route holding distinct from the fractional connector case.

Required Spark evidence: gathered and transfer loads, a nonzero fractional offset near source and receiver edges, immediate Stop checkpoint, first return displacement within budget, actual perimeter arrival and only then one receipt. Roundtrip the fractional return, retain typed totals and correct production/transfer/recovery classification, and observe several later ticks to rule out stale Move replay. Include the exact `.1` witness above and keep the existing mid-Move test rather than weakening its settlement assertion.

## Other implementation paths inspected

- `command()` prepares every changing Move route before committing any actor. Its commit releases pending allocations from the old order/next before replacement. A picked-up transfer has zero pending share and retains `u.transfer`; a gathered load with a queued transfer cancels only that unpicked allocation. No new quantity field or resource conversion was introduced.
- Actual `walk`/`carryMove` with the same serialized Move order deduplicates. A saved legacy return with identical `next=Move` does not. Held idle actors still accept Stop. Subsequent Stop/work clears the current Move identity before the return continuation, preventing receipt from restarting that Move.
- `moveCarry()` clears stale dropoff and next, preserves cargo/resource/work and sets only route/control state. Arrival sets idle without invoking receipt or `start()`. Existing transfer jobs remain alive through the custody marker; repeating the old transfer request returns its existing job without changing movement.
- `build()` gives active carryMove priority over the generic loaded-home reroute. A blocked target produces idle holding with the retained Move order and no path. Cancellation does not restart it. Paid construction and knapping remain job-owned.
- The dedicated movement branch uses an exact distance budget and snaps only to an actually reached node. Empty-path arrival is a valid saved intermediate state only at the exact target. The `.333332` boundary test specifically protects against the generic early-pop tolerance; same-rounded-cell Move adds a final connector.
- `validCarryMove()` is v4-only and requires positive cargo, Move intent, no next/dropoff, an integer clear target and route nodes, bounded first-node adjacency, contiguous remaining nodes and exact tail. Blocked idle holding is deliberately outside this active-route predicate. It preserves all original transfer ownership and pending-zero checks.
- F6 is not weakened: ordinary walk/extract/construct/craft/pickup remain forbidden for transfer cargo. The old F6 mutations are retained in storage tests, and new carryMove mutations reject incorrect order, queued state, dropoff, resource, empty load, disconnected/fractional/blocked paths and pending ownership.
- Fresh worlds and adopted saves become v4. The legacy storage condition remains `<3`, so v3 stores/reservations/payments/transfers are preserved rather than rebuilt at the hearth. Old transfer guards now use `>=3`; carryMove itself is only allowed at v4. Constructor pre/postvalidation and future-version rejection remain.

## Test quality and remaining limits

The 19 new Move cases obtain cargo and material funding through real gather/build/transfer operations. `expanded()` and `fundedCarrier()` earn their stocks; the uneven 5+1 allocation is produced by an earlier physical transfer. The blocked-return fixture explicitly identifies its direct geometry edits and does not claim those walls were constructible through ordinary play. Malformed-save cases are clearly mutations. I found no fabricated material grant hidden in the new normal-play fixtures.

Coverage includes partial/full gathered loads, carried transfer custody, Stop/work reassignment, pending shares, queued transfer behind gathered wood, repetition, legacy queued Move, fractional/zero-distance Move, exact arrival, invalid targets, construction rerouting/holding, paid progress, malformed active states, v3 migration and every-tick reload. Existing tests were changed only for version numbers, explicitly superseded loaded-Move expectations and the residue fixture split; Stop/work return-first coverage and F6 rejection remain.

One evidence limitation remains: the new group rejection test uses globally invalid targets or a missing actor ID. It does not exercise a valid target reachable by an earlier selected actor and unreachable by a later one. The implementation's preflight looks correct, but those cases alone cannot prove that no first actor's route/reservation was changed before a later path rejection. Add a deliberately labelled geometry fixture with one reachable and one unreachable selected actor and compare full serialization, including pending shares. This is a test coverage limit, not another demonstrated engine defect.

IC02-P1 is addressed in the core-test design. Legacy residue is generated from the pinned v3 engine, separately from a current-v4 old-subtraction control whose residue must remain unrepaired. V1/v2 projections are labelled; expected migration now targets v4. `hearth-rts-engine-v3.txt` hashes to `3b22d81b32f01f44fc033c488e68a91c027889780f82db380ea899f837f20be4`, independently matching the `3b15d6081f5396fcc579140c09d86e532674e2dd` Git engine blob. The pinned HTML hashes to `4fa74911ae0a0650885355e5e20b4cd2b532c83e4b8bed496a50866a09a63b0a`; its provenance honestly describes Input023's incomplete browser acceptance. None of this establishes the new tests' runtime result.

The preservation decision for worker remainder is implemented through carryMove/hold; later ordinary work start retains its reset semantics. Browser oracle findings T1–T3 and persistence/raw-backup integration are separate reviews and are not closed by these reducer checks. Final closure needs a corrected immutable source, fresh independent fix verification and actual Spark logs/artifacts.
