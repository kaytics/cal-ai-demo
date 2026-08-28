import { afterEach, describe, expect, it, vi } from "vitest";
import { streamAgui, type AguiEvent } from "../src/agui";

// Encode a list of AG-UI frames as the `data:`-only SSE the Python emitter sends.
function sseStream(frames: object[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  const body = frames.map((f) => `data: ${JSON.stringify(f)}\n\n`).join("");
  return new ReadableStream({
    start(controller) {
      controller.enqueue(enc.encode(body));
      controller.close();
    },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("streamAgui — NL request boundary", () => {
  it("POSTs the natural-language message as {message} to /agui/run", async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init: RequestInit): Promise<Response> =>
        new Response(sseStream([{ type: "RUN_STARTED" }, { type: "RUN_FINISHED" }]), {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const events: AguiEvent[] = [];
    for await (const event of streamAgui({ message: "Is a 4 ft side setback OK?" })) {
      events.push(event);
    }

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/agui/run");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ message: "Is a 4 ft side setback OK?" });
    expect(events.map((e) => e.type)).toEqual(["RUN_STARTED", "RUN_FINISHED"]);
  });

  it("throws when the shell rejects the request (e.g. 400)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 400, statusText: "Bad Request" })),
    );

    await expect(async () => {
      for await (const _ of streamAgui({ message: "" })) {
        // drain
      }
    }).rejects.toThrow(/400/);
  });
});
