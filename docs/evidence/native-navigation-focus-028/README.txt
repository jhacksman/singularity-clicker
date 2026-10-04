Navigation-focus028 — second failed focus-oracle observation preserved

Exact source: 4f409b0d926ee9a943e4e0e36c621885b678eafb
Command: node scripts/check-syntax.cjs && node build.mjs && node tests/browser/campaign-navigation.cjs
Spark result: exit1, cleanup verified absent. Syntax34 and all four builds passed.
The campaign runner failed in nativeFocusBoundary at273, called from339:
actual activeElement.id was modal, expected modal-close.

The persisted forward sequence contains exactly two post-input observations:
1. Tab from Replay: BODY, outside modal, document.hasFocus false; dialog remains
   open and :modal. Events record window blur.
2. Next Tab: DIALOG#modal, inside modal, document.hasFocus true; dialog remains
   open and :modal. Events record window focus and focusin on that dialog.

No background interactive element is observed. The test aborts at the second
observation because it expects the first in-modal target to be the Close button.
This record does not show the third Tab or prove eventual button reachability.
Backward traversal, background probes, Stay/Enter/reopen and subsequent native
campaign groups are NOT RUN. The raw trace is focus/key telemetry, not a browser
trace ZIP. Four earlier helper exports used temporary files and were not retained.

The raw result, log, forward telemetry and failure JSON are copied unchanged.
Navigation026 remains a separate earlier failure, with a weaker empty-ID-only
diagnostic. Neither failure is reclassified as a pass by a source correction.
Any follow-up must use a separate immutable commit and complete the full browser
gate on Spark. No runtime/browser/parser/build was executed on M6.
