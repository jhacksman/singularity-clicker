Move025 P3 touch-card readability triage
2026-10-04

Status: confirmed bounded P3/Low readability follow-up; no correction in the frozen
Move025 or native navigation candidates. No mechanics blocker or full UX verdict.

Parent source: task10/MOVE025-OWNER-EVIDENCE-REVIEW.md
SHA-256: 1bffa7fd68533efdc514a3fff4f7b3bd06c187513e1403d942c23131b350d484
Artifact: task2/spark-ci/results/singularity-20261004-rts-move-025-evidence/artifacts/hearth-rts-move-touch-held.png
Source: 4e391c2e2ebf255e1cf0fb5b57bed6d123b51558. The same RTS source remains
unchanged in native navigation 82dc5ed120ff608cef977a33c77b6296185c3f4e.

The returned 390x844-viewport full-page capture visibly shows selected Aru's
card text truncated at Holding; its two wood are absent from that card. The
aggregate Carried: 2 wood line is readable. Full selected detail is visible
farther down the full-page image, below the initial viewport, so that detail
does not disprove the at-a-glance problem. Multiple differing loads were not
rendered in this artifact and must not be claimed as observed evidence.

The source supplies the complete holding/cargo text. The card's nowrap, hidden
overflow and ellipsis rule truncates it in the narrow row, with the portrait
float further limiting status width. This is not missing economic state or an
unsettled canvas frame. Controlled-clock provenance limits gameplay timing claims
but does not explain away the visibly clipped DOM status line.

Review sequence before correction
- critic.txt: independent concrete critique and attempted disproof.
- skeptic-two.txt: fresh disproof of this CSS finding, with explicit disclosure
  that this reviewer previously authored view labels; no claim of independent
  verification of that earlier implementation.
- skeptic-three.txt: independent fresh disproof, source and returned-image check.
All three independently confirmed the narrow finding before reading each other's
new reports. Root also inspected the returned image. These are artifact/source
reviews; no local browser, app, parser, build or tests ran and no source was edited.

Bounded follow-up
Use a separate source identity to make the selected carrier's name, movement or
holding status, resource and quantity readable in the narrow layout. Wrapping or
separate short status/load lines can address this within the existing card; do
not change mechanics, saves, controls, authored art or introduce new gameplay.
Inspect actual rendered 390x844 viewport captures at ordinary and explicitly
measured supported text scaling, with moving and held loads. Text existing in
innerText is insufficient. Verify no horizontal clipping/overlap and that controls
stay reachable. Label simulated scaling and controlled fixtures honestly; they
do not establish physical-device or accessibility acceptance. In particular,
root-font doubling alone does not prove px-sized card text actually grew.

Navigation026 remains ready for its own Spark gate without this separate fix.
Any later RTS CSS correction changes the RTS HTML identity and requires a new
rendered artifact and appropriate focused review; never replace the expected
Move025 hash silently. Parent-routed fresh candidate/control QA and fractional
browser Stop remain separate. Accepted preview and historical evidence stay intact.
