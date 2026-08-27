// The channel-split invariant (decision #16, issue #14), enforced here in the
// render WIRING rather than by convention:
//
//   • prose items accumulate ONLY from TEXT_MESSAGE_CONTENT.delta
//   • a tool item's verdict `content` carries ONLY TOOL_CALL_RESULT.content
//
// A number therefore has no path into prose: the reducer never writes a
// tool-call payload into a prose item, and the item kinds have disjoint shapes.
// The UI maps each timeline item to a component that accepts only that kind
// (Prose ← text, ToolCallWidget ← the tool item), so the split is structural.
//
// The tool item ALSO carries the request `argsJson` (from TOOL_CALL_ARGS). Those
// are inputs the caller supplied, not a computed verdict — the invariant is that
// a *computed* number is never fabricated in prose, and args live on the tool
// item next to the verdict, never in a prose segment.

import { EventType } from "@ag-ui/core";
import type { AguiEvent } from "./agui";

export type ProseItem = { kind: "prose"; messageId: string; text: string };
export type ToolCallItem = {
  kind: "tool";
  toolCallId: string;
  toolName: string;
  argsJson: string;
  // The validated TOOL_CALL_RESULT.content, or null until the result arrives.
  content: string | null;
};
export type TimelineItem = ProseItem | ToolCallItem;

export type ChannelState = { timeline: TimelineItem[] };

export const emptyChannels: ChannelState = { timeline: [] };

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

// Immutably map the tool item matching `toolCallId`, leaving the rest untouched.
function updateTool(
  state: ChannelState,
  toolCallId: string,
  fn: (item: ToolCallItem) => ToolCallItem,
): ChannelState {
  let found = false;
  const timeline = state.timeline.map((item) => {
    if (item.kind === "tool" && item.toolCallId === toolCallId) {
      found = true;
      return fn(item);
    }
    return item;
  });
  return found ? { timeline } : state;
}

export function reduceChannel(state: ChannelState, event: AguiEvent): ChannelState {
  switch (event.type) {
    case EventType.TEXT_MESSAGE_START: {
      // Open a new prose segment. Never seeded with anything but empty text.
      const item: ProseItem = { kind: "prose", messageId: str(event.messageId), text: "" };
      return { timeline: [...state.timeline, item] };
    }

    case EventType.TEXT_MESSAGE_CONTENT: {
      if (typeof event.delta !== "string") return state;
      const timeline = state.timeline.slice();
      const last = timeline[timeline.length - 1];
      if (last && last.kind === "prose") {
        // Append the delta to the open prose segment — the ONLY way prose grows.
        timeline[timeline.length - 1] = { ...last, text: last.text + event.delta };
      } else {
        // Defensive: content before a start opens a segment from the delta.
        timeline.push({ kind: "prose", messageId: str(event.messageId), text: event.delta });
      }
      return { timeline };
    }

    case EventType.TEXT_MESSAGE_END:
      // Segment already materialized from its deltas; nothing to add.
      return state;

    case EventType.TOOL_CALL_START: {
      // Open a tool-call widget on the sequence rail; args/verdict fill in later.
      const item: ToolCallItem = {
        kind: "tool",
        toolCallId: str(event.toolCallId),
        toolName: str(event.toolCallName),
        argsJson: "",
        content: null,
      };
      return { timeline: [...state.timeline, item] };
    }

    case EventType.TOOL_CALL_ARGS: {
      if (typeof event.delta !== "string") return state;
      // Accumulate the request args onto the matching tool item.
      return updateTool(state, str(event.toolCallId), (item) => ({
        ...item,
        argsJson: item.argsJson + event.delta,
      }));
    }

    case EventType.TOOL_CALL_END:
      // Args stream closed; the verdict arrives on TOOL_CALL_RESULT. No-op.
      return state;

    case EventType.TOOL_CALL_RESULT: {
      if (typeof event.content !== "string") return state;
      const toolCallId = str(event.toolCallId);
      // The verdict channel — a raw contract string, attached to its tool item
      // and kept out of every prose item.
      const attached = updateTool(state, toolCallId, (item) => ({
        ...item,
        content: event.content as string,
      }));
      if (attached !== state) return attached;
      // Defensive: a result with no preceding START still renders as a widget.
      return {
        timeline: [
          ...state.timeline,
          { kind: "tool", toolCallId, toolName: "", argsJson: "", content: event.content },
        ],
      };
    }

    default:
      return state;
  }
}
