Input023 failed-job evidence and bounded oracle repair

Source: 3b15d6081f5396fcc579140c09d86e532674e2dd
Job: singularity-20261004-rts-input-023 on gb10-02
Image: sha256:b8df542f0badff9f0829d97146c2adc5b193041a276b42a220f9eab5f7df8a0e
Command:
node scripts/check-syntax.cjs && node --test tests/*.test.cjs && node build.mjs && node tests/browser/hearth-rts.cjs && node tests/browser/hearth-rts-recovery.cjs && node tests/browser/hearth-rts-roundtrip.cjs && node tests/browser/hearth-rts-bootstrap.cjs

Observed: syntax 27 files PASS; 83 tests PASS, 0 fail/skip; four builds PASS.
Overall exit 1. Main browser failed at the first water-rejection wording assertion:
expected /blocked/, actual "Move needs clear ground. Previous orders kept."
Recovery, roundtrip and bootstrap browser scripts did NOT RUN. Cleanup verified.
result.json, summary.json and spark.log are copied from coordinator artifacts.
The coordinator summary's archive hash is not a claim that browser acceptance passed.

Independent skeptic_one and skeptic_three both traced contextual water movement
through view.js dispatch rejection before command/save and confirmed stale wording.
The first report is retained here. skeptic_three separately inspected the actual
repair and recorded oracle-static-verification.txt. These are source reviews,
not execution of the repaired test. Both explicitly limit this early fixture to
idle workers with empty cargo; loaded-order preservation remains separate QA.

Follow-up test change: actual Pause; Journey->Export before; contextual water click;
exact current rejection; screenshot; Journey->Export after; exact live bytes equal;
assert paused then Resume. The download directly serializes game memory and avoids
a false pass from unchanged localStorage after an unsaved rejected action.
No application source or build inputs changed. A new immutable Spark run is required.

The failed-job HTML was retained by the coordinator but not published. Existing
Library preview is still separately verified Storage022 and lacks these fixes.
Independent task10 UX closure is a separate exact-source run. No full IC02 claim.
No M6 runtime, parser, tests, lint, builds or browser automation was used here.
