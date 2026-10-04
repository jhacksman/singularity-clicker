# Construction follow-up after Spark 036

Spark job `singularity-20261004-construction-unit-036` tested immutable commit
`bc12f3aa684ecd1092f665de11e80ed1dc147702`. Syntax passed for 40 files. The suite
reported 189 tests: 187 passed, 2 failed, none skipped. Its final top-level build
did not run because the command used `&&`. Returned root `dist` files were
preexisting committed output and must not be presented as a construction build.
The original job and failures remain preserved. Jobs 037–042 were held.

Both failing tests needed QA corrections. The exact Tools018 labor test parked
only the measured workers, leaving former builders on the workshop edges. The
game could legitimately route an artisan away from an occupied edge before work
started. The corrected setup moves nonparticipants away through ordinary orders;
it retains the exact ready-worker, paid-cost, work-rate and final-cap assertions.

The intrinsic-purity test compared entire descriptor tables with Node's deep
comparison. Descriptor tables for Map.prototype own Symbol.toStringTag with a
fresh descriptor object, which Node 24.20 compares by tag identity. Unchanged
snapshots therefore failed before malformed-save rejection was checked. The
corrected oracle compares own keys, prototype, extensibility and descriptor
fields by exact identity, with no-op and disposable-mutation controls. All
source/pickup identity variants, constructor rejection and input preservation
remain required. This explanation does not make job 036 a passing purity test.

Independent gameplay review found a separate display issue: workers that arrived
before the final supply load could keep saying “Waiting for site supplies” while
performing installation. The engine now updates their reason on the tick when
they actually install. A focused ordinary-command regression follows the same
three waiting workers through the final receipt, installation and exact reload.
The preserved old engine must fail at the named status assertion. Placement
guidance also discloses the existing 24/32 worker-seconds before commitment; the
delivery qualifier applies only to physical construction. Prices, work, cargo,
travel, finite deposits and the original art are unchanged by these follow-ups.

The original one-versus-four browser experiment measures parallel construction
speed with otherwise idle villagers. A separate supplementary browser harness
compares three practical policies from identical earned Journey bytes: build
first, split construction and food gathering, or recruit before construction.
Every policy ends with a usable eastern outpost, five villagers paid for with
actual Hearth food, and at least 20 newly gathered wood received there. Reports
retain remaining deposits, excess food, outstanding cargo and common setup time.
The comparison neither assumes a winner nor establishes an optimal policy or
human enjoyment.

Spark witness 035 separately succeeded using QA commit
`e1d5c858b9d97a8528dd12b6ab726ea38d3dfc85`, whose production source is pinned to
`4c3ac2f6c16ce58563f0300f286040a7aae0a963`. Independent source/hash/image review
accepted it as a genuine freshly earned v5 unfinished paid outpost: 0.1 of 24
work, 60 wood/20 stone paid, 56 wood/50 stone remaining. Its raw save SHA-256 is
`584a073cd5779901e2cb8d560c30ef72a991b15f39197f39aff69bd840c72a03`.
This controlled-clock witness is neither historical player behavior nor proof
that the new version migrates it correctly. Reuse its complete evidence tree;
do not regenerate it or reuse failed job IDs.

All corrected-source runtime gates, expected negative assertions, browser
journeys, migration behavior, visual review and allocation measurements remain
pending new coordinator-run Spark jobs. M6 work is limited to source review,
editing, Git, hashes, archives and viewing returned images. The verified prior
playable artifact remains the 4c3ac2f6 milestone until these gates pass.
