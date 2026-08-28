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
const toolStart = (toolCallId: string, toolCallName: string): AguiEvent => ({ type: EventType.TOOL_CALL_START, toolCallId, toolCallName });
const toolArgs = (toolCallId: string, delta: string): AguiEvent => ({ type: EventType.TOOL_CALL_ARGS, toolCallId, delta });
const toolEnd = (toolCallId: string): AguiEvent => ({ type: EventType.TOOL_CALL_END, toolCallId });
const toolResult = (toolCallId: string, content: string): AguiEvent => ({ type: EventType.TOOL_CALL_RESULT, messageId: "m", toolCallId, content });

// A verdict payload that contains numbers — used to prove numbers never leak to prose.
const VERDICT = JSON.stringify({ verdict: "pass", responseMode: "COMPUTED", proposed: 4, required: 4, margin: 0 });

describe("reduceChannel — accumulation", () => {
  it("accumulates TEXT_MESSAGE_CONTENT deltas into one prose item", () => {
    const state = run([textStart("m1"), textDelta("m1", "Checking "), textDelta("m1", "the rule…"), textEnd("m1")]);
    expect(state.timeline).toEqual([{ kind: "prose", messageId: "m1", text: "Checking the rule…" }]);
  });

  it("interleaves prose and the tool item in stream order (intro → tool)", () => {
    const state = run([
      textStart("intro"),
      textDelta("intro", "Checking…"),
      textEnd("intro"),
      toolStart("t1", "rules_check_setbacks"),
      toolArgs("t1", '{"setback":"side"}'),
      toolEnd("t1"),
      toolResult("t1", VERDICT),
    ]);
    expect(state.timeline.map((i) => i.kind)).toEqual(["prose", "tool"]);
  });
});

describe("reduceChannel — tool-call lifecycle", () => {
  it("opens a tool item on START with name and empty args/content", () => {
    const state = run([toolStart("t1", "rules_check_setbacks")]);
    expect(state.timeline).toEqual([
      { kind: "tool", toolCallId: "t1", toolName: "rules_check_setbacks", argsJson: "", content: null },
    ]);
  });

  it("accumulates ARGS deltas onto the matching tool item by toolCallId", () => {
    const state = run([toolStart("t1", "tool"), toolArgs("t1", '{"a":'), toolArgs("t1", "1}")]);
    const tool = state.timeline[0];
    expect(tool.kind === "tool" && tool.argsJson).toBe('{"a":1}');
  });

  it("attaches TOOL_CALL_RESULT content to the matching tool item, not a new item", () => {
    const state = run([toolStart("t1", "tool"), toolEnd("t1"), toolResult("t1", VERDICT)]);
    expect(state.timeline).toHaveLength(1);
    const tool = state.timeline[0];
    expect(tool.kind === "tool" && tool.content).toBe(VERDICT);
  });

  it("routes ARGS/RESULT to the right item when two tool calls interleave", () => {
    const state = run([
      toolStart("t1", "a"),
      toolStart("t2", "b"),
      toolArgs("t2", "B"),
      toolArgs("t1", "A"),
      toolResult("t1", VERDICT),
    ]);
    const [a, b] = state.timeline;
    expect(a.kind === "tool" && a.argsJson).toBe("A");
    expect(a.kind === "tool" && a.content).toBe(VERDICT);
    expect(b.kind === "tool" && b.argsJson).toBe("B");
    expect(b.kind === "tool" && b.content).toBe(null);
  });
});

describe("reduceChannel — channel-split invariant", () => {
  it("keeps the verdict content on the tool item, never into prose", () => {
    const state = run([
      textStart("m1"),
      textDelta("m1", "narration"),
      toolStart("t1", "tool"),
      toolResult("t1", VERDICT),
    ]);

    const prose = state.timeline.filter((i) => i.kind === "prose");
    const tools = state.timeline.filter((i) => i.kind === "tool");

    // The verdict string lives only on the tool item.
    expect(tools.map((t) => t.kind === "tool" && t.content)).toEqual([VERDICT]);
    // No prose item's text contains any part of the verdict payload / its numbers.
    for (const p of prose) {
      if (p.kind !== "prose") continue;
      expect(p.text).toBe("narration");
      expect(p.text).not.toContain("COMPUTED");
      expect(p.text).not.toContain("4");
    }
  });

  it("a TOOL_CALL_RESULT alone produces no prose (defensive standalone tool item)", () => {
    const state = run([toolResult("t1", VERDICT)]);
    expect(state.timeline.some((i) => i.kind === "prose")).toBe(false);
    expect(state.timeline).toEqual([
      { kind: "tool", toolCallId: "t1", toolName: "", argsJson: "", content: VERDICT },
    ]);
  });

  it("ignores a content event with a non-string delta (no prose corruption)", () => {
    const state = run([textStart("m1"), { type: EventType.TEXT_MESSAGE_CONTENT, messageId: "m1" } as AguiEvent]);
    expect(state.timeline).toEqual([{ kind: "prose", messageId: "m1", text: "" }]);
  });
});

// The NL Ask turn shapes the backend emits (#18–#21; canonical frame sequences
// in backend/tests/test_agui_endpoint.py). The narrator outro is a SECOND text
// message after the tool result; a prose-only turn carries no tool lifecycle.
describe("reduceChannel — NL turn shapes", () => {
  it("appends the narrator outro as a second prose bubble, keeping the intro", () => {
    const state = run([
      textStart("intro"),
      textDelta("intro", "Checking the front setback…"),
      textEnd("intro"),
      toolStart("t1", "rules_check_setbacks"),
      toolArgs("t1", '{"setback":"front","proposed_ft":25}'),
      toolEnd("t1"),
      toolResult("t1", VERDICT),
      // A NEW message id after the tool result — the streamed outro.
      textStart("outro"),
      textDelta("outro", "The proposed setback "),
      textDelta("outro", "clears the minimum."),
      textEnd("outro"),
    ]);

    expect(state.timeline.map((i) => i.kind)).toEqual(["prose", "tool", "prose"]);
    const prose = state.timeline.filter((i) => i.kind === "prose") as { messageId: string; text: string }[];
    // Two DISTINCT prose bubbles — the outro is appended, not merged into the intro.
    expect(prose.map((p) => p.messageId)).toEqual(["intro", "outro"]);
    expect(prose[0].text).toBe("Checking the front setback…");
    expect(prose[1].text).toBe("The proposed setback clears the minimum.");
  });

  it("renders a prose-only turn (decline/apology) as a single bubble with no card", () => {
    const state = run([
      textStart("m1"),
      textDelta("m1", "I can only help with permitting rules like setbacks."),
      textEnd("m1"),
    ]);

    expect(state.timeline).toEqual([
      { kind: "prose", messageId: "m1", text: "I can only help with permitting rules like setbacks." },
    ]);
    expect(state.timeline.some((i) => i.kind === "tool")).toBe(false);
  });
});
