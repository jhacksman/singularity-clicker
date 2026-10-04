# Post-Storage022 persistence candidates

Read-only discovery against immutable `f93798b3cd5b3f38697e1696a058e55e449b676d`. No M6 runtime, test, parser, lint, build or browser execution occurred. Application source was not edited. A delegated read-only engine scan independently contributed P-01; this is discovery evidence, not the required fresh skeptic/closure review. Source lines refer to that commit, even if subsequent UX work shifts the working-tree lines.

Scope: save/load/import/refresh, storage failure recovery and engine round-trip admission. Closed Storage022 findings and the parent's Move, held-key, touch and command-help UX work were excluded. Existing Spark022 evidence was used as coverage evidence; no new runtime result is claimed.

## P-01 — Earned tools can produce a saved gathering state that rejects on refresh

**Candidate severity: Medium, progression/save blocker. Static chain confirmed; fresh independent skepticism and Spark reproduction required before a fix.**

This is reachable through ordinary gameplay, without a forged import. Finish the workshop and knapping, then give an empty worker a new gather order on a deposit with at least three items remaining. `start()` sets `u.work=0` (`src/hearth-rts/engine.js:139`). When the worker has reached the deposit, the production browser loop advances the engine in `.1`-second increments (`src/hearth-rts/view.js:87`).

Crafted extraction uses interval `.45` and accepts `u.work + .00001 >= interval`, then subtracts the full interval (`engine.js:192`). The ordinary floating-point sequence from zero is:

1. Five extraction ticks accumulate `.5`; the first item leaves `.5 - .45`, approximately `.04999999999999999`.
2. Four further `.1` ticks accumulate approximately `.44999999999999996`.
3. The epsilon admits the second item, and subtracting `.45` leaves approximately `-5.551115123125783e-17`.

Cargo is only two and the deposit is nonempty, so the branch does not call `home()` or `start()` and the negative work survives until the next extraction tick. The validator requires every unit's work to satisfy `v >= 0` (`engine.js:18,29`); `new Camp(saved)` therefore rejects this engine-generated checkpoint (`engine.js:50`).

The browser's `save()` serializes the checkpoint without checking admission (`view.js:10`). Pause saves immediately (`view.js:32`); autosave, hiding the page or pagehide can also capture it (`view.js:86–87`). After refresh, load falls into the rejected-save recovery path (`view.js:6`), leaving the camp blocked. Export retains the original bytes, so this is not established irreversible loss; however, importing the same exported bytes also rejects until the invalid numerical residue is repaired.

**Why existing passes do not close it:** the tool-speed test advances two seconds and asserts cargo/capacity/conservation, not validity at intermediate ticks (`tests/hearth-rts.test.cjs:37–42`). The browser journey does gather food after crafting tools, but stops and waits for zero cargo/idle before its reload checkpoint (`tests/browser/hearth-rts.cjs:25–28`). Those later states reset work and can pass while the second-item checkpoint fails. Spark022's passing suites do not assert this intermediate round-trip invariant.

**Exact proposed Spark regression:** legitimately earn tools, issue a fresh gather command, advance until path is empty while work remains zero, then inspect every `.1` extraction tick for `valid(state)` and successful serialize/constructor round-trip. The ninth extraction tick is the minimal focused negative control. Add a browser save via actual Pause at that checkpoint, then reload and assert the same camp remains loadable, paused and resource-conserving. Test later item checkpoints as well, because the epsilon/subtraction pattern repeats. Do not substitute a deliberately injected negative work value for the production trace.

## P-02 — A storage read failure escapes the startup recovery handler

**Candidate severity: Medium availability defect; no demonstrated saved-byte destruction. Static chain confirmed; fresh independent skepticism and Spark reproduction required before a fix.**

`view.js:6` performs the initial `localStorage.getItem(KEY)` inside `try`. Its `catch` immediately performs the identical `localStorage.getItem(KEY)` again, without a nested guard. If access to the storage object or reading this key consistently throws, the catch throws too. Script initialization exits before Journey/Export/Import handlers are attached (`view.js:76–85`) and before the frame begins (`view.js:88`). The visible shell remains, but normal recovery controls are inert. This is a startup availability failure, not proof that browser-held data was destroyed; when storage access is restored, the prior bytes can remain intact.

**Exact proposed Spark regression:** preserve a valid seeded KEY through the native storage method, then install an init-script failure for KEY reads (and separately the storage getter if practical). Record page errors and assert initialization reaches an honest blocked/recovery UI instead of aborting before controls attach. Restore access only through the fixture and verify the underlying KEY stayed byte-identical. The tested failure should occur on reads, not another write-quota case.

**Coverage boundary:** the existing recovery helper replaces `Storage.prototype.setItem` (`tests/browser/hearth-rts-recovery.cjs:10`) and covers backup/main write failures and import replacement. It does not exercise `getItem` failure or a failing storage getter. The Storage022 write-failure closure remains valid.

## P-03 — Falsy JSON payloads are silently treated as an absent save

**Low, strict invalid-byte retention gap; not evidence that a legitimate generated camp is lost. Included for explicit triage, not as an additional ordinary-play blocker.**

For a present KEY containing `null`, `false`, `0`, or `""` as valid JSON text, `view.js:6` parses the raw text and tests the resulting value's truthiness. It chooses a fresh `Camp()` rather than validating/rejecting the present payload. The initial `save()` (`view.js:88`) then replaces those original bytes without passing through rejected-save export. No valid camp is encoded by these values, so the consequence is limited to the promised retention of rejected/corrupt raw input. By contrast, a truthy malformed object reaches Camp validation and is retained by recovery.

**Suggested focused Spark case if this contract is retained:** seed each falsy JSON value and an actually absent KEY. Assert present invalid payloads remain byte-identical and recoverable, while absent KEY still starts a fresh camp. This observation should not be inflated into an irreversible-progress-loss claim.

## Boundaries and next action

P-01 is the concrete new ordinary-play progression issue from this bounded review. P-02 is a distinct fault-handling gap. P-03 is minor invalid-input preservation. No implementation fix is proposed as approved here; send selected candidates through fresh read-only skeptics before the source owner changes them, then run only the corresponding Spark regressions and relevant existing suites.

I did not claim a new multi-tab loss based only on the absence of a synchronous compare-before-write check. The current storage-event guard is reactive (`view.js:86`), but a specific stale-write race would need a controlled cross-tab scheduling trace before it should become a confirmed finding.
