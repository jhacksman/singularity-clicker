Navigation026 actual execution — failed browser gate retained

Source: 82dc5ed120ff608cef977a33c77b6296185c3f4e
Job: singularity-20261004-navigation-026, gb10-02, approved pinned browser image.
Result: exit 1; cleanup verified and absent. This is not a navigation pass.

Passed: syntax 33 files; all 124 deterministic tests with no failures, skips or
cancellations; four builds; the smoke browser runner including native RTS entry
and preserved previous Hearth gameplay/recovery. The campaign runner reached and
passed its successful native mount/visible refresh/export zero-mutation window,
then failed its focus assertion at line 311. Replay followed by one Tab produced
an empty document.activeElement.id rather than the expected modal-close.

The failure diagnostic does not record the active tag, modal containment or
document.hasFocus. It therefore proves neither interactive background escape nor
focus in browser chrome. The browser was using the unchanged native showModal
behavior. Later campaign presentation, lifecycle, Back, migration/import and
admission cases after the assertion were not executed. Their authored existence
and prior standalone helper results must not be reported as a combined pass.

Exact result, full stdout, failure JSON, successful zero-mutation record and built
page provenance are copied from the coordinator output. Returned full artifacts
and review-only sibling HTML remain under task2/spark-ci/results with the exact
job prefix. No local parser/app/tests/build/browser rerun was performed.

The built RTS page is byte-identical to verified Move025: 85,447 bytes;
SHA-256 50b7bf3cc96853975956e539cae82f73fe0b6eb5d4d0092ff74d6b3e7ca19bef.
This preserves its separately scoped mechanics evidence, not navigation or full
UX acceptance. The later P3 stylesheet change will have a new RTS page hash.

Focus oracle triage and any reviewed correction use a separate source identity.
Keep this failed run intact. A corrected exact-source campaign runner must finish
and its returned artifacts must be reviewed before calling navigation verified.
