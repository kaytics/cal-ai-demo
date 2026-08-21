"""Starlette ASGI app: the AG-UI SSE endpoint."""

from __future__ import annotations

import uuid

from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse, StreamingResponse
from starlette.routing import Route

from agent import McpToolClient
from agent.loop import ToolPlan, run_turn
from agui import ChannelEmitter


async def health(_: Request) -> JSONResponse:
    return JSONResponse({"status": "ok"})


async def agui_run(request: Request) -> StreamingResponse:
    """POST {tool_name, arguments, intro?} -> AG-UI SSE stream.

    Deterministic form mode: the request names the tool + args directly. The
    Bedrock NL planner (agent.loop.plan_turn) will later produce the ToolPlan
    from free text instead."""
    body = await request.json()
    plan = ToolPlan(
        tool_name=body["tool_name"],
        arguments=body.get("arguments", {}),
        intro=body.get("intro", "Checking the applicable rule…"),
    )
    emitter = ChannelEmitter(accept=request.headers.get("accept"))
    stream = run_turn(
        plan,
        thread_id=body.get("thread_id", str(uuid.uuid4())),
        run_id=str(uuid.uuid4()),
        message_id=str(uuid.uuid4()),
        tool_call_id=str(uuid.uuid4()),
        client=McpToolClient(),
        emitter=emitter,
    )
    return StreamingResponse(stream, media_type=emitter.content_type)


def build_app() -> Starlette:
    return Starlette(
        routes=[
            Route("/health", health),
            Route("/agui/run", agui_run, methods=["POST"]),
        ]
    )


app = build_app()
