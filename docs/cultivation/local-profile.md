# Local cultivation continuation — implementation proposal

Status: implementation contract frozen after independent gameplay and numeric
review, 2026-10-05. Not a shipped or tested milestone.
Base: accepted `60772b76d3a5626a32f6fdac7f7c6ecd55916814`.
Authority: frozen all14 spec in task-11, EM01, Level 1, Rules R2.1–R2.5.
This document selects bounded local compatibility behavior; it does not amend
the frozen full-campaign specification or certify its implementation.

## Useful scope

After the earned opening, offer **Tend a supply patch**. Actual workers collect
water and six discovered seed, plant a pilot crop, carry home six food and two
retained seed, and can then plant a woodland plot producing eight wood and two
retained seed. Both recipes are repeatable with paid inputs and work. Food crops
and wood renewal compete with finite gathering for labor, water and seed. Each
recipe occupies its own fixed bed; this scope does not claim a land-allocation
tradeoff between those two beds.
Unattended foreground growth can overlap existing ordinary gathering/building;
there is no compulsory idle countdown or claim of a full Hearth completion.

Defer baskets, fiber recipes, shelters/invitations, ordinary/sharp tool conversion,
practice, regions, animals, plow, routes and Agriculture. Inherited people and
Tools018 remain. Post-activation new recruitment is unavailable, disclosed before
confirmation, because shelter/invitation rules are not implemented in this preview.
The exact unchanged v6 profile remains preserved and exportable.

The gameplay acceptance witness delivers two crop outputs and one woodland output,
uses actual harvested food/wood for supported work, and retains a funded next crop
cycle. These are witness outcomes, not a new arbitrary unlock timer or age-exit gate.
First Furrow still requires the actual supported hearth, prepared field, trained
team, installed plow, completed furrow, repeating support route and reserve proof.
Opening `complete` keeps its existing funding/checklist meaning. No navigation
handoff, population copy, Agriculture seed grant or campaign-root claim is added.

## Profile, adoption and authored content

One live selected camp state, one writer for its save slot, explicit opt-in after
current opening. A separate `singularity-clicker.hearth-cultivation.v1` single-key
envelope holds the adopted state and exact source bytes together; the existing
v6 key and bundled executable remain an isolated unchanged history. Histories
cannot exchange or merge materials/people. Schema7 / engine `local-cultivation.v1`
/ content `local-cultivation-map.v1` / numeric `whole-pantry-slot100.v1` is the
only accepted new tuple. Import/adoption/reload must not duplicate people, source
stock, seed, paid work, crop output, or support activation. Unknown future content
is retained for export, not played with borrowed rules.

Migration preserves IDs, positions, paths, standing orders, held cargo, physical
construction/recovery/transfer reservations, paid partial Tools018 and the global
earned .45 extraction entitlement. No retrospective debit. A source too damaged
to certify stays in its existing supported profile. No forced stop/reset or grant.

New local authored content is a declared bounded preview mapping of EM01, not a
claim that the southern region already exists: one fixed water source (30-unit
initial *source pool*, no stored-water grant), one pilot plot with its finite
six-seed cache, and one initially unavailable woodland plot. Local content row:
pilot bed at(11,17), woodland bed at(14,17), each2×2; seed cache at(10,18);
water intake at(17,12). Those are new authored preview cells, not a claim that a
southern region already exists. New beds and intake/cache cells remain walkable;
they reserve ground against new building footprints, without altering old paths.
These coordinates require static access/collision review and Spark tests. Existing occupied cells are
never overwritten; opt-in is refused with a specific safe remedy if authored sites
are obstructed. The site's seed cache is revealed by inspecting the cultivated
patch, then physically collected. Inspection does not add stock. Water regenerates
at 6/minute into capacity30, only on foreground ticks, with bounded exact remainder.
Other finite deposits never refill. Woodland is available after a completed pilot
batch's first food is physically receipted into a real store, under this explicitly
named local content mapping. Inspecting, planting or maturation alone do not unlock it.

## Material and support accounting

Retain whole physical item units for existing stock/cargo/recipes. Use distinct
physically located support pantry custody in integer milliunits plus persisted
rational rate remainders. Moving a whole item from a store into that pantry is a
custody transfer, not consumption or refundable structural spending. Only actual
demanding work consumes support. The global conservation equation includes whole
stock, reserved stock without double counting, actor cargo, staged inputs,
workpieces/capital, output trays, source remainder, pantry, consumed support and
declared recipe production. No projection may disguise pantry/consumption as stock.
All current v6 validation remains exact; new profile has its own stronger checks.
Legacy floating movement/work is an explicitly retained standalone compatibility
limitation. This is not canonical all14 fixed-point root/IndexedDB conformance.

**Provision this camp** previews prospective rules and activates only on explicit
confirmation. Demand: active tool-assisted extraction, construction/Tools018 work,
planting and woodland harvesting. No demand from walking, bare gathering, hauling,
handling, idle/blocked workers, growth alone, pause, hidden time or dormant camp.
Each demanding worker consumes1 food +1 water per300 worker-seconds; one active
camp consumes1 wood/minute regardless of the number of demanding workers.
Stable actor-ID ordering; compute eligible work before debit; completed/stalled
work cannot burn an extra tick. Preserve exact remainders across actions/reload.
The admitted support quantum is one100-ms advancing work slot. Existing floating
work is preserved bit-for-bit on adoption: an unfinished legacy job that advances
in its allocated slot consumes that slot and completes at its end; later workers
receive no slot after completion. Support counts allocated labor time, separately
from nominal progress clamped at the old job limit. This explicit bounded local
compatibility rule avoids inferring or rounding arbitrary imported residuals.
New cultivation work/growth uses exact integer milliseconds in100-ms ticks.

Recovery floor for this one resident camp: actual roster N protects N food, N water
and4 wood (versioned local scaling choice; four-person case equals EM01). Protect
the additional exact next-cycle and active finish/return obligations separately.
Support can use only physically local supplying stock/pantry above the floor and
job reservations. Never pool remote outpost stock for an instant support payment.
At floor, inherited Tools018 stays owned: same gathering order/source/cargo/work
continues at bare .60 with **Recovery pace — waiting for support**. It resumes .45
when the next fully funded support quantum exists. New water/seed collection is
bare work. Only the Hearth store b0 supplies this one resident camp; distant
outpost goods must be physically transferred first. Confirmation authorizes
automatic pantry top-ups from b0's eligible unreserved whole stock as needed for
the next admitted quantum. A transfer is exactly1000 milliunits, never a charge.
The pantry remains at b0. Whole uncommitted pantry units may return to b0;
residual fractions and accrued liabilities remain owned, visible and spendable
on future support. Stop/cancel does not discard them. b0 cannot be retired.
Use checked BigInt for new support/water ledger values, decimal strings on wire.
Each worker food/water slot accrues1/3 milliunit; each active camp slot accrues
5/3 wood milliunits once. Admission compares exact rational effective material,
including old liability and the prospective debit, against protected obligations.
Posted integer debits and rational remainders are persisted, never rounded away.
No free zero-posted-debit slot is admitted at a floor.

Browser persistence uses a held Web Lock for the new slot; another tab is read-only.
When locks are unsupported the new profile remains exportable/read-only, with a
specific explanation. Candidate adoption/import is staged and validated, then
the single archive+state envelope is durably written before becoming live. Quota,
read or write failure preserves the former live state and exact export. A
read-before-write comparison alone is not represented as a writer fence.

## Cultivation jobs and recovery

Pilot:2 seed +3 water;90 worker-seconds planting;90 foreground growth seconds;
output6 food +2 seed at its physical plot. Woodland:2 seed +4 water;
30 worker-seconds planting;300 foreground growth seconds;20 worker-seconds
harvesting;output8 wood +2 seed at its physical plot. No extra yield multiplier,
free water, refill button or unrecorded output-to-store teleport.

Inputs reserve at their actual store, are carried/staged by named workers, and
become one identifiable paid workpiece at processing start. Interruption/Stop/
reassignment keeps paid inputs and completed work. Resume charges only remaining
work/support. Repeated job clicks do not re-pay or accelerate. No new batch until
the previous output is physically removed; finite plot output tray holds exactly
one batch. Planting workers return to idle when growth starts; they are available
for ordinary useful work. **Collect crop** / **Collect woodland yield** assigns
selected workers to physically remove the current output. Each pickup takes only
one resource, up to5; retained seed has deterministic priority, then food/wood.
The standing collection order repeats until the whole tray is empty, delivering
each load into a real store. A partly collected tray survives Stop/reload. **Resume
planting** and **Harvest woodland** name their actual phases; selecting another
worker never changes paid inputs, workpiece or output identity.
Cargo still max5 and obeys the accepted explicit Move/Stop/legacy
return-first work-switch contract. Seed stays protected in inventory, actor cargo,
workpiece and output. Cancelling unstarted reservations releases once; started
work is resumable rather than refunded into both seed and a future harvest.

The chosen next crop certificate includes2 retained seed,3 water plus its complete
remaining supported work and safe delivery; trees cannot consume the last funded
food-cycle path. Protect the actual seed lineage, local accessible water and output
space. Existing optional construction/recruitment cannot consume protected funds.
When current adopted stock cannot satisfy activation, quote the missing vector and
ordinary gathering/reclaim remedy. Do not repair depleted imports with rescue goods.

Concrete finish bound:90,000 demanding worker-ms needs300 milli food,300 milli
support water and at most1500 milli camp fuel with one worker. Adding helpers may
reduce actual union fuel; it never increases this bound. Before planting admit the
whole2 seed/3 water recipe and this support vector as one protected obligation.
Recipe water is consumed once at first planting; the same two seed remain owned
inside the workpiece, then output tray, then carried/stored seed. Seed is not
consumed and regenerated. Food6/wood8 is typed recipe output recorded once.
Trees require the extra2 seed/4 water and support for50,000 worker-ms (food/water
ceil(500/3)milli, fuelceil(2500/3)milli bound with retained actual remainder).
The current food-cycle seed pair stays protected even while the tree is funded.
Keep one named NEXT pilot certificate as well as each ACTIVE job's remaining
finish reservation. NEXT protects separate3 recipe water +300 milli food/300
support water/up to1500 fuel above floors; its future seed pair is the retained
pilot lineage, unavailable to trees, not a duplicate seed inventory. Normal first
pilot admission funds current AND next:6 recipe water +600 milli food/600 support
water/up to3000 fuel above floors, with one reusable seed pair for the serial bed.
The quoted bound is explicit; remaining ACTIVE allowance releases on completion,
while NEXT remains owned. Other jobs reserve their additional inputs/support.

The NEXT certificate is usable even when another future certificate cannot be
funded. **Plant protected recovery crop** atomically promotes NEXT to ACTIVE
without requiring its replacement. Mark the following NEXT unfunded, keep the
pilot seed lineage, and block discretionary Tools/construction/tree spending
until ordinary gathering or existing committed production restores it. Existing
funded jobs may settle; no automatic crop, grant, retrospective bill or cancel.
Inherited tool-assisted extraction also uses bare recovery pace while NEXT is
unfunded. Already-paid legacy construction/Tools work is preserved and may safely
pause when prospective support is unavailable; it is not retroactively assigned
a new full-finish escrow. Optional new legacy construction/Tools purchases retain
all cultivation/floor holds and may likewise pause. Their material quote is not
advertised as a reserved complete support bill; the full-finish promise belongs
to the named cultivation authorizations in this local profile.
This guarantees the quoted paid continuation, not indefinitely many crops after
finite sources/certified buffers are exhausted. UI names the missing next vector
and actual ordinary replenishment options. No inaccessible 'protected' stock
may block the very recovery action it authorizes.

## Required evidence and ownership

Independent design critique before source edits; independent numeric/custody review
before freezing accounting. Unique isolated branch from60772. Preserve v6 source,
Library v6 and existing artifacts. No publication/push/main merge. All runtime
validation only through parent/coordinator on Spark, no local parser/build/test.

Deterministic tests: exact rates/remainders and resource equations; support floors
and bare fallback/resume preserving work/cargo; no charge when inactive; physical
job custody at reserve/pickup/stage/work/growth/output/receipt; exact-once outputs;
repeat/cancel/resume/import/refresh; finite seed and bounded water; old4–8 people,
partial tools, transfers, building/reclaim cargo; unknown profile rejection; failed
save and stale source; no full-age unlock. Browser evidence uses ordinary controls,
actual exports, screenshots and event traces, complete useful outcomes and two
feasible investment orders. Generated fixture values are not earned-journey proof.
Record exact tested commit, commands/results and remaining limits.
