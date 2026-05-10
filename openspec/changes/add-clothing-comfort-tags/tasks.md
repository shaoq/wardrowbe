## 1. Comfort Tag Analysis

- [ ] 1.1 Extend the clothing analysis prompt with `fabric_weight` and `warmth_level` enum instructions and example output.
- [ ] 1.2 Extend `ClothingTags`, validation allowlists, parser logic, and confidence/completeness handling for comfort tags.
- [ ] 1.3 Persist comfort tags, source, and confidence in item `tags` JSONB during tagging worker updates.
- [ ] 1.4 Add parser and tagging conversion tests for valid, invalid, omitted, and partial comfort tag values.

## 2. User Correction Surface

- [ ] 2.1 Extend item schemas and update handling so owned items can save user-corrected comfort tags.
- [ ] 2.2 Update frontend item detail/edit UI to display comfort tags and allow quick correction.
- [ ] 2.3 Ensure user-corrected comfort tags set `comfort_tags_source=user` and override AI values in API responses.
- [ ] 2.4 Add backend and frontend-focused tests or type checks for comfort tag display and correction paths.

## 3. Recommendation Scoring and Validation

- [ ] 3.1 Add a shared comfort profile helper that reads user tags, AI tags, or fallback inference from type, subtype, material, and season.
- [ ] 3.2 Update item scoring to use comfort profiles with user cold/hot thresholds and temperature sensitivity.
- [ ] 3.3 Fix `all-season` season scoring so all-season items are treated as season-compatible.
- [ ] 3.4 Include comfort metadata in recommendation prompt item formatting where available.
- [ ] 3.5 Validate generated outfit options for severe comfort-weather mismatches before persistence, with limited-wardrobe fallback behavior.
- [ ] 3.6 Add focused scorer and recommendation tests for hot-weather warm item penalties, cold-weather cool item penalties, fallback inference, user overrides, and generated outfit rejection.

## 4. Weather-Aware Suggestion Cache

- [ ] 4.1 Store temperature band and season metadata with cached suggestion options.
- [ ] 4.2 Skip cached suggestions when current temperature band or season is materially incompatible with the cached context.
- [ ] 4.3 Add cache eligibility tests for matching and incompatible weather contexts.

## 5. Verification

- [ ] 5.1 Run focused backend tests for AI service parsing, tagging worker conversion, item scoring, recommendation service, and suggestion cache.
- [ ] 5.2 Run frontend lint/type checks for item detail comfort tag UI changes.
- [ ] 5.3 Manually verify the upload-to-recommendation flow with one hot-weather and one cold-weather scenario.
