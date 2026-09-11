# Singularity Clicker — Stage 1: The Hearth

Design specification v0.2 • 9 September 2026 • Browser implementation authorized

## 1. Purpose and decision status

The Hearth takes the player from a small migrating hunter-gatherer tribe to a community capable of maintaining occupied camps, managing land, organizing transport, and using animal power to cultivate a field. Its emotional center is the ember carried between places, becoming a hearth people can return to.

This document consolidates the Stage 1 discussion available in this conversation. It does not claim a fresh review of the four older uploaded thread summaries or the existing implementation. On 9 September 2026, the user authorized proceeding and specified browser first, followed by macOS and iOS, with a public repository under jhacksman. Stage 0 saves must remain compatible.

Status terms used throughout:

- **Established:** explicit user requirements or directions, including their latest corrections.
- **Proposed:** concrete design recommendations that need confirmation or tuning.
- **Open:** consequential decisions not yet resolved. A recommendation is not approval.

The plow is the user's proposed endpoint and the working target for this draft. Exact victory requirements remain open. All quantities other than the approximately two-hour experience and stated visibility ranges are provisional or unspecified.

## 2. Experience and non-negotiable constraints

**Established**

- A cozy, grounded feeling of work completed: full stores, stacked wood, a built fence, and people relaxing by the fire. Not kawaii styling.
- No villager starvation, deaths, hostile enemies, or combat. Hunting remains part of the earlier requested design; its presentation is open.
- Villagers behave as autonomous, readable NPCs. Give an order and watch the full routine unfold.
- No stressful clicking. More frequent clicks must not directly accelerate ordinary assigned work.
- Approximately two hours of progression and reward on a first playthrough, with a large map and repeated visits to local levels.
- Clever planning, upgrades, and remembered knowledge can shorten completion. The pacing target is not a player deadline.
- Automation and a prestige system belong in the stage; prestige details are unresolved.
- Directly authored artwork using drawing/vector/game code. No image-generator artwork.
- Historical grounding matters. Game conventions and fictional discovery stories must not be presented as verified human history.

**Proposed atmosphere**

Warm hearth light, earthy colors, readable materials, restrained interface effects, and audible work: footsteps, chopping, tool strikes, rustling vegetation, and loads deposited into stores. Villagers rest, converse, warm their hands, and mend tools through ambient animations. Rest is not an additional needs-management system.

## 3. World structure and visibility

**Established world structure**

A large isometric hex overworld connects separate playable local landscapes. Entering a hex opens its local level, with a hearth site at its center. The tribe migrates between hexes. Local changes persist and are encountered again on return.

Exact map size, local-level dimensions, biome distribution, and fixed versus generated geography are open. Earlier small-board proposals are not binding.

**Established visibility correction**

- At normal elevation, see adjacent hexes.
- On high elevation, see up to two hexes away.
- Another high-elevation tile blocks sight beyond it.
- The former rule requiring a visit before any tile becomes visible is superseded.

**Proposed information layers**

| State | Information available |
| --- | --- |
| Unseen | Concealed terrain and resources; no destination reward labels |
| Visible but unvisited | Broad terrain, elevation, major water features, and obvious routes |
| Visited | Local landscape, discovered resources, structures, and recorded observations |
| Previously seen, out of sight | Remembered terrain; moving herds are not tracked live without observation |

Keeping revealed geography on the map is proposed, not separately confirmed. Exact sight-line handling for a target between two intervening hexes needs a consistent implementation rule. Blocking high ground is itself visible; terrain behind it is concealed.

## 4. Time and simulation

The user originally requested turn-based play and later emphasized watching autonomous work without stressful clicking. The clock is therefore a priority open decision.

**Proposed reconciliation:** fixed work intervals, animated continuously through an optional automatic-advance mode. Pause permits unlimited planning. Single-interval advancement remains available. Production, consumption, travel, regrowth, and construction share the same clock.

Proposed additional rules:

- Minigames pause background simulation; their results apply an explicit work-time cost.
- Paused time consumes no resources.
- Important migration decisions pause for attention.
- No unattended deterioration while the application is closed; offline progress, if any, requires a separate design decision.
- Remote inhabited camps and expeditions use the same world time, with safe shortage behavior.

No exact interval duration, game-day duration, season duration, or historical date rate is set.

## 5. Villagers, selection, and assignments

**Established**

Select some villagers and right-click a resource or task. Also support dragging a villager onto a target to assign work. A job has a visible clothing cue; user examples are a green woodsman's cap, a farmer's straw hat, and a miner's white cap. These are readability references, not archaeological clothing claims.

**Proposed interaction detail**

Click selects one villager; drag-box selects a group; Shift modifies selection. Hovering a valid drop or command target previews the assignment and work area. A task remains assigned until changed or completed. Exact individual-versus-group drag gestures need a usability pass.

| Target | Complete work routine | End or blocking condition |
| --- | --- | --- |
| Tree / woodland area | Gather or cut eligible wood, carry to the hearth pile, repeat | No eligible wood, inaccessible target, or full pile |
| Gathering patch | Gather known food and deliver to storage | Patch depleted or stores full |
| Cultivated field | Perform currently unlocked preparation, sowing, tending, harvesting, and storage tasks | Wait for growth, seed, tools, or capacity |
| Field stones | Remove stones, haul to storage, continue clearing selected area | Field cleared |
| Quarry deposit | Extract and haul to its dispatch stockpile | Expedition provisions or storage limit reached |
| Construction outline | Fetch materials, prepare site, build planned sections | Plan finished or missing materials |

A single-object order should show the bounded area over which it repeats. Players can adjust that area and protect objects. Do not silently interpret one tree as permission to clear the entire hex.

Blocked villagers should finish safely, put down loads, and return to camp or an allowed fallback task. A quiet status explains why. They resume when conditions permit. Work clothing remains useful for recognizing the standing assignment.

There is **no hearth-tender job**. The later automatic-hearth decision supersedes that earlier proposal.

## 6. Hearth, supplies, and safe migration

**Established hearth behavior**

The wood stockpile is always near the hearth. The hearth consumes small amounts of wood automatically as time advances. At zero stock, a grace period begins. If wood arrives, normal operation resumes. If the shortage persists, the elders say it is time to migrate. People carry the ember onward.

**Proposed details**

- Show the pile physically shrinking, then show a quieter ember state.
- Tune the grace period to accommodate a normal wood delivery, avoiding last-second rescue clicking.
- Use fuel surplus and remaining support time as calm planning information, not alarms.
- On the elders' announcement, pause and show available migration destinations.

Food and water remain resource constraints, but cannot cause starvation or death. Their exact shortage rules are open: reduced work, suspension of demanding jobs, or a migration recommendation. They must not create an unrecoverable loop where villagers cannot gather the resource needed to resume gathering.

**Required safety properties, proposed implementation**

An exhausted camp always has a safe retreat or ordinary migration route. Departure never requires provisions that can become impossible to obtain. Difficult optional crossings can require expedition supplies, but cannot be the only escape. Remote groups recall or regroup safely when support fails.

Knowledge and villagers persist through ordinary migration. Camp structures and terrain changes remain behind. Carry limits and which stockpiles travel are open. Forced migration is not prestige.

## 7. Construction and settlement layout

**Established**

The player chooses the layout, moves things, and places outlines that villagers later build. Wood fences are easier but deteriorate. Stone walls have no routine decay as the intended game rule. Field clearance provides stone slowly; quarry expeditions provide higher throughput.

**Proposed placement system**

Use a subtle local construction grid beneath the isometric landscape, with villagers moving freely along navigable routes. Drag fence runs, place gates, rotate eligible structures, and preview costs and obstructions. Keep the hearth and nearby fuel pile as the local anchor; whether that anchor can move is open.

| Object state | Proposed relocation rule |
| --- | --- |
| Unbuilt outline | Free move, rotation, or cancellation |
| Portable furnishing or cache container | Villagers carry it to the new location |
| Completed substantial structure | Dismantle, recover some materials, rebuild |
| Field or altered land | Change its designation; retain physical land history |

Construction is visible: materials arrive, sections appear, and workers finish the structure. Assigned builders can perform routine wood-fence maintenance. Repair must not become repeated manual clicking.

Pathing must preserve worker access. Warn about enclosures with no gate and inaccessible construction, and allow correction without trapping villagers. Exact material recovery and maintenance rates remain unset.

## 8. Resources and storage

**Established concepts:** wood, food, water, stone, tools, carrying supplies, storage expansion, food preservation, and later cultivation and animal provisioning.

**Proposed accounting:** track only resources that create distinct decisions. Candidate additional materials are fiber/cordage, hides, flint, and seed reserves. Avoid a separate inventory currency for every craft ingredient unless it has meaningful repeated use.

| Storage improvement | Gameplay purpose |
| --- | --- |
| Carrying bundles / baskets | More useful material per trip |
| Hearth woodpile | Visible automatic fuel reserve |
| Food stores and protected pits | Greater capacity and protection |
| Drying racks / preserved meat cache | Preserve a hunting surplus for later travel |
| Remote cache | Make future visits and expeditions easier |
| Pottery | A proposed improvement to cooking or storage; exact role and prerequisite chain open |
| Seed / fodder allocation | Preserve future cultivation and animal support |

Capacity and preservation are distinct. Goods visibly accumulate in piles, baskets, racks, or containers. Hauling consumes worker time; short routes and thoughtful placement improve throughput.

The root-cellar idea should be expressed in a period-appropriate form after chronology is settled. Spoilage, water hauling, and whether supplies are locally stored or abstracted across nearby stores remain open tuning choices.

## 9. Ecology and settlement readiness

**Established**

Each hex has an independent 0–100% transformation/readiness concept. Resources can be exhausted, creating reasons to move. Improvements make longer stays possible. Clearing all trees without foresight should make the overall run harder than preserving future growth. Experienced players can exploit this knowledge on later runs.

**Proposed model**

Separate current stocks from sustainable support capacity. The readiness indicator summarizes water access, reliable food and fuel, storage, shelter, and local or routed support. Do not award readiness simply for clearing resources. Its exact formula is open.

Woodland includes saplings, young trees, and mature trees as a readable gameplay model. Harvesting offers immediate benefit at the cost of future recovery. Rested land and retained growth support later visits. Exact seed-source, coppicing, and regrowth behavior should be tuned as a game model rather than claimed as universal forest ecology.

Players may protect individual trees early. Later proposed practices include selective harvesting, retained-cover rules, and rotating harvest areas. Careful players can learn management through observation; causing damage must not be a required unlock.

Clearing field stones yields material and cultivable ground. Hunting and grazing reduce local availability. Some tiles are best preserved as wild resource areas. A quarry may never be independently habitable and need not reach 100% readiness.

Waste areas can attract wildlife and affect future useful plant growth. Sanitation customs and disposal placement are potential discoveries. A seed-growing-from-waste event is fictional inspiration, not a verified single explanation for agriculture. Exact health consequences must obey the no-death, no-starvation, low-stress design.

## 10. Skills, minigames, and knowledge

**Established**

Hunting, gathering, and invention activities provide progression. Flint knapping is a key skill that improves tools across many activities. The first hunt is difficult; repeated practice and better equipment make later hunts much easier. Oregon Trail-like decisions provide small narrative choices.

**Proposed progression**

Experience improves action margins, information, efficiency, and tool reliability. Useful partial results prevent early practice from feeling wasted. Knapping improves tool form and usable edges; it does not make the stone material intrinsically harder.

| Skill branch | Proposed practical dependencies |
| --- | --- |
| Knapping | Cutting tools, points, digging and processing efficiency |
| Woodworking | Handles, carrying frames, fences, sledges, yokes, plow |
| Bindings | Hafted tools and assembled wooden equipment |
| Food processing | Preservation, hides and other useful hunting outputs |
| Plant observation | Gathering knowledge, tending patches, seed retention |
| Animal care | Managed animals, enclosures, draft training |
| Teaching / shared practice | Routine skilled work by additional villagers |

Mastery should enable delegation of ordinary work. Minigames can remain optional ways to improve results rather than an obligation to replay solved tasks. Exact minigame mechanics, skill ownership (individual or tribal), and teaching costs are open.

## 11. Routes, resident groups, and transport

**Established**

Eventually leave some villagers with a hearth while the mobile group continues. Provision people to gather from an adjacent tile and return. Their work must support actual local sustainability rather than creating free remote output.

**Proposed route rules**

Assign workers, destination, resource, and provisions. They are unavailable at origin while away. Travel, gathering, and return consume time. They deplete real destination stocks and deliver physical loads. Begin with manual dispatch and later permit repeating reserve-based instructions.

Carrying capacity and travel cost improve through equipment, cleared routes, sledges, draft animals, and potentially wheeled carts. Roads require labor and materials and benefit repeated travel. They are improved routes, not automatically paved modern roads.

Resident camps need their own fuel and food support. If routes fail, workers return or groups reunite safely. The interface should summarize remote reserve trends without requiring continuous switching between levels.

Exact active-camp limits, population allocation, growth, and long-distance routing are open. Adjacent-tile gathering is established; automatic multi-hop networks are not yet approved.

## 12. Exploration and the mountain crossing

**Established direction**

A fertile region inspired by the Fertile Crescent lies beyond difficult mountain terrain. It is a hidden objective/discovery, not an announced destination. Building enough expedition supplies while maintaining the camp is a resource-planning challenge. A road through the pass eventually improves access.

The herd migrates northeast. That movement can suggest following a food source. Do not substitute a scripted escaped animal from a failed hunt, and do not make this clue dominate the level. Sight lines can reveal the destination naturally from suitable high ground; there is no special visibility exception solely to preserve the surprise.

**Proposed expedition accounting**

Net reserve gain = production − ongoing consumption − other committed uses.

Travel feasibility requires both enough provisions and enough carrying capacity. Preparation must account for arrival needs, not just reaching the boundary. Establishing caches and improving the pass can reduce the burden.

The earlier example of 12 food produced, 9 consumed, and 60 needed was illustrative arithmetic only, not approved balance.

Show known requirements for the next route segment without revealing unknown destination rewards. Underprepared travel returns safely. Earlier camps remain useful after crossing. Whether reaching the fertile region is mandatory for victory is a priority open decision.

## 13. Cultivation, animals, and the plow

**Established direction**

Recurring field work, fences, managed herds, oxen as an unlock, and the plow as the suggested final achievement. Stage 2 develops agriculture more fully.

**Proposed late-stage dependency structure**

- Plant knowledge → tended patches → retained seed → repeating cultivation.
- Food surplus + reliable water/grazing + enclosures → managed herd.
- Managed animals + training + woodworking/bindings → working draft team and yoke.
- Prepared field + wooden plow + equipped draft team + support reserves → first plowing.
- Animal traction also improves hauling; wheeled transport is a separate branch, not a necessary plow prerequisite.

Animal ownership initially demands resources and work before it provides productive power. Keep breeding-herd management conceptually separate from training working animals. Exact species, breeding abstraction, feed costs, and whether animals can be lost are open; no combat or distressing animal management should be introduced by default.

**Proposed victory: The First Furrow**

Actually complete a first plowing assignment while a supported community continues functioning. Purchasing an icon alone is insufficient. Candidate checks are an occupied hearth, dependable food/water/fuel, prepared field, constructed plow, and trained team. No population count, required tile count, reserve threshold, or field area has been approved.

After completion, allow the player to linger before voluntarily entering Stage 2. What map, people, structures, skills, and inventory Stage 2 inherits is open and must be specified before building the transition.

## 14. Pacing and prestige

The two-hour target describes an ordinary first experience with many returns to familiar local levels. Avoid presenting all technologies in a quick linear checklist.

Proposed overlapping rhythm: immediate shelter and tools; return visits and preservation; gathering routes and a resident hearth; animal care and substantial transport; first plowing. Earlier minute-by-minute phase estimates were assistant proposals, not fixed requirements.

Small rewards occur through completed loads and structures. Medium rewards include a useful tool, larger store, productive return visit, or reliable route. Major rewards include a camp remaining occupied, a successful crossing, animal-powered hauling, and the plow.

Prestige is required at the project level, but its reset and reward contract is open. The earlier “carry the ember onward” new-journey concept is only a proposal. Ordinary migration must not reset knowledge or become involuntary prestige. Do not silently erase two hours of settlement building for a bonus.

## 15. Historical scope and evidence

This is a compressed thematic journey, not a claim that all inventions occurred together or in one universal sequence. Exact start and end dates in BCE remain unresolved. A plow/cattle/wheel endpoint cannot simply inherit an earlier proposed end-of-Ice-Age cutoff.

Fire is already carried from Stage 0; Stage 1 concerns its continuity and use. Cultivation and herding precede the proposed animal-powered farming capstone. Stage 2 therefore represents farming becoming central and expanding, rather than humanity discovering agriculture only after inventing a plow. Pottery and farming do not have one universal prerequisite order.

References already consulted in the discussion:

- [Wu et al., early pottery at Xianrendong](https://pubmed.ncbi.nlm.nih.gov/22745428/) — supports pottery among hunter-gatherers; not a universal pottery-before-farming sequence.
- [Gaastra et al., Neolithic cattle traction](https://eprints.bournemouth.ac.uk/33612/1/Traction%2BManuscript_revised%2Bsubmission.pdf) — informs animal traction and cautions against requiring wheeled vehicles for every use of draft animals.
- [University of Chicago, Fertile Crescent](https://news.uchicago.edu/explainer/fertile-crescent-explained) — geographical and broader historical framing; not evidence for this fictional tribe's route.
- [Smithsonian, hearths and shelters](https://humanorigins.si.edu/evidence/behavior/hearths-shelters) — fire and hearth use long predate the proposed setting.
- [Abbo et al., agricultural origins and the dump-heap hypothesis](https://link.springer.com/article/10.1007/s10722-004-7069-x) — a debated origin idea, not an established fact to present as a discovery tutorial.

These references support the limited points above. Detailed regional chronology, specific tools, and clothing require a later focused historical pass once the level boundary is decided.

## 16. Open decisions and recommended starting positions

Recommendations below are not implementation authorization.

| ID | Question | Recommended starting position |
| --- | --- | --- |
| Q1 | Automatic time, explicit turns, or both? | Gentle auto-advance with pause and optional single turns; pause in minigames and on migration decisions |
| Q2 | What is Stage 1 prestige, and when can it happen? | Optional after completion; preserve the finished world as a revisit-able save and carry limited traditions into a new run |
| Q3 | Must the fertile region be reached to complete the stage? | Make it advantageous but let another suitably developed location support the plow; confirm against intended hidden-objective role |
| Q4 | Fixed map or procedural generation? | Authored first map for pacing and sight-line quality; seed variations later |
| Q5 | How does the tribe grow? | New people join at comfortable, well-supported camps; avoid births/aging/death simulation unless requested |
| Q6 | What happens at zero food or water? | Suspend demanding work, preserve basic recovery actions, and prompt safe migration after a grace period |
| Q7 | Do remote camps keep working while another tile is open? | Yes, on the same clock, with safe recall and concise status summaries |
| Q8 | Are hunting minigames still wanted, and how explicit should hunting be? | Short, optional after mastery, non-graphic hunting; no predator combat |
| Q9 | Can the central hearth move? | Keep its site fixed within each hex; permit all surrounding layout choices |
| Q10 | Does the wheel belong here or in Stage 2? | Keep sledges and animal traction here; move wheeled carts to Stage 2 unless chronology and scope favor inclusion |
| Q11 | Which inherited benefits come from Stage 0? | Preserve its save; define a small explicit starting benefit contract rather than assuming conversion values |
| Q12 | What carries into Stage 2? | Carry the community and built world forward; establish the exact scope before implementation |
| Q13 | How much historical time does the level cover? | Compress generations through discovery without aging individual NPCs; choose regional BCE bounds after Q10 |
| Q14 | Is completion only first plowing, or a demonstrated surplus afterward? | First completed plowing plus stable camp support; harvest expansion belongs to Stage 2 |

Remaining tuning values do not all need user answers: starting population, tile count, yields, hauling limits, growth rates, storage sizes, grace periods, skill thresholds, and construction costs can be proposed together once Q1–Q6 are settled. They must remain tunable and should not be represented as approved numbers.

## 17. Design acceptance checklist

Before treating a future implementation as faithful, verify these behavioral outcomes:

- One assignment completes a repeatable gather–haul–deposit routine without repeated clicks.
- Drag assignment and group right-click commands both work and show scope.
- Supplies, work, construction, and rest are visibly readable and calm.
- The hearth consumes nearby wood automatically; no tending job exists.
- Empty supplies never kill villagers or deadlock recovery/migration.
- Map changes survive leaving and returning, and resource depletion affects later decisions.
- Normal visibility reaches one hex; high elevation reaches two subject to intervening high terrain.
- Construction outlines, gates, relocation, and blocked-work recovery support player-designed layouts.
- Adjacent gathering routes require people and provisions and consume real resource stocks.
- Manual ecological care can improve a first run; later management reduces micromanagement.
- The mountain discovery remains subtle and obeys the same visibility rules as everything else.
- The plow is a performed achievement with visible prerequisites, not an isolated purchased upgrade.
- A relaxed first run has approximately two hours of meaningful development; expert play can be faster through planning.
- Stage 1 implementation was authorized on 9 September 2026; distinguish implemented behavior from remaining design work.

## 18. Decisions accepted on 9 September 2026

The user said “make it so” in response to the six recommended defaults. Proceed with automatic time plus pause/single-step; optional post-completion prestige preserving finished worlds; an advantageous but optional fertile-region discovery; newcomers joining comfortable camps; food/water shortages suspending demanding work and eventually prompting safe migration; and an authored first map. These resolve Q1–Q6 in the recommendation table. Q4 here refers to authored geography; Q5 refers to newcomers; the previous user-facing six-question list used a different order.

All stages target browser, macOS, and iOS. Browser comes first. Public source belongs under jhacksman. Platform architecture and current implementation boundaries are documented in platforms.md. Other open decisions and numerical tuning remain open unless explicitly implemented as provisional values.
