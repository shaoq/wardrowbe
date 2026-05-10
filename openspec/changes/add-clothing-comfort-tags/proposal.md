## Why

Outfit recommendations currently rely on coarse clothing `season`, `material`, and item type signals when judging weather suitability. This misses important comfort differences such as thin vs. thick knitwear, lightweight vs. insulated outerwear, and cool vs. warm fabrics, so recommendations can suggest pieces that are seasonally or thermally inappropriate.

## What Changes

- Add comfort-oriented clothing tags for AI analysis, including fabric weight and warmth level.
- Preserve AI-generated comfort tags in item metadata and expose them through item responses.
- Allow user-reviewed comfort tags to override AI-generated values without making manual input required during upload.
- Update recommendation scoring and generated outfit validation to use comfort tags when matching items to current weather, with fallbacks for existing items that do not have the new tags.
- Prevent cached suggestions from being reused across incompatible weather or season contexts.
- Add tests for comfort tag parsing, persistence, recommendation scoring, generated outfit validation, and cache eligibility.

## Capabilities

### New Capabilities

- `clothing-comfort-tags`: Defines automatic and user-correctable comfort metadata for clothing items, plus how recommendations use those tags for weather and season suitability.

### Modified Capabilities

- None.

## Impact

- Backend AI tagging prompt and parser in `backend/app/prompts/clothing_analysis.txt` and `backend/app/services/ai_service.py`.
- Item tagging worker and item schemas in `backend/app/workers/tagging.py` and `backend/app/schemas/item.py`.
- Recommendation scoring, prompt formatting, generated outfit acceptance, and suggestion cache behavior in `backend/app/services/recommendation_service.py`, `backend/app/services/item_scorer.py`, and `backend/app/services/suggestion_cache.py`.
- Frontend item detail/edit surfaces for displaying and correcting comfort tags.
- Backend tests for AI tag parsing, tagging worker conversion, item scoring, recommendation generation, and suggestion caching.
