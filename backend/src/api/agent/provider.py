"""The LLM provider seam (issue #18).

One place that knows we talk to OpenRouter via its official Python SDK, so the
provider/model is swappable behind a single import. Model ids are
env-configurable (no hardcoded default baked into call sites); `openrouter` is
imported lazily so importing this module (and the app) needs no key.
"""

from __future__ import annotations

import os

_DEFAULT_MODEL = "inclusionai/ling-3.0-flash"


def default_model() -> str:
    """The planner model. `PLANNER_MODEL` overrides; a balanced open model by
    default."""
    return os.environ.get("PLANNER_MODEL", _DEFAULT_MODEL)


def narrator_model() -> str:
    """The narrator model (issue #19). `NARRATOR_MODEL` overrides; falls back to
    the planner model so a single knob configures both by default."""
    return os.environ.get("NARRATOR_MODEL", default_model())


def make_llm() -> object:
    """The official OpenRouter client, wrapped so provider 429s are retried with
    backoff (see agent.retry). Raises if the key is unset — only called when an
    Ask request is actually served, never at import."""
    from openrouter import OpenRouter

    from api.agent.retry import RetryingLLM

    client = OpenRouter(api_key=os.environ["OPENROUTER_API_KEY"])
    return RetryingLLM(client)
