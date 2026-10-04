# Independent disproof review: ordinary extraction creates an unreadable save

Reviewed immutable source: `f93798b3cd5b3f38697e1696a058e55e449b676d`. Scope: the proposed negative extraction-work residual, normal reachability, persistence, reload rejection, and existing test coverage. This review did not consult other roundoff skeptic reports. It used read-only source and previously inspected Spark022 evidence. No code, parser, application runtime, tests, build, lint, or browser was executed on M6; no implementation was edited.

**Verdict: the candidate survives independent disproof. High release priority for ordinary save/reload correctness is justified by the static trace. A targeted Spark reproduction is still required before calling it runtime-demonstrated.**

## Arithmetic and reachable state

`src/hearth-rts/engine.js:139` sets `u.work=0` when a new gather order starts. Travel ticks at line 182 do not accumulate work, so a worker arriving at a source can begin extraction with exactly zero. Tool completion at line 193 sets `tools=true` and sends artisans through `start()`, which also resets their work. A subsequent ordinary gather order is sufficient; no imported malformed state is required.

Line 192 increments work by `dt`, uses interval `.45` when tools are active, admits extraction with `u.work + .00001 >= interval`, and then subtracts the full interval without clamping or normalization. The view at line 87 calls `game.tick(.1)`, so the proposed step size is the actual normal browser step.

Manual IEEE-754 reasoning is consistent with the proposed sequence. Starting from work zero, the fifth addition reaches `0.5`; subtracting the binary representation of `.45` leaves `0.04999999999999999`. The next additions give the usual binary64 results displayed as `0.15`, `0.25`, `0.35`, and `0.44999999999999996`. The last is one binary64 unit below the stored `.45`, whose value is slightly above the real decimal 0.45. The epsilon admits the second extraction, and subtraction leaves `-2^-54`, approximately `-5.551115123125783e-17`.

This is nonzero negative work, not negative zero. JSON number serialization does not normalize such a value to zero. At the ninth extraction tick the worker has cargo 2, below its capacity of 5. Choose a source with more than two remaining items and the exhaustion branch does not run. The function then continues to the next worker; its final reveal/completion logic does not touch this work value.

The previously inspected ordinary earned Spark022 camp supplies a concrete legal starting point: tools are complete, workers are idle with zero cargo/work, and substantial eastern sources remain (including food at `d7`). Its ordinary source code already demonstrates reachable food gathering after tool completion. No blocked-map or unaffordable-work precondition prevents issuing another gather order.

## Attempted rebuttals

| Possible rebuttal | Source-based disposition |
| --- | --- |
| Arrival or each extraction resets work | Arrival only consumes the path; extraction subtracts the interval. `start()` resets work at order/receipt transitions, not after each extracted item. |
| Full-load/exhaustion return immediately repairs the second extraction | Cargo is only 2, and a plentiful source avoids exhaustion. Moreover, `home()` itself does not reset work; receipt later calls `start()`. |
| The next tick makes the residual positive | True if simulation continues. It does not prevent a save or Pause between ticks; Pause freezes the invalid value. The negative interval is transient during uninterrupted simulation, not impossible to persist. |
| Validation tolerates floating-point noise | `valid()` line 18 requires `v >= 0`; the unconditional unit predicate at line 29 applies this to `u.work` in every phase and schema. No epsilon is used there. |
| Serialization or migration normalizes work | `serialize()` line 198 directly calls `JSON.stringify(this.s)`. The constructor rejects the input before migration or reveal can do anything; neither migration nor reveal repairs unit work anyway. |
| Saving rejects an invalid state and retains the last good save | View line 10 serializes and writes without calling `valid()`. A successful localStorage write replaces the current slot with the negative value. |
| Browser saves occur only at safe work boundaries | Pause line 32 calls save immediately. Visibility/pagehide line 86 also save the current state; periodic frame save line 87 is not aligned to receipt boundaries. No such safe-boundary gate exists. |

On next load, view line 6 calls `new Camp(state)`, whose initial validator rejects the negative work. The catch preserves the original raw string as `rejected`, constructs a fresh display camp, and sets `blocked=true`, `paused=true`. Export can retain the raw evidence, but replay/import of that unchanged raw string is rejected by the same constructor. There is no normal in-app resumption of this saved camp.

## Severity and limits

This is ordinary state generation followed by a normal persistence action, not an adversarial input problem. It violates the ability to reload the game's own output after a useful upgrade. High release priority is appropriate even though the numeric error itself is tiny.

Do not describe every tools-enabled journey as inevitably lost: another simulation tick can make the work nonnegative, receipt resets it, and a later valid save can replace a transient bad save before a reload. The exploitably timed Pause case prevents that automatic progress and gives a durable witness. Do not claim irrecoverable destruction: the blocked reader retains raw export, and external repair or a separately retained earlier save could recover progress. The material defect is that normal save/reload can block the current earned camp with no ordinary in-app continuation.

The Spark022 tests passing does not disprove this candidate. The existing `crafted tools improve extraction...` test samples after two seconds and checks throughput/cargo/conservation, not `valid()` and serialization reload after each extraction tick. The browser journey gathers after crafting but captures/reloads at selected stable checkpoints, particularly after cargo has returned. Storage custody tests do not systematically round-trip every tool-assisted extraction state. Conservation totals can remain correct while this schema invariant fails.

## Targeted Spark evidence requested before closure

1. Earn tools through normal engine commands or start from the actual earned Spark022 camp, issue a normal gather order to a plentiful reachable source, and inspect every `.1` extraction tick through at least the first full load. Record the first negative work value, phase, cargo, source amount, and full serialized state; test `valid()` and constructor reload at that exact point.
2. In a separate actual browser witness, reach that ordinary extraction interval, Pause/save, reload, and capture the saved raw work value plus the blocked-recovery behavior. Keep this separate from synthetic malformed-save fixtures.
3. For any later fix, verify each intermediate tick's validator and exact save/reload continuation across several loads, tool and plain intervals, Stop/reassignment/return, and paused/pagehide persistence. Retain typed conservation and cargo limits. Decide explicitly how already-generated tiny-negative saves are handled; do not silently claim their recovery from a test that only starts with newly corrected states.

No remedy was implemented or selected in this disproof-only review. The existing bounded storage closure must not be read as exhaustive persistence acceptance in light of this newly identified candidate.
