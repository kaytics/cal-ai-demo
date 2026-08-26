// Minimal AG-UI SSE consumer for #12: POST the deterministic form-mode request
// and yield each parsed event. The wire is `data:`-only frames (data: {json}\n\n,
// no `event:` line) emitted by the Python EventEncoder (ADR-0001; research #2).
//
// NOTE: this hand-rolls the SSE read because the shell speaks the custom
// {tool_name, arguments} body, not @ag-ui/client's RunAgentInput. Adopting
// @ag-ui/client's HttpAgent (decision #3) needs the shell to speak RunAgentInput
// (or a thin adapter) — deferred to the real agent-loop work.

export type ToolRequest = {
  tool_name: string;
  arguments: Record<string, unknown>;
  intro?: string;
};

// AG-UI events carry a `type` (an EventType value) plus event-specific fields.
export type AguiEvent = { type: string } & Record<string, unknown>;

export async function* streamAgui(
  req: ToolRequest,
  signal?: AbortSignal,
): AsyncGenerator<AguiEvent> {
  const res = await fetch("/agui/run", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`shell responded ${res.status} ${res.statusText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Frames are separated by a blank line.
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      for (const line of frame.split("\n")) {
        if (line.startsWith("data:")) {
          const json = line.slice(5).trim();
          if (json) yield JSON.parse(json) as AguiEvent;
        }
      }
    }
  }
}
