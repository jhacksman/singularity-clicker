# Independent review follow-up · 9 October 2026

All four reported regressions are corrected in the local art-overhaul branch.
Simulation, save schemas, resource rules and the 14-stage plan are unchanged.

- Agriculture draws all field labels after scene artwork, uses compact numbered
  ready markers on narrow canvases, and resolves their full painted bounds before
  field-center hit testing. Label overlap resolves in the same order as painting.
- The resource header wraps at 1180px, keeping cultivation's Journey button visible
  at 1024px and 1080px as well as either side of the new breakpoint.
- Hearth map resident numbers use dark ink on a cream badge, drawn over roads.
  Actual captured foreground/background contrast is 10.82:1 at 390px and 1440px.
- Hearth villagers regain job-colored hats and distinct tools. Resting villagers
  sit down; stationary work raises the tool. Motion respects pause and reduced
  motion. The other renderers retain their existing person appearance.

Run `node scripts/art-review/review-regressions.cjs` using installed Playwright
and Chrome (`PLAYWRIGHT_MODULE` can locate the module). The browser regression
uses ordinary game controls to earn adjacent ripe fields and stationary work.
It observes Canvas drawing calls to locate the actual visible badge bounds, then
taps all four edges of all six badges at 320, 390, 600, 768 and 1440px. It also
checks label painting order, nine header widths, sampled resident-count contrast,
and distinct paused job/rest screenshots. The preserved pre-fix build fails this
harness at its field-label layering assertion.

Verification: 233 unit tests, 60-file syntax gate, five self-contained builds,
the new browser regression, existing final resource/navigation/save/reload
interactions, and 13 refreshed early/mid/late/mobile captures pass. The five builds
were checked for reproducibility; unchanged engines/accounting and Cave bytes
remain equal to the accepted baseline. The earlier full progression and broad
cultivation results remain documented in VALIDATION.txt; those long runs were
not repeated for these presentation fixes.

The review package's `evidence/review-fixes/` contains the targeted report,
screenshots and the earned ripe-field fixture. `evidence/after/` and both
individual Library comparison images are refreshed from this build. The original
accepted checkout and NAS remain untouched. No publishing or deployment occurred.
