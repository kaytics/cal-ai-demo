"""Transparent 429 retry around the ChatLLM seam (rate-limit resilience).

OpenRouter rejects bursts with HTTP 429 (`TooManyRequestsResponseError`), which
otherwise surfaces as a planner failure (prose-only apology) or a dropped outro.
Both the planner and narrator reach the provider only through
`llm.chat.send_async(**kwargs)`, so `RetryingLLM` decorates exactly that one
seam: it retries a 429 with capped exponential backoff (honoring the server's
`Retry-After` when given), and re-raises everything else untouched. Both call
sites are unchanged; production wraps the real client in `provider.make_llm()`.

This guards the `send_async` call — the planner's non-streaming request and the
narrator's stream-open handshake. A 429 that arrives MID-stream surfaces as
`chunk.error` while iterating, not as an exception here, so it is NOT retried:
the narrator drops that outro by design (restarting a stream would re-yield
already-emitted tokens).

The rate-limit check is STRUCTURAL (by exception class name), so this module
imports no SDK and stays key-free and unit-testable with a fake. `sleep` and
`rng` are injected so the retry policy is asserted without real waiting.
"""

from __future__ import annotations

import asyncio
import random
from collections.abc import Awaitable, Callable
from typing import Protocol

# Policy defaults. Tuned for a demo: a handful of tries over a few seconds is
# enough to ride out a short burst without making a failed request feel hung.
DEFAULT_MAX_ATTEMPTS = 4
DEFAULT_BASE_DELAY = 0.5  # seconds; grows 0.5 → 1 → 2 → …
DEFAULT_MAX_DELAY = 8.0  # cap on any single backoff wait

Sleep = Callable[[float], Awaitable[None]]
Rng = Callable[[], float]


def _is_rate_limit(err: BaseException) -> bool:
    """True for OpenRouter's 429. Matched by class name so we needn't import the
    SDK here (keeps this module key-free and independently testable)."""
    return type(err).__name__ == "TooManyRequestsResponseError"


def _retry_after_seconds(err: BaseException) -> float | None:
    """The server's `Retry-After` (delta-seconds) if the error carries one, else
    None. Only the numeric-seconds form is honored; the rarer HTTP-date form
    returns None and falls through to computed backoff. The SDK error exposes the
    raw HTTP response; be defensive about its shape."""
    raw = getattr(err, "raw_response", None)
    headers = getattr(raw, "headers", None)
    if not headers:
        return None
    try:
        value = headers.get("retry-after")
    except AttributeError:
        return None
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


class _Chat(Protocol):
    async def send_async(self, **kwargs: object) -> object: ...


class _ChatLLM(Protocol):
    chat: _Chat


class _RetryingChat:
    """Wraps a chat client, retrying `send_async` on 429."""

    def __init__(
        self,
        inner: _Chat,
        *,
        max_attempts: int,
        base_delay: float,
        max_delay: float,
        sleep: Sleep,
        rng: Rng,
    ) -> None:
        self._inner = inner
        self._max_attempts = max_attempts
        self._base_delay = base_delay
        self._max_delay = max_delay
        self._sleep = sleep
        self._rng = rng

    def _backoff(self, attempt: int, err: BaseException) -> float:
        """Delay before the retry after `attempt` failures (0-indexed). The
        server's Retry-After wins when present; otherwise capped exponential
        backoff with full jitter so concurrent callers don't resynchronize."""
        retry_after = _retry_after_seconds(err)
        if retry_after is not None:
            return retry_after
        ceiling = min(self._max_delay, self._base_delay * (2**attempt))
        return ceiling * self._rng()

    async def send_async(self, **kwargs: object) -> object:
        for attempt in range(self._max_attempts):
            try:
                return await self._inner.send_async(**kwargs)
            # Catch broadly so nothing is swallowed: everything is re-raised
            # except a retriable 429 with attempts left. `Exception` (not
            # `BaseException`) so cancellation/KeyboardInterrupt pass straight
            # through and never look like a provider error.
            except Exception as err:
                last = attempt == self._max_attempts - 1
                if last or not _is_rate_limit(err):
                    raise
                await self._sleep(self._backoff(attempt, err))
        # Unreachable: the loop either returns or raises on the final attempt.
        raise AssertionError("retry loop exited without a result")


class RetryingLLM:
    """Decorate a ChatLLM so provider 429s are retried transparently. Presents
    the same `chat.send_async(**kwargs)` surface, so planner and narrator use it
    unchanged."""

    def __init__(
        self,
        inner: _ChatLLM,
        *,
        max_attempts: int = DEFAULT_MAX_ATTEMPTS,
        base_delay: float = DEFAULT_BASE_DELAY,
        max_delay: float = DEFAULT_MAX_DELAY,
        sleep: Sleep = asyncio.sleep,
        rng: Rng = random.random,
    ) -> None:
        self.chat = _RetryingChat(
            inner.chat,
            max_attempts=max_attempts,
            base_delay=base_delay,
            max_delay=max_delay,
            sleep=sleep,
            rng=rng,
        )
