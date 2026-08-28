"""RetryingLLM: transparent 429 retry around the ChatLLM seam.

Both the planner (non-streaming) and narrator (streaming) reach the provider
only through `llm.chat.send_async(**kwargs)`. RetryingLLM decorates that one
seam so an OpenRouter 429 (`TooManyRequestsResponseError`) is retried with
backoff, transparently to both call sites. Time is injected (`sleep`), so the
tests assert the retry policy without ever waiting.
"""

from __future__ import annotations

import asyncio
from types import SimpleNamespace

from api.agent.retry import RetryingLLM


class _TooManyRequestsResponseError(Exception):
    """A stand-in for the SDK's 429 whose CLASS NAME is what the predicate keys
    on (the real one is openrouter.errors.TooManyRequestsResponseError)."""

    def __init__(self, *, retry_after: str | None = None) -> None:
        super().__init__("Provider returned error")
        headers = {"retry-after": retry_after} if retry_after is not None else {}
        self.raw_response = SimpleNamespace(headers=headers)


# Rename so the class the predicate sees is literally `TooManyRequestsResponseError`.
_TooManyRequestsResponseError.__name__ = "TooManyRequestsResponseError"


class FakeChat:
    """Fails with 429 for the first `fail_times` calls, then returns `result`.
    Records every kwargs it was handed."""

    def __init__(self, *, fail_times: int, result: object = "ok", retry_after: str | None = None) -> None:
        self._fail_times = fail_times
        self._result = result
        self._retry_after = retry_after
        self.calls: list[dict[str, object]] = []

    async def send_async(self, **kwargs: object) -> object:
        self.calls.append(kwargs)
        if len(self.calls) <= self._fail_times:
            raise _TooManyRequestsResponseError(retry_after=self._retry_after)
        return self._result


class RecordingSleep:
    def __init__(self) -> None:
        self.delays: list[float] = []

    async def __call__(self, seconds: float) -> None:
        self.delays.append(seconds)


def _llm(chat: FakeChat) -> object:
    return SimpleNamespace(chat=chat)


def test_retries_a_429_then_returns_the_result() -> None:
    chat = FakeChat(fail_times=2, result="planned")
    sleep = RecordingSleep()
    llm = RetryingLLM(_llm(chat), max_attempts=4, base_delay=0.5, sleep=sleep, rng=lambda: 0.0)

    out = asyncio.run(llm.chat.send_async(model="m", messages=[]))

    assert out == "planned"
    assert len(chat.calls) == 3  # 2 failures + 1 success
    assert len(sleep.delays) == 2  # slept before each retry


def test_first_call_success_never_sleeps_and_passes_kwargs_through() -> None:
    chat = FakeChat(fail_times=0, result="ok")
    sleep = RecordingSleep()
    llm = RetryingLLM(_llm(chat), sleep=sleep, rng=lambda: 0.0)

    out = asyncio.run(llm.chat.send_async(model="m", stream=True, tools=[1, 2]))

    assert out == "ok"
    assert sleep.delays == []
    assert chat.calls == [{"model": "m", "stream": True, "tools": [1, 2]}]


def test_gives_up_after_max_attempts_and_reraises_the_429() -> None:
    chat = FakeChat(fail_times=99)  # always fails
    sleep = RecordingSleep()
    llm = RetryingLLM(_llm(chat), max_attempts=3, sleep=sleep, rng=lambda: 0.0)

    try:
        asyncio.run(llm.chat.send_async(model="m"))
    except Exception as err:  # noqa: BLE001
        assert type(err).__name__ == "TooManyRequestsResponseError"
    else:
        raise AssertionError("expected the 429 to propagate after exhausting retries")

    assert len(chat.calls) == 3  # exactly max_attempts tries
    assert len(sleep.delays) == 2  # slept between, not after the last


def test_a_non_429_error_propagates_immediately_without_retry() -> None:
    class BoomChat:
        def __init__(self) -> None:
            self.calls = 0

        async def send_async(self, **_: object) -> object:
            self.calls += 1
            raise ValueError("not a rate limit")

    chat = BoomChat()
    sleep = RecordingSleep()
    llm = RetryingLLM(_llm(chat), sleep=sleep)

    try:
        asyncio.run(llm.chat.send_async(model="m"))
    except ValueError:
        pass
    else:
        raise AssertionError("expected the non-429 error to propagate")

    assert chat.calls == 1  # no retry
    assert sleep.delays == []


def test_honors_the_retry_after_header_when_present() -> None:
    chat = FakeChat(fail_times=1, result="ok", retry_after="2")
    sleep = RecordingSleep()
    llm = RetryingLLM(_llm(chat), base_delay=0.5, sleep=sleep, rng=lambda: 0.0)

    out = asyncio.run(llm.chat.send_async(model="m"))

    assert out == "ok"
    # The server's Retry-After (2s) wins over the computed backoff.
    assert sleep.delays == [2.0]


def test_predicate_matches_the_real_sdk_error_name() -> None:
    # Lock the structural key: the SDK's 429 class is named as we detect it.
    from openrouter.errors import TooManyRequestsResponseError

    assert TooManyRequestsResponseError.__name__ == "TooManyRequestsResponseError"
