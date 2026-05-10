## ADDED Requirements

### Requirement: Automatic comfort tag extraction

The system SHALL request and parse comfort metadata during AI clothing analysis, including `fabric_weight` and `warmth_level`, using backend-validated enum values.

#### Scenario: AI returns valid comfort tags
- **WHEN** an uploaded clothing image is analyzed and the AI returns valid `fabric_weight` and `warmth_level` values
- **THEN** the system MUST store those values in the item's metadata with `comfort_tags_source` set to `ai`

#### Scenario: AI returns invalid comfort tags
- **WHEN** the AI returns comfort tag values outside the backend allowlist
- **THEN** the system MUST discard the invalid comfort values and keep the item analysis successful when other required tags can be parsed

#### Scenario: AI omits comfort tags
- **WHEN** the AI response does not include comfort tags
- **THEN** the system MUST keep the item analysis successful and leave comfort metadata absent or inferred

### Requirement: User comfort tag correction

The system SHALL allow a user to correct an item's comfort metadata after upload without requiring comfort fields during item creation.

#### Scenario: User updates comfort tags
- **WHEN** a user updates `fabric_weight` or `warmth_level` for an item they own
- **THEN** the system MUST persist the corrected values and mark the comfort metadata source as `user`

#### Scenario: User correction overrides AI values
- **WHEN** an item has user-corrected comfort metadata
- **THEN** recommendation logic MUST use the user-corrected values instead of AI-generated or inferred values

#### Scenario: Upload without manual comfort input
- **WHEN** a user uploads a clothing item without providing comfort metadata
- **THEN** the system MUST accept the upload and rely on AI analysis or fallback inference for comfort metadata

### Requirement: Comfort-aware recommendation scoring

The system SHALL use comfort metadata when ranking candidate items for outfit recommendations.

#### Scenario: Hot weather penalizes warm items
- **WHEN** the current weather is above the user's hot threshold and an item has warm or heavy comfort metadata
- **THEN** the system MUST rank that item below otherwise comparable cool or lightweight items

#### Scenario: Cold weather penalizes cool items
- **WHEN** the current weather is below the user's cold threshold and an item has cool or lightweight comfort metadata
- **THEN** the system MUST rank that item below otherwise comparable warm or heavyweight items

#### Scenario: Missing comfort tags use fallback inference
- **WHEN** a candidate item has no explicit comfort metadata
- **THEN** the system MUST infer a comfort profile from available type, subtype, material, and season data before scoring

#### Scenario: User temperature sensitivity affects scoring
- **WHEN** the user has custom temperature thresholds or temperature sensitivity settings
- **THEN** comfort-aware scoring MUST apply those preferences when determining hot and cold suitability

### Requirement: Generated outfit weather validation

The system SHALL validate generated outfits for severe comfort-weather mismatches before saving them.

#### Scenario: AI selects a severe hot-weather mismatch
- **WHEN** an AI-generated outfit includes a heavy or warm key garment during hot weather
- **THEN** the system MUST reject that generated option or skip to another valid option before persisting an outfit

#### Scenario: AI selects a severe cold-weather mismatch
- **WHEN** an AI-generated outfit includes a cool or lightweight key garment during cold weather without sufficient layering
- **THEN** the system MUST reject that generated option or skip to another valid option before persisting an outfit

#### Scenario: Limited wardrobe fallback
- **WHEN** all available complete outfit options have comfort concerns because the wardrobe has limited alternatives
- **THEN** the system MAY allow a lower-confidence outfit but MUST prefer the least severe mismatch

### Requirement: Weather-aware suggestion cache

The system SHALL prevent cached recommendation options from being reused in materially incompatible weather or season contexts.

#### Scenario: Cached suggestion matches weather context
- **WHEN** a cached suggestion was generated for the same occasion and compatible temperature band and season
- **THEN** the system MAY reuse the cached suggestion

#### Scenario: Cached suggestion has incompatible weather context
- **WHEN** a cached suggestion was generated for a different temperature band or incompatible season
- **THEN** the system MUST skip that cached suggestion and generate or use another eligible recommendation

### Requirement: Comfort metadata visibility

The system SHALL expose comfort metadata through item responses and display it where AI-generated item tags are shown.

#### Scenario: Item response includes comfort metadata
- **WHEN** an item has comfort metadata
- **THEN** item API responses MUST include the comfort fields in the item's metadata

#### Scenario: Item detail displays comfort metadata
- **WHEN** a user views an item that has comfort metadata
- **THEN** the item detail UI MUST display the comfort values alongside other AI-generated tags
