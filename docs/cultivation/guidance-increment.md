# Moving stored water to the Hearth

This increment addresses the observed guidance gap after water has already been
collected into an Outpost while the Hearth still lacks local support supplies.
It changes presentation only. The accepted paid-pilot milestone at
`f65350d3a9d47a6b9a327af6cc54350f139c93a2` and its actual073 evidence remain preserved.
The new candidate still requires its own Spark validation and public journey.

When the current support quote or following-crop deficit needs water at the
Hearth, the opportunity can name a reachable Outpost with unreserved stored
water. **Bring stored water to the Hearth** offers an inspection of that store.
The hint tells the player to select empty-handed villagers, choose Hearth store
and water, review the existing carrier preview, and use **Send selected carriers**.
The entire missing vector remains visible: one available load may only help with
the shortage. Water becomes available at the Hearth when the carriers deliver it.
The player then reviews the support quote again.

Inspection keeps the existing selection, orders, cargo and supplies. The hint
does not move goods, confirm support or plant a crop. It does not recommend
committed, carried, unreachable or retired-store supplies as free water.
Existing planting recovery, yield collection, carried-yield delivery and woodland
harvest take priority over funding the following crop. A growing paid crop keeps
its phase and countdown while the hint describes supplies for the following crop.
When the support quote is ready, the initial opportunity asks the player to review
that quote instead of repeating the collection/discovery instruction.

The engine, jobs, ledger, save schema, rates, recipes, art and original RTS page
are unchanged. The new read-only `guidance.js` module is embedded only in the
cultivation HTML. Its formatters retain the original missing-vector rounding and
maximum-per-resource treatment; overlapping water obligations are not added twice.

Seven new targeted tests cover named-source guidance, partial supplies, full
shortage display, invalid quantities/units, current reservations/routes, funding
restoration, paid-work priorities, and an actual engine-earned transfer with
cargo and save/load preservation. These are authored checks, not passing results.
Run only through the parent/coordinator's existing Spark image:

```sh
node --check src/hearth-cultivation/guidance.js
node --check src/hearth-cultivation/view.js
node --check build.mjs
node --test tests/hearth-cultivation-guidance.test.cjs
node build.mjs
```

After the returned build is pinned, one public journey will inspect the original
earned water shortage, reimport the latest accepted actual073 camp, and perform
one new paid pilot cycle with partial-job refresh and real food/retained-seed
receipts. The former harvest and unchanged test suites are not replayed. The
270-second proposed outer bound covers the known 90-second foreground growth and
ordinary planting, travel, import, refresh and preservation; the coordinator must
admit those limits before execution. No clock acceleration or resource fabrication.

The resulting self-contained pages, ordinary camp export, checksums and concise
player instructions are intended for a local playable package after verification.
No deployment, main merge or blocked Library upload retry is authorized here.
This local preview still does not unlock First Furrow or Agriculture or implement
the full ages-to-ASI campaign. Further shortage/exhaustion and order combinations
remain separate coverage limits.
