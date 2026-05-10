## 1. Shared Validation Rules

- [x] 1.1 Add a shared backend helper for generated outfit validation, including exact item de-duplication, body-slot cleanup, role composition, and normalized fingerprints.
- [x] 1.2 Add unit tests for exact duplicate handling, body-slot conflicts, allowed layering, complete separates outfits, complete full-body outfits, and incomplete cleaned outfits.
- [x] 1.3 Align recommendation and pairing prompt slot language with the shared role definitions.

## 2. Recommendation Generation

- [x] 2.1 Update recommendation materialization to use the shared validation helper before persisting `OutfitItem` rows.
- [x] 2.2 Filter multi-option AI recommendation batches so only distinct key-piece combinations are returned or cached.
- [x] 2.3 Add tests for duplicate key-piece recommendation options, accessory-only differences, and incomplete options after cleanup.
- [x] 2.4 Apply scoring to small wardrobes instead of bypassing scoring when candidate item count is below 50.
- [x] 2.5 Add tests proving recent-wear penalties apply for small wardrobes while still allowing generation when alternatives are limited.

## 3. Pairing Generation

- [x] 3.1 Update pairing generation to use the shared validation helper before persisting pairings.
- [x] 3.2 Load existing pairings for the same source item and skip generated pairings with duplicate normalized item-id combinations.
- [x] 3.3 Add tests for exact duplicate item numbers in AI pairing output, duplicate historical pairing combinations, and partial success when some generated pairings are skipped.

## 4. Verification

- [x] 4.1 Run focused backend tests for clothing utilities, recommendation service, pairing service, and item scoring.
- [x] 4.2 Run the full backend test suite or document any environment blocker.
- [x] 4.3 Confirm no frontend API contract changes are required and update frontend only if validation errors need different handling.
