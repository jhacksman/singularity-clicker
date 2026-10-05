# A tended supply patch

This branch adds a separate local cultivation preview after the accepted RTS
opening. It preserves the original RTS engine, renderer, save key and drawn art.
It does not implement full Hearth, First Furrow, Agriculture or campaign handoff.

The new preview adopts an earned v6 camp into an explicitly selected local
compatibility profile. Named workers collect bounded water and discovered seed,
deliver planting inputs, grow a pilot food crop and then a woodland plot, and
carry food, wood and retained seed into actual stores. Foreground growth leaves
workers free for other work. Support starts only after confirmation, protects
active work and a usable next crop, and falls back to ordinary gathering at a
shortage. Existing paid tools retain their original effect when supported.

The old opening and this continuation are isolated histories. They cannot trade
or merge people or materials. The new single-value save envelope retains exact
source bytes and outgoing states; Web Locks limit writes to one browser tab.
Unsupported locking is read-only. No cross-world persistence claim is made.

Read [the local profile](local-profile.md) for the selected numeric and custody
rules and [the UI contract](ui-contract.txt) for reviewable input behavior.
The approved all14 source remains the frozen task-11 specification; this preview
does not amend it. `whole-pantry-slot100.v1` is a bounded compatibility profile,
with exact fractional support and preserved legacy movement/work arithmetic.

Expected build artifact: `dist/hearth-cultivation.html`. The branch is not yet
runtime-verified. Tests/builds/browser runs must execute only in the existing
coordinator-managed Spark image. Static review and authored tests are not passing
execution evidence. No deployment, publication, GitHub push or main merge is part
of this milestone.

Planned gates:

- Complete syntax check, deterministic suite and all five HTML builds.
- Ordinary earned browser journeys with two cultivation investment orders,
  physical output used for real work, protected repeatability, refresh/import,
  writer contention and storage failure evidence.
- Existing RTS input, progression, construction/cargo and observation regressions.
- Independent review of exact returned data and native screenshots.

The [deterministic suite](../../tests/hearth-cultivation.test.cjs) contains 20
authored cases for exact support arithmetic, physical custody, unlock receipts,
adoption, repeats, partial loads, recovery and reload. The
[browser harness](../../tests/browser/hearth-cultivation.cjs) earns its opening
through public controls, then follows two investment orders from the same actual
export. It records ordinary downloads, input events and native screenshots.
Storage faults and writer contention are separate, bounded scenarios.

Static review records are retained for [custody](source-custody-review.txt),
[gameplay](source-gameplay-review.txt), [persistence](persistence-static-review.txt)
and the [independent harness critique](qa-static-review.txt).
Each names the files and hashes it reviewed; their acceptance is not an executed
test result. The final persistence recheck covers the later startup-read-only
correction to the otherwise reviewed view.

Until those gates close, the delivered v6 at
`60772b76d3a5626a32f6fdac7f7c6ecd55916814` remains the verified playable milestone.
