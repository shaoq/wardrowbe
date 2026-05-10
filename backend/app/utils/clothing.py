import logging
from dataclasses import dataclass, field
from uuid import UUID

logger = logging.getLogger(__name__)

ITEM_ROLE: dict[str, str] = {
    "shirt": "base_top",
    "t-shirt": "base_top",
    "blouse": "base_top",
    "polo": "base_top",
    "tank-top": "base_top",
    "top": "base_top",
    "sweater": "base_top",
    "pants": "bottom",
    "jeans": "bottom",
    "shorts": "bottom",
    "skirt": "bottom",
    "dress": "full_body",
    "jumpsuit": "full_body",
    "cardigan": "mid_layer",
    "vest": "mid_layer",
    "jacket": "outer_layer",
    "blazer": "outer_layer",
    "coat": "outer_layer",
    "hoodie": "outer_layer",
    "shoes": "footwear",
    "sneakers": "footwear",
    "boots": "footwear",
    "sandals": "footwear",
    "socks": "socks",
    "tie": "neckwear",
    "hat": "accessory",
    "scarf": "accessory",
    "belt": "accessory",
    "bag": "accessory",
    "accessories": "accessory",
}


def deduplicate_by_body_slot(item_ids: list[UUID], item_type_map: dict[UUID, str]) -> list[UUID]:
    seen_roles: dict[str, UUID] = {}
    result: list[UUID] = []
    has_full_body = any(
        ITEM_ROLE.get(item_type_map.get(iid, "")) == "full_body" for iid in item_ids
    )
    for iid in item_ids:
        item_type = item_type_map.get(iid, "")
        role = ITEM_ROLE.get(item_type)
        if not role:
            result.append(iid)
            continue
        if role == "accessory":
            result.append(iid)
            continue
        if has_full_body and role in ("base_top", "bottom"):
            logger.warning(f"Removing {item_type} item {iid}: full_body item present")
            continue
        if role in seen_roles:
            logger.warning(
                f"Removing duplicate {role} item {iid} ({item_type}): "
                f"role already filled by {seen_roles[role]}"
            )
            continue
        seen_roles[role] = iid
        result.append(iid)
    return result


_CANONICAL_ROLE_ORDER = [
    "full_body",
    "base_top",
    "mid_layer",
    "outer_layer",
    "bottom",
    "footwear",
    "socks",
    "neckwear",
    "accessory",
]

_ROLE_SORT_INDEX: dict[str, int] = {role: idx for idx, role in enumerate(_CANONICAL_ROLE_ORDER)}


def canonical_item_order(item_ids: list[UUID], item_type_map: dict[UUID, str]) -> list[UUID]:
    original_positions = {iid: idx for idx, iid in enumerate(item_ids)}

    def sort_key(item_id: UUID) -> tuple[int, int]:
        item_type = item_type_map.get(item_id, "")
        role = ITEM_ROLE.get(item_type)
        role_idx = (
            _ROLE_SORT_INDEX.get(role, len(_CANONICAL_ROLE_ORDER))
            if role
            else len(_CANONICAL_ROLE_ORDER)
        )
        return (role_idx, original_positions[item_id])

    return sorted(item_ids, key=sort_key)


@dataclass
class ValidatedOutfit:
    """Result of validating a generated outfit's item selection."""

    cleaned_ids: list[UUID]
    roles: dict[str, UUID] = field(default_factory=dict)
    key_piece_fingerprint: str = ""
    full_fingerprint: str = ""
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    @property
    def is_valid(self) -> bool:
        return not self.errors


def validate_generated_outfit(
    item_ids: list[UUID],
    item_type_map: dict[UUID, str],
    *,
    require_completeness: bool = False,
) -> ValidatedOutfit:
    """Validate and clean a generated outfit's item selection.

    Steps:
    1. Remove exact duplicate item ids.
    2. Resolve body-slot conflicts via existing ``deduplicate_by_body_slot``.
    3. Build role composition map.
    4. Compute key-piece and full fingerprints.
    5. Optionally check outfit completeness.

    Args:
        item_ids: Raw item ids from AI output.
        item_type_map: Mapping from item UUID to clothing type string.
        require_completeness: If True, reject outfits missing required roles.

    Returns:
        ValidatedOutfit with cleaned ids, roles, fingerprints, and any errors.
    """
    warnings: list[str] = []
    errors: list[str] = []

    # Step 1: Exact duplicate removal
    seen: set[UUID] = set()
    unique_ids: list[UUID] = []
    for iid in item_ids:
        if iid in seen:
            warnings.append(f"Exact duplicate item {iid} removed")
            continue
        seen.add(iid)
        unique_ids.append(iid)

    # Step 2: Body-slot conflict resolution
    cleaned_ids = deduplicate_by_body_slot(unique_ids, item_type_map)

    # Step 3: Build role composition
    roles: dict[str, UUID] = {}
    for iid in cleaned_ids:
        item_type = item_type_map.get(iid, "")
        role = ITEM_ROLE.get(item_type)
        if role and role != "accessory":
            roles[role] = iid

    # Step 4: Compute fingerprints
    key_pieces: list[str] = []
    for role in ("full_body", "base_top", "bottom"):
        if role in roles:
            key_pieces.append(f"{role}:{roles[role]}")
    key_piece_fingerprint = "|".join(sorted(key_pieces))

    all_sorted = sorted(str(iid) for iid in cleaned_ids)
    full_fingerprint = "|".join(all_sorted)

    # Step 5: Completeness check
    if require_completeness:
        has_full_body = "full_body" in roles
        has_top = "base_top" in roles
        has_bottom = "bottom" in roles
        has_footwear = "footwear" in roles

        if not has_footwear:
            errors.append("Outfit is missing footwear")
        if has_full_body:
            pass  # full_body + footwear is complete
        elif has_top and has_bottom:
            pass  # separates + footwear is complete
        else:
            errors.append(
                "Outfit needs either a full-body item or both a base top and bottom"
            )

    return ValidatedOutfit(
        cleaned_ids=cleaned_ids,
        roles=roles,
        key_piece_fingerprint=key_piece_fingerprint,
        full_fingerprint=full_fingerprint,
        errors=errors,
        warnings=warnings,
    )
