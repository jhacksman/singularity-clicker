# Independent fractional Stop disproof review

2026-10-04. Reviewer `/root/skeptic_three`. Static source and test inspection only; no M6 runtime, parser, tests, builds, lint or browser execution. No app/test edits. This report records a source-derived verdict, not an executed reproduction.

Reviewed candidate identities:

- `src/hearth-rts/engine.js` SHA-256 `7d41a0cee6723a2fcba59184fbfcb7ad5748038a34a9b9b70f6a1210007106dd`.
- `tests/hearth-rts-move.test.cjs` SHA-256 `970feb785a052531244b9ccccc0d29e17c3dc2ddeab2555fefb3bf4d9e63b5e8`.

**Verdict: confirmed, Medium, recoverable settlement softlock.** An actual transfer carrier can take one `.1` tick of loaded Move from its pickup edge, then Stop, and remain in return phase with cargo forever under otherwise unchanged geometry. `home()` treats a zero-node route from the rounded position as physical arrival, while `receive()` correctly requires the actual position to be beside the store. The engine keeps recomputing the same empty route. This strands the requested return and keeps the load/job outstanding; it does not destroy or duplicate goods and does not prevent the player from issuing a new Move to recover.

## Source trace and natural fixture reachability

The new test at `tests/hearth-rts-move.test.cjs:31-33` invokes `carriedTransfer()`, commands Move to `(14,8)`, ticks exactly `.1`, then issues Stop. It expects return to the hearth and empty cargo after 300 ticks, with an uninterrupted/restored pair checked throughout.

`carriedTransfer()` at line13 starts from `expanded()`, requests an actual u0 wood transfer from hearth b0 to the completed outpost, and stops ticking as soon as u0 gets its transfer marker. `expanded()` at line12 gathers actual deposits, completes paid workshop/outpost construction, and finally commands the actors idle. Thus this witness obtains its load through the engine's real pickup; it does not inject a transfer marker, load or fractional position.

The pickup branch requires the carrier to be within `.001` on both axes of an actual source work edge (`engine.js:218-219`). On the pickup tick it removes the physical source goods, zeroes this pending allocation, installs cargo/resource/marker and routes onward, but does not move the actor (`:220`). The helper stops immediately after that tick. The carrier therefore begins the next explicit Move at, or within the small existing movement tolerance of, an integer hearth edge.

The explicit target `(14,8)` is not a hearth edge. Its route starts with an adjacent clear integer node. A `.1` carryMove tick moves at most `.3` cells along that first segment (`:206-210`). It remains inside the original edge's rounding cell, while being roughly `.3` away from the actual edge—far outside the receipt tolerance. There is no need to assume one particular hearth pickup edge to establish this; each eligible edge has the same integer-grid rounding property.

Stop enters `command()`'s loaded non-Move branch (`:181-183`). It replaces the old Move order with idle, installs next=idle and calls `home()`.

`path()` rounds its starting coordinates (`:151`). If that rounded start already belongs to the eligible goal set, BFS immediately chooses it and the predecessor reconstruction returns `[]` (`:152-153`). `home()` passes each store's free edges, accepts the empty array because it is truthy, sorts by path length, and selects the zero-length hearth route (`:158`). It sets dropoff=b0, path=[], phase=return and a returning reason. It does not add a connector to the physical edge.

On each following tick, the actor has no path, so the engine enters the return receipt branch (`:212-214`). `receive()` checks actual coordinates against store edges using `.001` (`:139-140`), finds no physically adjacent store, and calls `home()` again (`:141`). The same rounded start, free edge and zero-length path recur. Neither branch changes position. The resulting per-actor state is stable indefinitely; only world time/normal unrelated processing advances.

## Attempts to disprove the loop

**Could freeTargets remove the rounded hearth edge?** Not in this fixture. The expanded camp's other workers end their paid eastern construction near the outpost; the final Stop leaves them there. Only u0 is requested for the transfer back to the hearth. `freeTargets` excludes another actor near a goal or with a path ending there, and explicitly excludes u itself from that occupancy check (`:156`). The original pickup edge therefore remains eligible. The moving actor's own old destination cannot reserve it against itself.

**Could another store win route selection?** The other eligible store is the eastern outpost; the workshop is not a store. Its path from the hearth area has positive length, while the hearth candidate has length0. The stable shortest-path selection therefore keeps the hearth. Additional distant stores would not displace the zero-length route.

**Could receipt accept another adjacent edge?** Source edges are integer grid points. Moving roughly `.3` from the pickup edge cannot put the carrier within `.001` of any different integer edge. The assigned dropoff also specifically restricts receipt to b0. The actual-coordinate guard is the correct custody boundary; broadening it to the rounded cell would turn the liveness bug into a remote receipt.

**Could the manual Move connector fix this?** No. `movePath()` at line159 repairs a path[] result for an explicit Move to a physically different target, but `home()` calls `path()` directly. Once Stop changes the phase/order, carryMove's movement code is no longer entered. This confirms the gap is at the return transition, not at the Move's own same-cell arrival.

**Could repeat Stop or reload resume progress?** Repeated Stop compares the matching next idle order while phase remains non-idle and is deduplicated (`:181`). Even forcing another `home()` call produces the same route. Current validity admits a fractional return actor with path[] and preserved marker/job; it does not require receipt adjacency in return phase. Serialization and construction retain the condition. Exact replay can therefore prove that both copies remain stuck, which is why the final cargo assertion in the new test matters.

**Could peers or construction eventually rescue it?** A later external change that occupies the zero-length goal or a fresh Move can alter the result. That does not defeat the candidate: with the fixture's other workers idle and geometry unchanged, normal ticking provides no escape. No automatic environmental change is needed or promised for Stop to succeed.

## Severity, repair boundary and evidence gate

Medium is appropriate: ordinary valid commands produce an accepted return that never completes and leaves a transfer obligation outstanding. The scope is bounded to fractional states whose rounded location is an eligible store edge while their actual position is not receipt-adjacent. Inventory, type and transfer accounting remain intact; new explicit Move to an exact clear point, followed by Stop, can recover. It is neither a startup blocker nor irreversible progress loss.

The rounded-route primitive predates carryMove, so I do not claim this defect was created exclusively by the new phase. The newly required immediate Move→Stop transition supplies a direct deterministic route into it, and the candidate must satisfy that transition before closure. Other home callers may share the primitive, but this report does not expand into a general pathfinding rewrite.

The correction must route the actor over the remaining physical segment before receipt, respecting the existing speed budget and receiver selection. Do not fix it by snapping position at command time, treating a rounded cell as receipt adjacency, crediting cargo remotely, or deleting the load/job. The engine owner should choose the narrow implementation after the coordinator's independent confirmation gate.

The current test at lines31-33 should fail its final `u.cargo===0` assertion on this candidate, while both replay copies remain otherwise valid and equal. Spark must verify that prediction and the corrected behavior. Strong closure evidence should capture actual pre-Stop fractional coordinates, the accepted nonempty return connector, first return displacement bounded by `.3`, unchanged cargo/stock until physical receipt, correct source recovery rather than gathered production, and exact replay. This review author ran none of those checks.
