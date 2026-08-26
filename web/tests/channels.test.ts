import { describe, expect, it } from "vitest";
import { EventType } from "@ag-ui/core";
import { emptyChannels, reduceChannel, type ChannelState } from "../src/channels";
import type { AguiEvent } from "../src/agui";

function run(events: AguiEvent[]): ChannelState {
  return events.reduce(reduceChannel, emptyChannels);
}

const textStart = (messageId: string): AguiEvent => ({ type: EventType.TEXT_MESSAGE_START, messageId, role: "assistant" });
const textDelta = (messageId: string, delta: string): AguiEvent => ({ type: EventType.TEXT_MESSAGE_CONTENT, messageId, delta });
const textEnd = (messageId: string): AguiEvent => ({ type: EventType.TEXT_MESSAGE_END, messageId });
const toolResult = (content: string): AguiEvent => ({ type: EventType.TOOL_CALL_RESULT, messageId: "m", toolCallId: "t", content });

// A verdict payload that contains numbers — used to prove numbers never leak to prose.
const VERDICT = JSON.stringify({ verdict: "pass", responseMode: "COMPUTED", proposed: 4, required: 4, margin: 0 });

describe("reduceChannel — accumulation", () => {
  it("accumulates TEXT_MESSAGE_CONTENT deltas into one prose item", () => {
    const state = run([textStart("m1"), textDelta("m1", "Checking "), textDelta("m1", "the rule…"), textEnd("m1")]);
    expect(state.timeline).toEqual([{ kind: "prose", messageId: "m1", text: "Checking the rule…" }]);
  });

  it("interleaves prose and verdict in stream order (intro → verdict → outro)", () => {
    const state = run([
      textStart("intro"),
      textDelta("intro", "Checking…"),
      textEnd("intro"),
      toolResult(VERDICT),
      textStart("outro"),
      textDelta("outro", "So it passes."),
      textEnd("outro"),
    ]);
    expect(state.timeline.map((i) => i.kind)).toEqual(["prose", "verdict", "prose"]);
    expect(state.timeline[2]).toEqual({ kind: "prose", messageId: "outro", text: "So it passes." });
  });
});

describe("reduceChannel — channel-split invariant", () => {
  it("routes TOOL_CALL_RESULT content ONLY to a verdict item, never into prose", () => {
    const state = run([textStart("m1"), textDelta("m1", "narration"), toolResult(VERDICT)]);

    const prose = state.timeline.filter((i) => i.kind === "prose");
    const verdicts = state.timeline.filter((i) => i.kind === "verdict");

    // The verdict string lives only on the verdict item.
    expect(verdicts).toEqual([{ kind: "verdict", content: VERDICT }]);
    // No prose item's text contains any part of the verdict payload / its numbers.
    for (const p of prose) {
      expect(p.text).toBe("narration");
      expect(p.text).not.toContain("COMPUTED");
      expect(p.text).not.toContain("4");
    }
  });

  it("a TOOL_CALL_RESULT alone produces no prose", () => {
    const state = run([toolResult(VERDICT)]);
    expect(state.timeline.some((i) => i.kind === "prose")).toBe(false);
  });

  it("ignores a content event with a non-string delta (no prose corruption)", () => {
    const state = run([textStart("m1"), { type: EventType.TEXT_MESSAGE_CONTENT, messageId: "m1" } as AguiEvent]);
    expect(state.timeline).toEqual([{ kind: "prose", messageId: "m1", text: "" }]);
  });
});
