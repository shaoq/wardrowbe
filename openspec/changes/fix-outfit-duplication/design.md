## Context

AI-generated recommendations and pairings currently trust the model to follow prompt rules, then perform limited post-processing before saving outfits. Recommendations remove repeated item ids and call `deduplicate_by_body_slot()`, but they do not verify uniqueness across the three returned options. Pairings call body-slot de-duplication, but do not first remove exact duplicate item ids and do not compare newly generated combinations against existing pairings for the same source item.

The current body-slot utility prevents conflicts such as pants plus shorts, while allowing layering such as shirt plus cardigan. That behavior is useful, but the system does not validate that an outfit remains complete after post-processing removes conflicting items.

## Goals / Non-Goals

**Goals:**

- Provide one shared backend validation path for AI-generated recommendation and pairing item selections.
- Reject or skip generated options that contain duplicate exact items, duplicate key pieces across a batch, repeated historical pairing combinations, or incomplete outfits after cleanup.
- Keep valid layering possible while making mutually exclusive roles explicit and testable.
- Improve small-wardrobe behavior so recent item repetition is still considered when fewer than 50 items exist.

**Non-Goals:**

- Replacing the AI recommendation model or prompt strategy.
- Adding new user-facing controls for duplicate tolerance.
- Changing the public API response shape.
- Adding database tables or migrations unless implementation discovers an unavoidable persistence need.

## Decisions

### Use a shared outfit validation helper

Create a backend helper near `app.utils.clothing` or a small service-level utility that accepts selected item ids plus item type metadata and returns a validated result. The result should include cleaned item ids, role composition, key-piece fingerprint, and validation errors.

Rationale: recommendation, pairing, and future generated outfit flows need the same rules. Keeping rules in one helper avoids recommendation and pairing drifting apart.

Alternative considered: add local checks inside each service. This is faster initially but preserves duplicated rule logic and makes future slot changes error-prone.

### Treat exact item duplicates as invalid input, not just harmless noise

The helper should remove repeated exact item ids for safety, but callers should log this as a generation-quality issue. Pairing generation should not save combinations that only become valid after collapsing repeated exact items unless the final outfit is still complete and unique.

Rationale: exact duplicates usually indicate malformed AI output. Silent acceptance hides model or prompt failures.

Alternative considered: hard-fail the whole request when any duplicate appears. That would be strict but could unnecessarily fail a batch where other generated options are valid.

### Compare generated outfits by key pieces

For uniqueness within one recommendation batch, compare key-piece fingerprints rather than every accessory. Key pieces include `full_body`, `base_top`, and `bottom`; footwear can remain part of the full combination fingerprint but should not be the only source of distinctness.

Rationale: users perceive two looks with the same shirt and pants but a different hat as repetitive. Accessories alone should not make an outfit distinct.

Alternative considered: compare full item sets only. That would allow near-duplicates with small accessory changes.

### Compare pairings against existing source-item combinations

Before saving generated pairings, load existing pairings for the same user and source item and build normalized fingerprints from their item ids. Skip any new generated pairing whose normalized full combination already exists.

Rationale: repeated clicks on "generate pairings" should produce new usable combinations rather than duplicates already stored in the pairing list.

Alternative considered: rely on the AI prompt to be varied. Existing behavior shows prompt-only uniqueness is not reliable enough.

### Preserve layering by role, not prompt wording alone

Keep `base_top`, `mid_layer`, and `outer_layer` distinct roles unless product requirements later decide cardigans, vests, or hoodies are mutually exclusive with base tops. Update prompts to match code roles so the model does not receive contradictory slot guidance.

Rationale: layered outfits are valuable, especially in cold or rainy weather. The current code already allows layering; the prompt should not describe all layer garments as one top slot if the product accepts layering.

Alternative considered: collapse all upper-body garments into one `top` slot. That would reduce perceived duplicates but would also block valid layered looks.

### Score small wardrobes instead of bypassing scoring

Remove the early return that bypasses scoring when fewer than 50 candidate items exist. Keep the top-N truncation behavior only when there are many candidates.

Rationale: most real users have fewer than 50 ready items early on, so recent-wear and underused-item logic must still apply.

Alternative considered: leave small wardrobes unchanged because scarcity naturally causes repetition. Scarcity is real, but the system should still choose the least repetitive valid option available.

## Risks / Trade-offs

- Stricter validation may return fewer generated pairings than requested -> The API already reports the generated count; tests should cover partial success.
- Small wardrobes may not have enough unique key pieces to satisfy all requested options -> Fall back to fewer valid options rather than saving duplicates.
- Fingerprint rules can be subjective -> Keep key-piece and full-combination definitions small, explicit, and covered by unit tests.
- Prompt and backend role definitions can drift again -> Add tests for role coverage and update prompts alongside utility changes.

## Migration Plan

This change should be deployable without data migration. Existing duplicate outfits remain in history; new generation should avoid creating more duplicates. Rollback is code-only: revert service and utility changes, with no schema rollback.

## Open Questions

- Should existing duplicate pairings be cleaned up in a later maintenance task, or left untouched as historical data?
- Should users be able to explicitly request "more variety" beyond the current `variety_level` preference in a future UI change?
