# Hearth physical construction

This bounded increment builds on the verified `4c3ac2f6c16ce58563f0300f286040a7aae0a963` Hearth opening. New outposts and workshops reserve goods in actual stores. Assigned villagers fetch five-item loads, deliver them onsite, and then perform the existing installation work. Costs remain 60 wood / 20 stone / 24 worker-seconds for an outpost and 40 wood / 30 stone / 32 worker-seconds for a workshop.

It completes the opening's missing material-delivery step. It does not implement the later individual tools, baskets, support, housing or invitation economy, and does not establish human pacing or enjoyment. Existing finite resources, authored Canvas art, Tools018 extraction rates, movement and return-first work orders remain.

## Material ownership and orders

Source reservations remain part of actual store inventory and reduce available stock. Pickup moves goods into a villager's tagged cargo. Delivery moves them into onsite supplies. Only complete delivery followed by installation moves the recipe into spent capital; a new outpost then receives its recovery claim from the delivered source snapshots.

Move immediately carries and holds construction cargo. Stop or a different work order returns it physically. A return to an active site's store reserves the returned load for that same site at the receiving store. Cancel releases only unpicked reservations immediately. Onsite and carried supplies need physical recovery; unrelated queued orders retain their authority. A cancelled queued Build becomes an explicit Idle successor so that an older order cannot resume accidentally.

The site inspector reports reserved, en route, onsite and work separately. Original Canvas drawing primitives display onsite material stacks before installation begins. `#site-cancel` starts recovery and becomes disabled while cancellation settles; `#site-recover` assigns selected villagers to resume that recovery.

## Saves and compatibility

Version 6 uses `construction.profile = accepted-opening.physical-construction.v1`. Certified version-5 saves gain an empty construction ledger without changing their existing material or work state. Existing unfinished jobs keep their original prepaid completion and full-refund terms. Earlier supported saves follow their existing migrations and certification; uncertifiable legacy camps remain playable in legacy mode.

The controller retains exact source bytes in the `before-v6` and `import-before-v6` families before adopting a replacement. Outgoing live, stored and rejected sources have separate version-6 backup families. Native navigation exposes those exact original sources. Version 7 is unsupported, and malformed version-6 authority must be rejected rather than normalized.

## Verification boundary

Implementation and regression authoring on M6 are source-only. No candidate execution result is asserted by this document. Spark execution requires an immutable commit, coordinator review and the established isolated browser runtime. The last verified playable revision remains the baseline above until the candidate's returned evidence is reviewed.

The deterministic gate is:

```sh
node scripts/check-syntax.cjs
node --test tests/*.test.cjs
node build.mjs
```

`tests/hearth-construction.test.cjs` covers fixed-inventory arithmetic, source reservations, pickup races, manual overrides, cancellation, source retirement and exact save continuation. Its pinned version-5 engine fixture is checked by SHA-256 and executed only on Spark. Those API-earned migration cases are distinct from an ordinary browser witness.

`tests/browser/hearth-construction.cjs` requires an ordinary fresh journey through eastward construction, a workshop, paid tools and useful subsequent gathering. It records Journey exports, material transitions, trusted inputs and screenshots. Supplementary comparisons and cancellation replays use exact previously earned exports through the import control. Full acceptance also requires a separately earned unfinished paid-site witness from the immutable version-5 source; absence is reported as pending, not passed. Existing startup, recovery, movement, storage, outpost recovery and native navigation browser suites remain regression gates.

No publication, deployment, main merge or GitHub-hosted execution is part of this change.
