# Python AG-UI server emitter — the Python equivalent of chunk-01 (ticket #8)

## Question

The backend is now Python + FastMCP. The `agent` (the LLM loop that emits AG-UI
events) is Python, so AG-UI events must be emitted from Python. Chunk-01 established
that on the TypeScript side the server emitter is `@ag-ui/core` (types/Zod schemas) +
`@ag-ui/encoder` (SSE framing). Does a **Python / FastMCP-compatible AG-UI server
emitter** exist that is the equivalent? Concretely:

1. Is there an official/maintained **Python AG-UI SDK** (event types + SSE encoder)
   usable server-side? Package, version, maintainer, license, install, URLs.
2. Does it support the two channels chunk-01 relies on — a `TOOL_CALL_RESULT.content`
   **string** channel for the structured result, plus a separate **prose** channel?
   Does its encoder **validate** payloads, or (like the TS `encode()`) pass strings
   through unvalidated, so a Pydantic parse must remain the fail-closed gate?
3. How does it integrate with a FastMCP/ASGI server (SSE endpoint framing)? FastMCP
   interop notes.
4. If no mature SDK exists: minimal viable hand-roll path, citing the spec schema.

All facts below are from primary sources: the `ag-ui-protocol/ag-ui` GitHub repo, the
official AG-UI docs (`docs.ag-ui.com`), and the PyPI JSON API. Accessed 2026-08-21.

## Answer (bottom-line first)

**Yes — a first-party Python AG-UI SDK exists and is the direct equivalent of
chunk-01's `@ag-ui/core` + `@ag-ui/encoder`.** It is the single PyPI package
**`ag-ui-protocol`**, which bundles both the type/event layer (`ag_ui.core`, Pydantic
models) and the SSE encoder (`ag_ui.encoder.EventEncoder`).

- **Latest version:** `0.1.20` (released 2026-08-14).
- **License:** MIT. **Author:** Markus Ecker; **maintainer/owner:** CopilotKit (the
  same org that maintains the AG-UI protocol and the TS `@ag-ui/*` packages).
- **Install:** `pip install ag-ui-protocol` (project uses `uv` → `uv add ag-ui-protocol`).
  Requires Python ≥ 3.9 and Pydantic ≥ 2.11.2.
- **Both channels are supported.** `ToolCallResultEvent.content` is typed **`str`**
  (same string-only constraint as the TS Zod schema), so a structured result must be
  `json.dumps(...)`-serialized into it; prose travels on the separate
  `TextMessageContentEvent.delta` (`str`) channel. The split is structurally available
  but, exactly as in TS, **not enforced** — it stays our discipline.
- **The encoder does NOT validate.** `EventEncoder.encode()` just calls
  `event.model_dump_json(by_alias=True)` and wraps it as `data: {json}\n\n`. Validation
  happens (if at all) when you *construct* the Pydantic event object, not at encode
  time. So a **Pydantic parse of the structured payload must remain the fail-closed
  gate** — the encoder will happily serialize whatever string you put in `content`.
- **Integration is idiomatic ASGI/FastAPI** (`StreamingResponse` +
  `media_type=encoder.get_content_type()`), which drops straight onto a FastMCP server's
  ASGI app as a custom route. No FastMCP-specific adapter is required or exists; FastMCP
  and AG-UI are orthogonal (MCP = tool transport; AG-UI = agent→UI event stream).

**Recommendation for #9: use the library (`ag-ui-protocol`), do not hand-roll.**

## Evidence

### Q1 — the Python SDK

The AG-UI monorepo has a Python SDK alongside the TypeScript one, at
`sdks/python`, packaging `ag_ui.core` (types/events/models) and `ag_ui.encoder`
(encoding utilities).
Source: https://github.com/ag-ui-protocol/ag-ui/tree/main/sdks/python

PyPI metadata (via `https://pypi.org/pypi/ag-ui-protocol/json`, accessed 2026-08-21):

| Field | Value |
|---|---|
| Package | `ag-ui-protocol` |
| Latest version | `0.1.20` |
| Release date | 2026-08-14 |
| License | MIT |
| Author | Markus Ecker (markus.ecker@gmail.com) |
| Maintainer/owner | CopilotKit |
| Requires | Python ≥ 3.9; Pydantic ≥ 2.11.2 |
| Summary | "Python SDK … strongly-typed data structures and event encoding for building AG-UI compatible agent servers, built on Pydantic with automatic camelCase serialization." |

Package page: https://pypi.org/project/ag-ui-protocol/ ·
Encoder docs: https://docs.ag-ui.com/sdk/python/encoder/overview

**Maturity note:** like the TS packages this is pre-1.0 (`0.1.x`) and versioned by the
same maintainer (CopilotKit), so the wire contract is stabilising but not frozen. Note
the Python line is at `0.1.20` while the TS line is at `0.0.58` — the two SDKs are
**not** version-locked to each other, so pin each independently.

### Q2 — both channels, and validation behaviour

Event schemas from `sdks/python/ag_ui/core/events.py`
(https://github.com/ag-ui-protocol/ag-ui/blob/main/sdks/python/ag_ui/core/events.py):

```python
class ToolCallResultEvent(BaseEvent):
    message_id: str
    type: Literal[EventType.TOOL_CALL_RESULT]
    tool_call_id: str
    content: str                      # structured result must be a STRING
    role: Optional[Literal["tool"]] = None

class TextMessageContentEvent(BaseEvent):
    type: Literal[EventType.TEXT_MESSAGE_CONTENT]
    message_id: str
    delta: str                        # prose channel
```

So the **two channels of chunk-01 are present and identical in shape** to the TS side:
the structured/verdict result rides `TOOL_CALL_RESULT.content` (a `str`; serialize with
`json.dumps({...})`), and prose rides `TEXT_MESSAGE_CONTENT.delta`. As in TS, nothing
stops a producer from putting a number into `delta` — the schema gives you the two lanes
but does not enforce that numbers stay in the result lane. A thin project-owned emitter
with two typed methods (`emit_verdict(...)` → `TOOL_CALL_RESULT` only; `emit_prose(...)`
→ `TEXT_MESSAGE_*` only) is the way to make the split unbreakable, same conclusion as
chunk-01.

Full `EventType` enum (same file) includes the flow we need — `RUN_STARTED`,
`TEXT_MESSAGE_START/CONTENT/END`, `TOOL_CALL_START/ARGS/END/RESULT`, `RUN_FINISHED`,
`RUN_ERROR` — plus additional families (`THINKING_*`, `REASONING_*`, `STATE_*`,
`STEP_*`, `RAW`, `CUSTOM`).

**Encoder does not validate — it serializes.** From
`sdks/python/ag_ui/encoder/encoder.py`
(https://github.com/ag-ui-protocol/ag-ui/blob/main/sdks/python/ag_ui/encoder/encoder.py):

- `EventEncoder(accept: Optional[str] = None)` — inspects the client `Accept` header.
- `get_content_type()` → `"text/event-stream"`.
- `encode(event)` → calls `_encode_sse(event)`.
- `_encode_sse(event)` → `f"data: {event.model_dump_json(by_alias=True)}\n\n"`.

This is the exact analogue of the TS `encodeSSE`: **a `data:`-only SSE frame, no
`event:` line, no `id:` line**, content-type `text/event-stream`. `encode()` performs
**no validation** — it just JSON-serializes the already-constructed Pydantic model
(`by_alias=True` → camelCase on the wire). Therefore the fail-closed gate must be the
**Pydantic construction/parse** of the payload before it reaches `content`, not the
encoder. `content: str` means the encoder cannot catch a malformed structured result;
validate the structured object with its own Pydantic model, then `json.dumps` it into
`content`.

### Q3 — FastMCP / ASGI integration

The official server quickstart shows the canonical FastAPI pattern
(https://docs.ag-ui.com/quickstart/server):

```python
from fastapi.responses import StreamingResponse
from ag_ui.encoder import EventEncoder

@app.post("/awp")
async def endpoint(request: Request):
    encoder = EventEncoder(accept=request.headers.get("accept"))
    async def event_generator():
        yield encoder.encode(RunStartedEvent(...))
        # ... TOOL_CALL_* / TEXT_MESSAGE_* events ...
        yield encoder.encode(RunFinishedEvent(...))
    return StreamingResponse(event_generator(), media_type=encoder.get_content_type())
```

This is plain ASGI: an async generator yielding encoded strings behind
`StreamingResponse`, with `media_type` from `encoder.get_content_type()`.

**FastMCP interop:** there is **no FastMCP-specific AG-UI adapter, and none is needed.**
The two protocols are orthogonal — MCP (what FastMCP serves) is the tool/transport
protocol between the agent and its tools; AG-UI is the agent→frontend event stream. The
AG-UI SSE endpoint is just another route on the same ASGI application. FastMCP exposes
its underlying Starlette/ASGI app (e.g. via `FastMCP.http_app()` /
`streamable_http_app()`), onto which the AG-UI `StreamingResponse` route mounts like any
other custom route; alternatively run the AG-UI emitter as its own small FastAPI/ASGI
app beside the MCP app. First-party AG-UI integrations that exist are agent-framework
adapters (LangGraph via CopilotKit's `LangGraphAGUIAgent`, Pydantic AI's `AGUIAdapter`,
AWS Bedrock AgentCore), not tool-transport adapters — confirming AG-UI emission sits at
the agent/HTTP layer, independent of how tools are served.
Sources: https://docs.ag-ui.com/quickstart/server ·
https://pydantic.dev/docs/ai/integrations/ui/ag-ui/ ·
https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-agui.html

### Q4 — hand-roll path (not recommended, documented for completeness)

If we chose to hand-roll, the entire wire contract is one line —
`f"data: {json.dumps(event_dict)}\n\n"` — matching `_encode_sse` above, plus building
~10 event dicts with the fields in Q2 and a `uuid4()` helper (~60–120 LOC including the
two-channel wrapper). The cost of hand-rolling is losing the Pydantic models
(construction-time validation + camelCase aliasing) and having to mirror the event
schema by hand as it moves toward 1.0. Given the library is first-party, MIT, and a
single dependency that provides exactly these, the hand-roll delta is not worth it.
Spec schema cited: https://github.com/ag-ui-protocol/ag-ui/blob/main/sdks/python/ag_ui/core/events.py

## Recommendation for ticket #9

**Library, not hand-roll.** Adopt `ag-ui-protocol` (pin `0.1.20`;
`uv add ag-ui-protocol`). Use `ag_ui.core` events + `ag_ui.encoder.EventEncoder` inside
a FastAPI/ASGI `StreamingResponse` route on the FastMCP ASGI app (or a sibling ASGI
app). No FastMCP adapter is needed.

Because `encode()` does not validate and `TOOL_CALL_RESULT.content` is a bare `str`,
keep a **fail-closed Pydantic gate on the structured result** before serializing it into
`content` (validate a result model → `json.dumps` → assign to `content`). Wrap the
encoder in a thin project-owned emitter exposing exactly two typed methods —
`emit_verdict(...)` (→ `TOOL_CALL_RESULT` only) and `emit_prose(...)` (→
`TEXT_MESSAGE_*` only) — so the channel split cannot be crossed. This mirrors
chunk-01's TS recommendation, keeping both sides on the same canonical, CopilotKit-
maintained contract.

Follow-ups: pin the Python version independently of the TS `@ag-ui/*` line (they are not
version-locked — Python `0.1.20` vs TS `0.0.58`); re-check before each bump since both
are pre-1.0; confirm the frontend verdict-card consumer expects `content` as a JSON
*string*.
