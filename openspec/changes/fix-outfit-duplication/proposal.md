## Why

Outfit recommendations and generated pairings can reuse the same clothing items too often, either within one generated batch or across repeated generation attempts. The current implementation relies heavily on prompt instructions and only performs limited post-processing, so duplicate or near-duplicate looks can still be saved and shown to users.

## What Changes

- Add server-side validation for generated outfits so item selection is not accepted solely because the AI returned valid JSON.
- Enforce exact item de-duplication and body-slot conflict handling consistently across recommendations and pairings.
- Prevent duplicate generated options in the same recommendation or pairing batch by comparing key outfit pieces.
- Prevent repeated pairing combinations for the same source item across repeated generation requests.
- Ensure post-processed outfits remain complete after duplicate or slot-conflicting items are removed.
- Preserve valid layering behavior while clarifying which clothing types are mutually exclusive and which are allowed as layers.

## Capabilities

### New Capabilities

- `outfit-deduplication`: Defines duplicate prevention, slot conflict handling, outfit completeness validation, and generated-combination uniqueness for AI recommendations and pairings.

### Modified Capabilities

None.

## Impact

- Backend recommendation generation in `backend/app/services/recommendation_service.py`.
- Backend pairing generation in `backend/app/services/pairing_service.py`.
- Shared clothing role and ordering utilities in `backend/app/utils/clothing.py`.
- Recommendation and pairing prompts in `backend/app/prompts/`.
- Tests for clothing slot utilities, recommendation materialization, pairing generation, and repeated generation behavior.
- No expected database schema change and no breaking API response change.
