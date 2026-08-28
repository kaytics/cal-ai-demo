"""Starlette ASGI app: the AG-UI SSE endpoint.

`/agui/run` is the natural-language ("Ask") entry: an NL `message` is planned
into a tool call (agent.planner.plan_turn) and driven through the MCP hop +
channel-split emitter. The structured land-permit "Form" is a separate app
(Scenario A), not a mode here — so there is no `mode` field.
"""

from __future__ import annotations

import uuid

from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse, StreamingResponse
from starlette.routing import Route

from api.agent import McpToolClient
from api.agent import provider as _provider
from api.agent.loop import run_turn
from api.agent.planner import ChatLLM, plan_turn
from api.agui import ChannelEmitter


async def health(_: Request) -> JSONResponse:
    return JSONResponse({"status": "ok"})


def build_app(
    *,
    llm: ChatLLM,
    model: str,
    mcp: McpToolClient,
) -> Starlette:
    """Wire the app. Dependencies are injectable for tests (fake LLM, in-memory
    MCP); production resolves them lazily on first request so importing this
    module needs no API key."""

    async def agui_run(request: Request) -> JSONResponse | StreamingResponse:
        body = await request.json()
        message = body.get("message")
        if not isinstance(message, str) or not message.strip():
            return JSONResponse({"error": "message is required"}, status_code=400)

        plan = await plan_turn(message, mcp=mcp, llm=llm, model=model)

        emitter = ChannelEmitter()
        stream = run_turn(
            plan,
            thread_id=body.get("thread_id", str(uuid.uuid4())),
            run_id=str(uuid.uuid4()),
            message_id=str(uuid.uuid4()),
            tool_call_id=str(uuid.uuid4()),
            client=mcp,
            emitter=emitter,
        )
        return StreamingResponse(stream, media_type=emitter.content_type)

    return Starlette(
        routes=[
            Route("/health", health),
            Route("/agui/run", agui_run, methods=["POST"]),
        ]
    )


def app_factory() -> Starlette:
    """Production wiring. Called by uvicorn at server startup (factory=True),
    NOT at import — so `make_llm()` (which needs OPENROUTER_API_KEY) is only
    reached when actually serving, and importing this module stays key-free."""
    return build_app(
        llm=_provider.make_llm(),
        model=_provider.default_model(),
        mcp=McpToolClient(),
    )
