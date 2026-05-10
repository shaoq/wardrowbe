## Context

Clothing analysis currently produces structured tags for type, subtype, color, pattern, material, formality, style, season, and fit. Recommendations use weather, season, material, type, formality, recency, preferences, and learned feedback to rank candidate items, then send the ranked item list to the AI outfit generator.

The current data model can tell that an item is a sweater, wool, or winter-tagged, but it cannot reliably distinguish thin knitwear from heavy knitwear, lightweight outerwear from insulated coats, or breathable summer pants from warm lined pants. The existing `tags` JSONB field can carry new metadata without an immediate database migration, but the parser and worker must explicitly preserve new fields because unknown AI output keys are currently discarded.

## Goals / Non-Goals

**Goals:**

- Add AI-generated comfort metadata for `fabric_weight` and `warmth_level`.
- Allow comfort metadata to be corrected by users without requiring manual input during upload.
- Make recommendations prefer weather-appropriate items and reject clearly incompatible generated outfits.
- Preserve recommendations for small wardrobes by falling back to lower-confidence inference when explicit comfort tags are unavailable.
- Avoid reusing cached suggestions when weather or season context has changed materially.

**Non-Goals:**

- Do not require every existing item to be reprocessed before recommendations continue working.
- Do not add a required upload-time form for comfort metadata.
- Do not replace the existing `season`, `material`, or temperature preference model.
- Do not introduce a new external AI or image processing dependency.

## Decisions

### Store comfort metadata in `tags` JSONB first

Use the existing item `tags` JSONB for:

- `fabric_weight`: `sheer`, `lightweight`, `midweight`, `heavyweight`
- `warmth_level`: `cool`, `light`, `medium`, `warm`, `heavy`
- `comfort_tags_source`: `ai`, `user`, or `inferred`
- `comfort_tags_confidence`: numeric confidence between `0.0` and `1.0`

Rationale: recommendation logic can read these fields without schema churn, and the frontend already receives `tags`. If later wardrobe filtering or analytics need indexed queries, these fields can be promoted to typed columns.

Alternative considered: add first-class columns immediately. That would improve queryability but adds migration cost before the product behavior is proven.

### Treat AI comfort tags as editable predictions

AI analysis will output comfort fields automatically. User edits will set `comfort_tags_source=user` and `comfort_tags_confidence=1.0`. Recommendation scoring will prefer user tags over AI tags and AI tags over inferred tags.

Rationale: single-image analysis cannot reliably detect lining, fill, fabric thickness, or actual warmth for ambiguous items. User correction must be easy and authoritative.

Alternative considered: make users fill warmth and thickness manually during upload. That would be more accurate but adds friction to the core wardrobe capture flow.

### Use explicit tags first, then deterministic inference

When explicit comfort tags are missing, recommendation scoring will infer a comfort profile from item type, subtype, material, and season. Examples:

- `coat`, `sweater`, `hoodie`, `wool`, `fleece`, `winter` imply warmer defaults.
- `tank-top`, `shorts`, `sandals`, `linen`, `silk`, `summer` imply cooler defaults.
- Unknown or ambiguous items remain usable but receive lower-confidence scoring.

Rationale: existing wardrobes need immediate compatibility, and inference is good enough as a fallback signal.

Alternative considered: require batch reanalysis before enabling weather-aware filtering. That would delay value and create operational complexity.

### Score and validate for weather suitability

Recommendation scoring will use comfort tags to rank candidates. Generated outfits will also be checked before persistence so the AI cannot choose a clearly inappropriate item merely because it appeared in the prompt. The validation should reject only severe mismatches unless no complete outfit can otherwise be generated.

Rationale: ranking alone cannot guarantee the AI respects weather constraints, but overly strict filtering would fail users with small wardrobes.

Alternative considered: hard-filter all incompatible items before prompt generation. That is simple but can make generation impossible for sparse wardrobes.

### Weather-aware suggestion cache keys

Cached suggestions will include enough weather context to decide whether they are still eligible, such as temperature band and current season. Cached options generated for a materially different context will be skipped.

Rationale: the current cache is keyed only by user and occasion, so a cached outfit can survive a temperature shift within the TTL.

Alternative considered: disable caching for recommendations. That avoids stale weather reuse but loses the "Try Another" flow performance benefit.

## Risks / Trade-offs

- AI may misclassify ambiguous thickness or warmth -> expose user correction, store source/confidence, and treat AI tags as ranking signals rather than absolute truth.
- JSONB metadata can become inconsistent -> validate allowed values in backend schemas and parser before saving.
- Existing items lack comfort tags -> use deterministic inference and optionally support reanalysis later.
- Strict weather validation may block recommendations for small wardrobes -> reject only severe mismatches and allow fallback generation when alternatives are limited.
- Prompt and parser changes may affect AI output stability -> add parser tests for valid, invalid, and missing comfort fields.

## Migration Plan

1. Deploy parser, schema, worker, and recommendation code that tolerates missing comfort tags.
2. New and reanalyzed items receive AI-generated comfort tags automatically.
3. Existing items continue to work through inference until the user reanalyzes or edits them.
4. Rollback is low risk because comfort tags live in JSONB and can be ignored by previous code.

## Open Questions

- Should bulk reanalysis be offered as a user-visible action in the first implementation, or left for a follow-up?
- Should comfort tags be displayed only in item detail initially, or also in wardrobe cards and filters?
