from datetime import date, datetime, timedelta
from uuid import uuid4

import pytest

from app.models.item import ClothingItem
from app.models.preference import UserPreference
from app.services.item_scorer import (
    MIN_ITEMS_FOR_SCORING,
    _formality_score,
    _pair_bonus,
    _preference_score,
    _recency_score,
    _season_score,
    _weather_score,
    get_season,
    score_items,
    get_comfort_profile,
    ComfortProfile,
)
from app.services.weather_service import WeatherData


def _item(**kwargs) -> ClothingItem:
    defaults = {
        "id": uuid4(),
        "user_id": uuid4(),
        "type": "shirt",
        "image_path": "test.jpg",
        "primary_color": None,
        "colors": [],
        "pattern": None,
        "material": None,
        "style": [],
        "formality": "casual",
        "season": [],
        "last_worn_at": None,
        "needs_wash": False,
        "is_archived": False,
        "tags": {},
    }
    defaults.update(kwargs)
    return ClothingItem(**defaults)


def _weather(temp=20, precipitation=0) -> WeatherData:
    return WeatherData(
        temperature=temp,
        feels_like=temp,
        humidity=50,
        precipitation_chance=precipitation,
        precipitation_mm=0,
        wind_speed=10,
        condition="clear",
        condition_code=0,
        is_day=True,
        uv_index=5,
        timestamp=datetime(2026, 3, 8, 12, 0),
    )


def _prefs(**kwargs) -> UserPreference:
    defaults = {
        "user_id": uuid4(),
        "cold_threshold": 10,
        "hot_threshold": 25,
        "temperature_sensitivity": "normal",
        "color_favorites": [],
        "color_avoid": [],
        "avoid_repeat_days": 7,
        "variety_level": "moderate",
    }
    defaults.update(kwargs)
    return UserPreference(**defaults)


class TestWeatherScore:
    def test_cold_outerwear_scores_high(self):
        item = _item(type="outerwear")
        assert _weather_score(item, _weather(temp=5), None) == 1.0

    def test_cold_shorts_scores_low(self):
        item = _item(type="shorts")
        assert _weather_score(item, _weather(temp=5), None) == 0.05

    def test_hot_cotton_scores_high(self):
        item = _item(type="shirt", material="cotton")
        assert _weather_score(item, _weather(temp=30), None) == 1.0

    def test_moderate_all_pass(self):
        item = _item(type="shirt")
        assert _weather_score(item, _weather(temp=18), None) == 1.0

    def test_cold_threshold_sensitivity(self):
        item = _item(type="shorts")
        prefs = _prefs(temperature_sensitivity="high")
        # high sensitivity: cold_threshold=10+5=15, hot_threshold=25-5=20
        # temp=12 < 15 → cold weather, shorts get 0.05
        assert _weather_score(item, _weather(temp=12), prefs) == 0.05

    def test_rain_boosts_outerwear(self):
        item = _item(type="outerwear")
        assert _weather_score(item, _weather(temp=18, precipitation=60), None) == 1.0

    def test_cold_wool_scores_high(self):
        item = _item(type="shirt", material="wool")
        assert _weather_score(item, _weather(temp=5), None) == 1.0

    def test_hot_sweater_scores_low(self):
        item = _item(type="sweater")
        assert _weather_score(item, _weather(temp=30), None) == 0.05

    def test_cold_regular_shirt(self):
        item = _item(type="shirt")
        assert _weather_score(item, _weather(temp=5), None) == 0.7


class TestFormalityScore:
    def test_exact_match(self):
        item = _item(formality="casual")
        assert _formality_score(item, "casual") == 1.0

    def test_one_off(self):
        item = _item(formality="business-casual")
        assert _formality_score(item, "casual") == 0.5

    def test_two_off(self):
        item = _item(formality="formal")
        assert _formality_score(item, "casual") == 0.15

    def test_unknown_occasion_defaults(self):
        item = _item(formality="casual")
        assert _formality_score(item, "picnic") == 1.0


class TestSeasonScore:
    def test_match(self):
        item = _item(season=["summer"])
        assert _season_score(item, "summer") == 1.0

    def test_adjacent(self):
        item = _item(season=["summer"])
        assert _season_score(item, "spring") == 0.6

    def test_opposite(self):
        item = _item(season=["summer"])
        assert _season_score(item, "winter") == 0.2

    def test_no_tags(self):
        item = _item(season=[])
        assert _season_score(item, "winter") == 1.0


class TestGetSeason:
    def test_northern_hemisphere(self):
        assert get_season(1, 40.0) == "winter"
        assert get_season(7, 40.0) == "summer"

    def test_southern_hemisphere(self):
        assert get_season(1, -33.0) == "summer"
        assert get_season(7, -33.0) == "winter"

    def test_equator_defaults_north(self):
        assert get_season(1, 0.0) == "winter"

    def test_none_latitude_defaults_north(self):
        assert get_season(7, None) == "summer"


class TestRecencyScore:
    def test_never_worn(self):
        item = _item()
        assert _recency_score(item, date(2026, 3, 8), 7, {}) == 1.0

    def test_worn_today(self):
        item = _item()
        today = date(2026, 3, 8)
        assert _recency_score(item, today, 7, {item.id: today}) == 0.1

    def test_linear_interpolation(self):
        item = _item()
        today = date(2026, 3, 8)
        worn = date(2026, 3, 4)
        score = _recency_score(item, today, 7, {item.id: worn})
        expected = 0.1 + 0.9 * (4 / 7)
        assert abs(score - expected) < 0.001

    def test_beyond_avoid_days(self):
        item = _item()
        today = date(2026, 3, 8)
        worn = date(2026, 2, 20)
        assert _recency_score(item, today, 7, {item.id: worn}) == 1.0


class TestPreferenceScore:
    def test_fav_color_boost(self):
        item = _item(primary_color="blue")
        prefs = _prefs(color_favorites=["blue"])
        assert _preference_score(item, prefs, None) == 1.1

    def test_avoid_color_penalty(self):
        item = _item(primary_color="orange")
        prefs = _prefs(color_avoid=["orange"])
        assert _preference_score(item, prefs, None) == 0.7

    def test_clamped_bounds(self):
        item = _item(primary_color="orange")
        prefs = _prefs(color_avoid=["orange"])
        learned = {
            "learned_avoid_colors": ["orange"],
            "learned_favorite_colors": [],
        }
        score = _preference_score(item, prefs, learned)
        assert score >= 0.3
        assert score <= 1.2

    def test_learned_fav_boost(self):
        item = _item(primary_color="blue")
        learned = {"learned_favorite_colors": ["blue"]}
        assert _preference_score(item, None, learned) == 1.05

    def test_learned_style_match(self):
        item = _item(style=["casual", "minimal"])
        learned = {"learned_preferred_styles": ["casual", "minimal"]}
        score = _preference_score(item, None, learned)
        assert score == pytest.approx(1.06, abs=0.001)


class TestPairBonus:
    def test_good_pairs(self):
        items = [_item() for _ in range(3)]
        pairs = {items[0].id: [items[1].id, items[2].id]}
        bonus = _pair_bonus(items[0], items, pairs)
        assert bonus == 0.1

    def test_capped_at_015(self):
        items = [_item() for _ in range(5)]
        pairs = {items[0].id: [i.id for i in items[1:]]}
        bonus = _pair_bonus(items[0], items, pairs)
        assert bonus == 0.15

    def test_no_pairs(self):
        items = [_item() for _ in range(3)]
        assert _pair_bonus(items[0], items, {}) == 0.0


class TestScoreItems:
    def test_sorts_descending(self):
        items = [
            _item(type="shorts"),
            _item(type="outerwear"),
        ]
        filler = [_item() for _ in range(MIN_ITEMS_FOR_SCORING - 2)]
        all_items = items + filler

        result = score_items(
            items=all_items,
            weather=_weather(temp=5),
            occasion="casual",
            preferences=None,
            user_today=date(2026, 3, 8),
            current_season="spring",
            learned_prefs=None,
            good_pairs={},
            recently_worn_dates={},
        )

        outerwear_pos = next(i for i, s in enumerate(result) if s.item.type == "outerwear")
        shorts_pos = next(i for i, s in enumerate(result) if s.item.type == "shorts")
        assert outerwear_pos < shorts_pos

    def test_returns_top_n(self):
        items = [_item() for _ in range(100)]
        result = score_items(
            items=items,
            weather=_weather(),
            occasion="casual",
            preferences=None,
            user_today=date(2026, 3, 8),
            current_season="spring",
            learned_prefs=None,
            good_pairs={},
            recently_worn_dates={},
        )
        assert len(result) <= 70

    def test_small_wardrobe_is_scored(self):
        items = [_item() for _ in range(10)]
        result = score_items(
            items=items,
            weather=_weather(),
            occasion="casual",
            preferences=None,
            user_today=date(2026, 3, 8),
            current_season="spring",
            learned_prefs=None,
            good_pairs={},
            recently_worn_dates={},
        )
        assert len(result) == 10
        # All items have default formality/season/etc so scores should be 1.0
        assert all(s.score == 1.0 for s in result)

    def test_bad_weather_tanks_score(self):
        items = [_item(type="shorts") for _ in range(MIN_ITEMS_FOR_SCORING)]
        result = score_items(
            items=items,
            weather=_weather(temp=5),
            occasion="casual",
            preferences=None,
            user_today=date(2026, 3, 8),
            current_season="spring",
            learned_prefs=None,
            good_pairs={},
            recently_worn_dates={},
        )
        assert all(s.score < 0.1 for s in result)


class TestSmallWardrobeScoring:
    """Verify that scoring (especially recency) applies to small wardrobes."""

    def test_recent_wear_penalized_in_small_wardrobe(self):
        shirt_worn = _item(type="shirt")
        shirt_old = _item(type="shirt")
        pants = _item(type="pants")
        shoes = _item(type="sneakers")
        today = date(2026, 3, 8)

        worn_dates = {
            shirt_worn.id: today - timedelta(days=1),  # worn yesterday
            shirt_old.id: today - timedelta(days=20),  # worn 20 days ago
        }

        result = score_items(
            items=[shirt_worn, shirt_old, pants, shoes],
            weather=_weather(),
            occasion="casual",
            preferences=None,
            user_today=today,
            current_season="spring",
            learned_prefs=None,
            good_pairs={},
            recently_worn_dates=worn_dates,
        )

        old_pos = next(i for i, s in enumerate(result) if s.item.id == shirt_old.id)
        worn_pos = next(i for i, s in enumerate(result) if s.item.id == shirt_worn.id)
        assert old_pos < worn_pos  # older item ranked higher

    def test_small_wardrobe_still_generates_when_alternatives_limited(self):
        """Even when all items are recently worn, scoring still returns all items."""
        items = [_item(type="shirt", last_worn_at=date(2026, 3, 7)) for _ in range(3)]
        items.append(_item(type="pants", last_worn_at=date(2026, 3, 7)))
        items.append(_item(type="sneakers", last_worn_at=date(2026, 3, 7)))

        result = score_items(
            items=items,
            weather=_weather(),
            occasion="casual",
            preferences=None,
            user_today=date(2026, 3, 8),
            current_season="spring",
            learned_prefs=None,
            good_pairs={},
            recently_worn_dates={},
        )
        assert len(result) == 5
        # All items still have non-zero scores
        assert all(s.score > 0 for s in result)

    def test_small_wardrobe_weather_scoring_applies(self):
        cold_item = _item(type="outerwear")
        hot_item = _item(type="shorts")

        result = score_items(
            items=[cold_item, hot_item],
            weather=_weather(temp=5),
            occasion="casual",
            preferences=None,
            user_today=date(2026, 3, 8),
            current_season="winter",
            learned_prefs=None,
            good_pairs={},
            recently_worn_dates={},
        )

        cold_score = next(s.score for s in result if s.item.id == cold_item.id)
        hot_score = next(s.score for s in result if s.item.id == hot_item.id)
        assert cold_score > hot_score


class TestComfortProfile:
    def test_user_tags_preferred(self):
        item = _item(tags={"fabric_weight": "heavyweight", "warmth_level": "warm", "comfort_tags_source": "user"})
        profile = get_comfort_profile(item)
        assert profile.source == "user"
        assert profile.confidence == 1.0
        assert profile.warmth > 0.7

    def test_ai_tags_used(self):
        item = _item(tags={"fabric_weight": "lightweight", "warmth_level": "cool", "comfort_tags_source": "ai"})
        profile = get_comfort_profile(item)
        assert profile.source == "ai"
        assert profile.warmth < 0.3

    def test_inference_from_type(self):
        item = _item(type="coat", tags={})
        profile = get_comfort_profile(item)
        assert profile.source == "inferred"
        assert profile.warmth > 0.5

    def test_inference_from_material(self):
        item = _item(material="linen", tags={})
        profile = get_comfort_profile(item)
        assert profile.source == "inferred"
        assert profile.warmth < 0.5

    def test_inference_from_season(self):
        item = _item(season=["summer"], tags={})
        profile = get_comfort_profile(item)
        assert profile.source == "inferred"
        assert profile.warmth < 0.5


class TestComfortWeatherScoring:
    def test_hot_weather_penalizes_warm_items(self):
        warm_item = _item(type="shirt", tags={"fabric_weight": "heavyweight", "warmth_level": "warm", "comfort_tags_source": "ai"})
        cool_item = _item(type="shirt", tags={"fabric_weight": "lightweight", "warmth_level": "cool", "comfort_tags_source": "ai"})
        assert _weather_score(warm_item, _weather(temp=35), None) < _weather_score(cool_item, _weather(temp=35), None)

    def test_cold_weather_penalizes_cool_items(self):
        cool_item = _item(type="shirt", tags={"fabric_weight": "sheer", "warmth_level": "cool", "comfort_tags_source": "ai"})
        warm_item = _item(type="shirt", tags={"fabric_weight": "midweight", "warmth_level": "warm", "comfort_tags_source": "ai"})
        assert _weather_score(cool_item, _weather(temp=0), None) < _weather_score(warm_item, _weather(temp=0), None)


class TestAllSeasonScore:
    def test_all_season_treated_as_match(self):
        item = _item(season=["all-season"])
        assert _season_score(item, "summer") == 1.0
        assert _season_score(item, "winter") == 1.0
        assert _season_score(item, "spring") == 1.0
        assert _season_score(item, "fall") == 1.0
