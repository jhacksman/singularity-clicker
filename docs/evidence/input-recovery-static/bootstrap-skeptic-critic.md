# Independent bootstrap disproof review: P-02 and P-03

Immutable source: `f93798b3cd5b3f38697e1696a058e55e449b676d`. I read the relevant engine/view, existing recovery-test source, storage acceptance notes, and `post022-persistence-candidates.md`. I did not read another bootstrap skeptic's report. No implementation edit, parser, application runtime, test, build, lint, or browser execution occurred on M6.

**Verdict: both candidates survive disproof within their stated scope. P-02 is Medium startup availability under storage-access denial. P-03 is Low preservation of present invalid bytes, with no demonstrated legitimate-progress loss. Runtime reproduction remains pending.**

## P-02: persistent storage denial escapes recovery

`src/hearth-rts/view.js:6` wraps the first `localStorage.getItem(KEY)` in a try, but its catch starts with the same expression outside another guard. A persistent failure therefore throws again before `game`, `blocked`, and `paused` are assigned their recovery values. Initialization exits before the later input/Journey/Export/Import handler assignments, `ui()`, and animation loop. Function declaration hoisting does not execute those assignments or invoke recovery.

This is not limited to inventing a throwing `getItem` method. The HTML Standard specifies a `SecurityError` from the **window.localStorage getter** when the document has an opaque origin or access violates a browser policy decision. Both expressions evaluate that getter before accessing `getItem`. Repeating it does not repair a persistent origin or policy restriction. [HTML Standard: localStorage getter](https://html.spec.whatwg.org/multipage/webstorage.html#dom-localstorage-dev)

The distinction matters for evidence: native `Storage.getItem` is specified as a lookup returning a stored string or null, so a monkey-patched method that always throws is a controlled fault fixture, not by itself evidence of the native method's ordinary behavior. A throwing storage getter accurately covers the standards-defined route. I do not claim the currently hosted preview uses an opaque origin or that ordinary top-level browsing with storage permitted fails. The defect concerns genuine supported browser restrictions, with a separate runtime fixture needed to establish observed UI behavior.

Attempted rebuttals do not defeat that case:

- A one-shot read failure may succeed on the catch's second read; the report explicitly concerns persistent denial.
- The guarded `save()` at line 10 handles later writes, but initialization never reaches a call to it after the second read throws.
- Storage-event, visibility, and pagehide listeners are attached later and provide no outer startup exception boundary.
- No write occurs in the failing path, so this is not proof of destroyed saved bytes. Access restoration and reload can still recover an existing save.

Medium is appropriate for losing the complete usable startup/recovery UI under a real access restriction. It is not evidence that the app must provide persistent storage when the browser forbids it; it should still accurately explain that restriction instead of aborting before recovery controls attach. The already-passing write-quota fixtures do not exercise this route.

## P-03: a present falsy payload is mistaken for absence

The same bootstrap line makes two truthiness decisions: `raw ? JSON.parse(raw) : null`, then `state ? new Camp(state) : new Camp()`. Consequently the following present values avoid rejection and select a fresh camp:

| Present stored bytes | Parsed result | Bootstrap effect |
| --- | --- | --- |
| `null` | null | Fresh camp |
| `false` | false | Fresh camp |
| `0` (also `-0`) | zero | Fresh camp |
| `""` | empty string | Fresh camp |
| zero-length stored string | Parsing skipped | Fresh camp |

These cases leave `blocked=false`; migration backup conditions are skipped. Initial `save()` at line 88 then calls the unconditional serialization/write at line 10. If writing succeeds, the present original bytes are replaced by a fresh valid camp without rejected-raw recovery. In contrast, malformed JSON or a truthy invalid object throws and normally enters the retention path.

Absence is specifically the null **return value** from `getItem` for a missing key, not a present string containing JSON `null`. The Storage API distinguishes those cases. [HTML Standard: Storage.getItem](https://html.spec.whatwg.org/multipage/webstorage.html#dom-storage-getitem-dev)

The strongest severity rebuttal succeeds: none of these values encodes a legitimate earned camp. Normal engine serialization emits an object. The source does not establish ordinary gameplay spontaneously producing these payloads; corruption, foreign/old code, or deliberate fixture seeding is required to reach this stored-input class. Therefore retain Low severity and do not describe it as loss of valid progress. It remains a real exception to the intended retention of rejected/corrupt raw input, rather than another ordinary-play blocker like P-01.

Two existing truthiness checks must be considered when independently verifying any later correction:

1. `Camp` itself uses `if(state && !valid(state))` and `state ? structuredClone(state) : fresh()` (`engine.js:50`). Merely routing a parsed false/null/zero value into that constructor does not cause rejection.
2. Export uses `rejected || game.serialize()` (`view.js:77`). Merely preserving a zero-length raw string in `rejected` still selects the fresh fallback on export. JSON text `""` is two bytes and truthy; a zero-byte stored value is the separate retention case.

These observations are closure criteria, not implementation changes or a selected remedy.

## Targeted Spark evidence needed

- Exercise persistent KEY read denial and, separately, the storage getter denial. Capture errors and verify initialization reaches an honest unavailable-storage/recovery UI with working controls. Verify seeded underlying bytes remain unchanged after access is restored by the fixture. Do not require an original-save export when the application never successfully read those bytes.
- Exercise absent KEY separately from each present falsy JSON value and a zero-byte value. Confirm only actual absence starts a fresh camp; present invalid bytes remain exact, including an exact zero-byte recovery download if that retention contract is adopted.
- Retain the existing valid-load, raw migration, backup-write, main-write, import, and paused recovery tests. Their previous passes remain evidence for those cases, not these newly inspected ones.

No broader UX, migration, or storage finding was re-reviewed or fixed here. This report is a fresh skeptical disposition before any startup fix.
