"""Small async cache: Redis when configured, in-process TTL dictionary otherwise."""

from __future__ import annotations

import json
import logging
import time
from typing import Any

logger = logging.getLogger(__name__)


class Cache:
    def __init__(self, redis_url: str = "", default_ttl_s: int = 3600, max_items: int = 512) -> None:
        self._ttl = default_ttl_s
        self._max_items = max_items
        self._memory: dict[str, tuple[float, str]] = {}
        self._redis = None
        if redis_url:
            import redis.asyncio as redis

            self._redis = redis.from_url(redis_url, decode_responses=True,
                                         socket_connect_timeout=2, socket_timeout=2)

    @property
    def backend(self) -> str:
        return "redis" if self._redis is not None else "memory"

    async def ping(self) -> bool:
        if self._redis is None:
            return True
        try:
            return bool(await self._redis.ping())
        except Exception:  # noqa: BLE001
            return False

    async def get(self, key: str) -> Any | None:
        raw: str | None = None
        if self._redis is not None:
            try:
                raw = await self._redis.get(key)
            except Exception as exc:  # noqa: BLE001 - cache must never break requests
                logger.warning("Redis get failed: %s", exc)
        else:
            item = self._memory.get(key)
            if item and item[0] > time.monotonic():
                raw = item[1]
            elif item:
                self._memory.pop(key, None)
        return json.loads(raw) if raw else None

    async def set(self, key: str, value: Any, ttl_s: int | None = None) -> None:
        raw = json.dumps(value)
        ttl = ttl_s or self._ttl
        if self._redis is not None:
            try:
                await self._redis.set(key, raw, ex=ttl)
            except Exception as exc:  # noqa: BLE001
                logger.warning("Redis set failed: %s", exc)
            return
        if len(self._memory) >= self._max_items:
            oldest = min(self._memory, key=lambda k: self._memory[k][0])
            self._memory.pop(oldest, None)
        self._memory[key] = (time.monotonic() + ttl, raw)

    async def close(self) -> None:
        if self._redis is not None:
            await self._redis.aclose()
