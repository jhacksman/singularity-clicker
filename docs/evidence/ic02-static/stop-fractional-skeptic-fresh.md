# Fresh skeptic: fractional Stop return

2026-10-04. Independent read-only disproof attempt before the sole owner's fix. Reviewed working-tree engine blob `88593b13aa76ede09c2f871525f25d286105ae60` and Move test blob `373025e8d2996ee08a1b731759acbc9e3c4d7216` in `hearth-rts-ic02`, whose HEAD was `b3c8fbad63881008657f376dcce9e9b5f770afcb`. These are uncommitted implementation files, not a claim that HEAD contains the reviewed implementation. No source edits, runtime, parsers, tests, builds, browser or network execution occurred. Only this report was written.

**Verdict: confirmed by source, Medium, recoverable settlement softlock.** I could not disprove the critic's witness with `freeTargets`, receipt tolerance, duplicate handling, save validation or fixture behavior. The current test named `Stop during loaded Move recovers a transfer at nearest hearth without production or stale Move replay` contains the relevant earned setup and sequence (`tests/hearth-rts-move.test.cjs:31-34`). Its expected eventual empty cargo conflicts with the current routing code. This is static confirmation, not a reported Spark failure.

## Concrete chain

1. `expanded()` earns the materials, constructs its workshop/outpost, and ends by issuing idle to all workers (`tests/hearth-rts-move.test.cjs:12`). These workers carry no load from construction; the other actors are idle with no remaining route.
2. `carriedTransfer()` assigns only `u0` a real transfer from `b0` to the outpost and stops ticking immediately when `u0.transfer` appears (`:13`). Pickup sets that marker, debits source stock and installs the delivery route in the same tick; it does not move the actor along that delivery route until a later tick (`engine.js:215-220`). The actor is therefore still at a source perimeter point `p`, within the pickup predicate's `.001` coordinate tolerance (`:219`). Tiny existing movement roundoff does not invalidate the argument below.
3. The test commands loaded Move to `(14,8)`, then ticks `.1` once (`test:32`). That target is not a hearth perimeter point. `carryMove` moves toward the first grid neighbor with a budget of `.3` cells (`engine.js:209-210`). The resulting actual position is about `.3` cells from `p`, while its rounded position remains `p`.
4. Stop replaces the Move identity with idle, queues idle, and calls `home(u)` (`:183`). `home` calls `path` from the fractional position to the free hearth perimeter (`:158`). `path` rounds the start; because that rounded point is already a goal, it returns `[]` (`:151-153`). The empty array is truthy, so `.filter(v=>v.path)` retains it. Its zero length sorts before the remote outpost's nonempty route. The result is `phase='return'`, `dropoff='b0'`, `path=[]`, unchanged fractional position and cargo.
5. Each subsequent return tick calls `receive` (`:214`). Receipt requires actual coordinates within `.001` of a perimeter point (`:139-140`). The actor is about `.3` short, so receipt calls `home` and returns without moving or depositing (`:141`). The same rounded start selects the same empty route. With stationary peers and unchanged geometry, this repeats indefinitely.

No exact guessed perimeter coordinate is necessary: all legal hearth pickup points have integer coordinates, the target `(14,8)` differs from each, and the first `.3` movement remains inside the original rounding cell while leaving receipt tolerance.

## Disproof attempts

**Could `freeTargets` exclude the old pickup edge?** It explicitly excludes the moving actor from occupancy checks (`engine.js:156`, `v!==u`). Its own proximity to `p` cannot eliminate `p`. The source pickup route was selected through `route`/`freeTargets` (`:157`, `:166`) while the other workers were already idle. Those workers do not move between pickup, loaded Move and Stop. The hearth has twelve perimeter points, and only three idle peers; in this open fixture the source route has free goals, so it need not use the occupied-goal fallback. A goal selected as free for pickup remains free for the return attempt. The source-to-outpost connectivity filter also does not remove it from the broader home target set. Thus occupancy does not rescue this fixture.

**Could ordinary movement finish the fractional segment?** The return path has zero nodes, so the generic movement branch (`:212`) never runs. The new same-rounded-cell connector exists only in `movePath` (`:159`). Stop calls `home`, which does not use it. `receive` also re-enters `home` directly.

**Could receipt tolerance absorb the displacement?** `.3` is far greater than `.001`; ordinary floating-point residue near the original edge cannot bridge that difference. Another integer perimeter point is also outside `.001` after this single partial segment.

**Could repeated Stop, reload or job pruning resolve it?** Repeated Stop matches the queued idle order while phase is return and is deduplicated (`:181`). Reload preserves the return state; the constructor validates, clones and reveals without replanning (`:70`), and this state satisfies the return/transfer-marker validation (`:53`). `pruneTransfers` preserves the job because `u.transfer` still refers to it (`:137`). None provides physical progress.

## Impact and limit

Stop and Return reports a return plan that never settles this load. A return-first work command at the same boundary can likewise leave its next task waiting behind the same `home`/`receive` loop, but the reviewed test witnesses Stop directly.

Cargo, resource type and transfer ownership are preserved; source stock remains correctly debited for that cargo. No duplicate receipt, production credit, refund or deletion is established. The source return would count as recovery, not delivery to the original outpost (`engine.js:143`). The camp remains saveable. The player can recover by explicitly Moving to `p`, allowing `movePath`'s physical connector to reach it, then issuing Stop again. This supports Medium, not an irreversible-loss or High conservation claim.

The rounded `path`/`home`/`receive` mismatch predates the new phase. Immediate loaded Move makes this short normal input sequence expose it. That ancestry does not make the new Stop acceptance case pass.

## Smallest fix boundary and evidence

At return-route construction, a rounded-start match must not stand in for physical arrival. If a chosen home route is empty but the actor has not reached the selected legal perimeter goal, install a real connector to that goal, preserving the ordinary movement budget and deferring receipt until physical adjacency. Keep the goal from the same clear, available, eligible perimeter set used for routing. In this witness the connector reverses the just-traversed short segment with unchanged geometry, so no new obstacle crossing is necessary.

Do not fix this by widening receipt tolerance to `.5`, rounding the actor's position at command acceptance, crediting storage before movement, or routing straight to the building center. Those would change physical delivery or collision behavior. A shared connector helper may be reasonable if its other callers are deliberately checked, but this witness does not require a general pathfinder redesign or changes to custody accounting. Truly unreachable/crowded destinations must retain the existing safe-hold outcome.

Required Spark evidence on the fixed immutable source:

- Run the existing exact earned-transfer Stop test and record `p`, post-Move coordinates, accepted return path and first return displacement. Assert that cargo stays with the actor until it physically reaches an eligible perimeter.
- Assert the eventual source receipt once, unchanged gathered/transferred-production counters, retained transfer ownership until receipt, and no stale Move replay. Keep a reference to the job if needed to observe recovery before terminal pruning.
- Roundtrip immediately after Stop and through the connector/receipt; uninterrupted and restored continuation must agree. Keep typed totals and the job partition checked each tick.
- Cover Stop at an exact perimeter point, both sides of a `.5` rounding boundary, a genuinely occupied old perimeter point and no reachable store. These distinguish the connector fix from a broad occupancy bypass or remote receipt.
- Keep a pre-fix control for the witnessed loop, bounded in duration. A passing test name or source assertion alone is not execution evidence.

The proposed transition remains blocked on this concrete fix and Spark verification. No app edits or execution result is claimed here.
