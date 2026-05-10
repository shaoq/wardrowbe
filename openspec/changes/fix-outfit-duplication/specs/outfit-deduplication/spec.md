## ADDED Requirements

### Requirement: Generated outfits must not contain exact duplicate items
The system SHALL remove exact duplicate item ids from AI-generated outfit selections before persisting outfit items.

#### Scenario: AI returns the same item number twice
- **WHEN** an AI-generated recommendation or pairing contains the same item number more than once
- **THEN** the persisted outfit MUST contain that item only once

#### Scenario: Duplicate collapse leaves too few items
- **WHEN** duplicate removal leaves a generated pairing with fewer than two items
- **THEN** the system MUST skip that generated pairing instead of persisting it

### Requirement: Generated outfits must not contain conflicting body slots
The system SHALL prevent generated outfits from persisting mutually exclusive body-slot conflicts.

#### Scenario: Multiple bottoms are selected
- **WHEN** an AI-generated outfit contains more than one bottom item such as pants, jeans, shorts, or skirt
- **THEN** the persisted outfit MUST include at most one bottom item

#### Scenario: Full-body item conflicts with separates
- **WHEN** an AI-generated outfit contains a full-body item such as a dress or jumpsuit plus a base top or bottom
- **THEN** the persisted outfit MUST keep the full-body item and remove conflicting base top or bottom items

#### Scenario: Layered upper-body outfit is valid
- **WHEN** an AI-generated outfit contains one base top and one allowed layer such as cardigan, vest, jacket, blazer, coat, or hoodie
- **THEN** the system MUST allow the layered combination when no other required validation fails

### Requirement: Generated outfits must remain complete after cleanup
The system SHALL validate the role composition of generated outfits after exact duplicate and body-slot cleanup.

#### Scenario: Separates outfit is complete
- **WHEN** a cleaned generated outfit contains one base top, one bottom, and footwear
- **THEN** the system MUST allow the outfit to be persisted

#### Scenario: Full-body outfit is complete
- **WHEN** a cleaned generated outfit contains one full-body item and footwear
- **THEN** the system MUST allow the outfit to be persisted

#### Scenario: Required role is missing
- **WHEN** a cleaned generated outfit lacks footwear or lacks both a valid separates base and a full-body item
- **THEN** the system MUST reject or skip that generated outfit instead of persisting an incomplete outfit

### Requirement: Recommendation batches must contain distinct key-piece combinations
The system SHALL avoid returning or caching multiple recommendation options with the same key-piece combination in one generation batch.

#### Scenario: AI returns duplicate key pieces across recommendation options
- **WHEN** multiple AI recommendation options use the same base top and bottom or the same full-body item
- **THEN** the system MUST keep only the first valid option with that key-piece combination

#### Scenario: Accessories differ but key pieces match
- **WHEN** two AI recommendation options only differ by accessory items
- **THEN** the system MUST treat them as duplicate recommendation options

### Requirement: Pairing generation must not recreate existing source-item combinations
The system SHALL avoid saving generated pairings that duplicate an existing pairing combination for the same user and source item.

#### Scenario: Generated pairing already exists
- **WHEN** a generated pairing has the same normalized item-id set as an existing pairing for the same source item
- **THEN** the system MUST skip the generated pairing instead of creating a duplicate outfit record

#### Scenario: Generated pairing is new
- **WHEN** a generated pairing has a normalized item-id set that does not match any existing pairing for the same source item
- **THEN** the system MUST allow the pairing to be persisted if all other validation passes

### Requirement: Repetition controls must apply to small wardrobes
The system SHALL apply recent-wear and underused-item scoring even when the candidate wardrobe contains fewer than 50 items.

#### Scenario: Small wardrobe has recent and older candidates
- **WHEN** a user has fewer than 50 candidate items and some items were worn within the configured repeat-avoidance window
- **THEN** recommendation scoring MUST penalize recently worn items relative to otherwise suitable older or never-worn items

#### Scenario: Small wardrobe has no alternative
- **WHEN** repeat avoidance cannot be satisfied because the wardrobe lacks enough valid alternatives
- **THEN** the system MUST still generate the best available valid outfit rather than failing solely due to repetition constraints
