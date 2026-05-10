import json
import logging

from app.utils.redis_lock import get_redis

logger = logging.getLogger(__name__)

CACHE_TTL = 3600
KEY_PREFIX = "suggest"


def _cache_key(user_id, occasion) -> str:
    return f"{KEY_PREFIX}:{user_id}:{occasion}"


def _temp_band(temp: float | None) -> str | None:
    """Classify temperature into a band for weather-aware caching."""
    if temp is None:
        return None
    if temp < 10:
        return "cold"
    if temp < 20:
        return "mild"
    return "hot"


async def push_suggestions(
    user_id,
    occasion,
    suggestions: list[dict],
    *,
    weather_context: dict | None = None,
) -> None:
    """Push suggestion options to cache with optional weather context.

    weather_context should include:
      - "temp_band": "cold" | "mild" | "hot" (from current temperature)
      - "season": current season string
    """
    try:
        redis = await get_redis()
        key = _cache_key(user_id, occasion)
        pipe = redis.pipeline()
        for s in suggestions:
            entry = dict(s)
            if weather_context:
                entry["_weather_context"] = weather_context
            pipe.rpush(key, json.dumps(entry))
        pipe.expire(key, CACHE_TTL)
        await pipe.execute()
    except Exception:
        logger.warning("Failed to push suggestions to cache", exc_info=True)


async def pop_suggestion(
    user_id,
    occasion,
    *,
    current_temp: float | None = None,
    current_season: str | None = None,
) -> dict | None:
    """Pop the next compatible suggestion from cache.

    Skips suggestions whose stored weather context is materially incompatible
    with the current temperature band or season.
    """
    try:
        redis = await get_redis()
        key = _cache_key(user_id, occasion)

        # Peek at all entries to find a compatible one
        all_raw = await redis.lrange(key, 0, -1)
        if not all_raw:
            return None

        current_band = _temp_band(current_temp)

        for i, raw in enumerate(all_raw):
            entry = json.loads(raw)
            ctx = entry.get("_weather_context", {})
            cached_band = ctx.get("temp_band")
            cached_season = ctx.get("season")

            # Check compatibility
            compatible = True
            if cached_band and current_band and cached_band != current_band:
                # Cold vs hot is incompatible; mild is compatible with both
                if {cached_band, current_band} == {"cold", "hot"}:
                    compatible = False
            if cached_season and current_season and cached_season != current_season:
                # Only reject if seasons are opposites
                opposites = {("winter", "summer"), ("summer", "winter")}
                if (cached_season, current_season) in opposites:
                    compatible = False

            if compatible:
                # Remove this specific entry (by index via LREM with count=1)
                # Since we need to remove from the middle, we use pipeline
                await redis.lrem(key, 1, raw)
                # Remove internal weather context before returning
                entry.pop("_weather_context", None)
                return entry

        # No compatible suggestions found
        return None
    except Exception:
        logger.warning("Failed to pop suggestion from cache", exc_info=True)
        return None


async def clear_suggestions(user_id, occasion) -> None:
    try:
        redis = await get_redis()
        key = _cache_key(user_id, occasion)
        await redis.delete(key)
    except Exception:
        logger.warning("Failed to clear suggestion cache", exc_info=True)


async def has_cached(user_id, occasion) -> bool:
    try:
        redis = await get_redis()
        key = _cache_key(user_id, occasion)
        length = await redis.llen(key)
        return length > 0
    except Exception:
        logger.warning("Failed to check suggestion cache", exc_info=True)
        return False
