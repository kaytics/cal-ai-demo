// The channel-split invariant (decision #16, issue #14), enforced here in the
// render WIRING rather than by convention:
//
//   • prose items accumulate ONLY from TEXT_MESSAGE_CONTENT.delta
//   • verdict items carry ONLY TOOL_CALL_RESULT.content
//
// A number therefore has no path into prose: the reducer never writes a
// tool-call payload into a prose item, and the two item kinds have disjoint
// shapes. The UI maps each timeline item to a component that accepts only that
// kind (Prose ← text, VerdictCard ← content), so the split is structural.

import { EventType } from "@ag-ui/core";
import type { AguiEvent } from "./agui";

export type ProseItem = { kind: "prose"; messageId: string; text: string };
export type VerdictItem = { kind: "verdict"; content: string };
export type TimelineItem = ProseItem | VerdictItem;

export type ChannelState = { timeline: TimelineItem[] };

export const emptyChannels: ChannelState = { timeline: [] };

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
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

    case EventType.TOOL_CALL_RESULT: {
      if (typeof event.content !== "string") return state;
      // The verdict channel — a raw contract string, kept out of every prose item.
      return { timeline: [...state.timeline, { kind: "verdict", content: event.content }] };
    }

    default:
      return state;
  }
}
