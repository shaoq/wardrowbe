import json
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.services.suggestion_cache import (
    _cache_key,
    _temp_band,
    clear_suggestions,
    has_cached,
    pop_suggestion,
    push_suggestions,
)


@pytest.fixture
def user_id():
    return uuid4()


@pytest.fixture
def mock_redis():
    redis = MagicMock()
    redis.lpop = AsyncMock(return_value=None)
    redis.llen = AsyncMock(return_value=0)
    redis.delete = AsyncMock()
    redis.lrange = AsyncMock(return_value=[])
    redis.lrem = AsyncMock()

    pipe = MagicMock()
    pipe.execute = AsyncMock()
    redis.pipeline.return_value = pipe
    return redis, pipe


class TestTempBand:
    def test_cold(self):
        assert _temp_band(5) == "cold"

    def test_mild(self):
        assert _temp_band(15) == "mild"

    def test_hot(self):
        assert _temp_band(25) == "hot"

    def test_none(self):
        assert _temp_band(None) is None

    def test_boundary_cold_mild(self):
        assert _temp_band(9) == "cold"
        assert _temp_band(10) == "mild"

    def test_boundary_mild_hot(self):
        assert _temp_band(19) == "mild"
        assert _temp_band(20) == "hot"


class TestSuggestionCache:
    @pytest.mark.asyncio
    async def test_push_and_pop_fifo(self, user_id, mock_redis):
        redis, pipe = mock_redis

        with patch("app.services.suggestion_cache.get_redis", AsyncMock(return_value=redis)):
            suggestions = [
                {"items": [1, 2], "headline": "First"},
                {"items": [3, 4], "headline": "Second"},
            ]
            await push_suggestions(user_id, "casual", suggestions)

            assert pipe.rpush.call_count == 2
            pipe.expire.assert_called_once()
            pipe.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_pop_empty_returns_none(self, user_id, mock_redis):
        redis, _ = mock_redis
        redis.lrange.return_value = []

        with patch("app.services.suggestion_cache.get_redis", AsyncMock(return_value=redis)):
            result = await pop_suggestion(user_id, "casual")
            assert result is None

    @pytest.mark.asyncio
    async def test_pop_returns_dict(self, user_id, mock_redis):
        redis, _ = mock_redis
        entry = {"items": [1, 2], "headline": "Test"}
        redis.lrange.return_value = [json.dumps(entry)]

        with patch("app.services.suggestion_cache.get_redis", AsyncMock(return_value=redis)):
            result = await pop_suggestion(user_id, "casual")
            assert result == {"items": [1, 2], "headline": "Test"}

    @pytest.mark.asyncio
    async def test_pop_strips_weather_context(self, user_id, mock_redis):
        redis, _ = mock_redis
        entry = {"items": [1, 2], "_weather_context": {"temp_band": "cold", "season": "winter"}}
        redis.lrange.return_value = [json.dumps(entry)]

        with patch("app.services.suggestion_cache.get_redis", AsyncMock(return_value=redis)):
            result = await pop_suggestion(user_id, "casual")
            assert "_weather_context" not in result

    @pytest.mark.asyncio
    async def test_clear_removes_all(self, user_id, mock_redis):
        redis, _ = mock_redis

        with patch("app.services.suggestion_cache.get_redis", AsyncMock(return_value=redis)):
            await clear_suggestions(user_id, "casual")
            key = _cache_key(user_id, "casual")
            redis.delete.assert_called_once_with(key)

    @pytest.mark.asyncio
    async def test_has_cached_true(self, user_id, mock_redis):
        redis, _ = mock_redis
        redis.llen.return_value = 2

        with patch("app.services.suggestion_cache.get_redis", AsyncMock(return_value=redis)):
            assert await has_cached(user_id, "casual") is True

    @pytest.mark.asyncio
    async def test_redis_error_degrades_gracefully(self, user_id):
        async def failing_redis():
            raise ConnectionError("Redis down")

        with patch("app.services.suggestion_cache.get_redis", side_effect=failing_redis):
            result = await pop_suggestion(user_id, "casual")
            assert result is None

            cached = await has_cached(user_id, "casual")
            assert cached is False

            await push_suggestions(user_id, "casual", [{"items": [1]}])
            await clear_suggestions(user_id, "casual")


class TestWeatherAwareCache:
    @pytest.mark.asyncio
    async def test_push_with_weather_context(self, user_id, mock_redis):
        redis, pipe = mock_redis

        with patch("app.services.suggestion_cache.get_redis", AsyncMock(return_value=redis)):
            await push_suggestions(
                user_id, "casual",
                [{"items": [1, 2]}],
                weather_context={"temp_band": "cold", "season": "winter"},
            )
            # Verify the pushed data includes weather context
            call_args = pipe.rpush.call_args[0]
            pushed_data = json.loads(call_args[1])
            assert pushed_data["_weather_context"]["temp_band"] == "cold"
            assert pushed_data["_weather_context"]["season"] == "winter"

    @pytest.mark.asyncio
    async def test_compatible_band_returns_suggestion(self, user_id, mock_redis):
        redis, _ = mock_redis
        entry = {"items": [1, 2], "_weather_context": {"temp_band": "cold", "season": "winter"}}
        redis.lrange.return_value = [json.dumps(entry)]

        with patch("app.services.suggestion_cache.get_redis", AsyncMock(return_value=redis)):
            result = await pop_suggestion(user_id, "casual", current_temp=5, current_season="winter")
            assert result is not None
            assert result["items"] == [1, 2]

    @pytest.mark.asyncio
    async def test_incompatible_band_skips_suggestion(self, user_id, mock_redis):
        redis, _ = mock_redis
        entry = {"items": [1, 2], "_weather_context": {"temp_band": "cold", "season": "winter"}}
        redis.lrange.return_value = [json.dumps(entry)]

        with patch("app.services.suggestion_cache.get_redis", AsyncMock(return_value=redis)):
            result = await pop_suggestion(user_id, "casual", current_temp=30, current_season="summer")
            assert result is None

    @pytest.mark.asyncio
    async def test_mild_compatible_with_both(self, user_id, mock_redis):
        redis, _ = mock_redis
        cold_entry = {"items": [1, 2], "_weather_context": {"temp_band": "cold"}}
        hot_entry = {"items": [3, 4], "_weather_context": {"temp_band": "hot"}}
        redis.lrange.return_value = [json.dumps(cold_entry), json.dumps(hot_entry)]

        with patch("app.services.suggestion_cache.get_redis", AsyncMock(return_value=redis)):
            # Mild temp should be compatible with cold (first entry)
            result = await pop_suggestion(user_id, "casual", current_temp=15)
            assert result is not None
            assert result["items"] == [1, 2]

    @pytest.mark.asyncio
    async def test_no_weather_context_always_compatible(self, user_id, mock_redis):
        redis, _ = mock_redis
        entry = {"items": [1, 2]}  # No weather context
        redis.lrange.return_value = [json.dumps(entry)]

        with patch("app.services.suggestion_cache.get_redis", AsyncMock(return_value=redis)):
            result = await pop_suggestion(user_id, "casual", current_temp=30, current_season="summer")
            assert result is not None

    @pytest.mark.asyncio
    async def test_opposite_seasons_skipped(self, user_id, mock_redis):
        redis, _ = mock_redis
        entry = {"items": [1, 2], "_weather_context": {"season": "winter"}}
        redis.lrange.return_value = [json.dumps(entry)]

        with patch("app.services.suggestion_cache.get_redis", AsyncMock(return_value=redis)):
            result = await pop_suggestion(user_id, "casual", current_season="summer")
            assert result is None

    @pytest.mark.asyncio
    async def test_adjacent_seasons_compatible(self, user_id, mock_redis):
        redis, _ = mock_redis
        entry = {"items": [1, 2], "_weather_context": {"season": "spring"}}
        redis.lrange.return_value = [json.dumps(entry)]

        with patch("app.services.suggestion_cache.get_redis", AsyncMock(return_value=redis)):
            result = await pop_suggestion(user_id, "casual", current_season="summer")
            assert result is not None
