import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ToolCallWidget } from "../src/ToolCallWidget";
import type { ToolCallItem } from "../src/channels";
import { COMPUTED_PREEMPTED, ABSTAIN } from "./golden";

function toolItem(overrides: Partial<ToolCallItem> = {}): ToolCallItem {
  return {
    kind: "tool",
    toolCallId: "t1",
    toolName: "rules_check_setbacks",
    argsJson: '{"setback":"side","proposed_ft":4}',
    content: COMPUTED_PREEMPTED,
    ...overrides,
  };
}

describe("ToolCallWidget — collapsed head", () => {
  it("shows the badge, tool name and a one-line summary without the verdict card", () => {
    render(<ToolCallWidget item={toolItem()} onInspect={() => {}} />);

    expect(screen.getByText("COMPUTED")).toBeInTheDocument();
    expect(screen.getByText("rules_check_setbacks")).toBeInTheDocument();
    expect(screen.getByText(/PASS · 4 ft proposed \/ 4 ft required/)).toBeInTheDocument();

    // Collapsed: the expanded verdict card's preemption block is not rendered.
    expect(screen.queryByText("State preemption applied")).not.toBeInTheDocument();
  });

  it("summarizes an ABSTAIN result by naming the missing-field count", () => {
    render(<ToolCallWidget item={toolItem({ content: ABSTAIN })} onInspect={() => {}} />);
    expect(screen.getByText("ABSTAIN")).toBeInTheDocument();
    expect(screen.getByText(/Insufficient input · 1 field missing/)).toBeInTheDocument();
  });
});

describe("ToolCallWidget — collapsible body", () => {
  it("expands to reveal the reused VerdictCard on toggle", () => {
    render(<ToolCallWidget item={toolItem()} onInspect={() => {}} />);

    expect(screen.queryByText("State preemption applied")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(screen.getByText("State preemption applied")).toBeInTheDocument();
  });
});

describe("ToolCallWidget — Inspect action", () => {
  it("calls onInspect with the tool item when Inspect is clicked", () => {
    const onInspect = vi.fn();
    const item = toolItem();
    render(<ToolCallWidget item={item} onInspect={onInspect} />);

    fireEvent.click(screen.getByRole("button", { name: /Inspect/ }));
    expect(onInspect).toHaveBeenCalledWith(item);
  });

  it("offers no Inspect action while the result has not arrived", () => {
    render(<ToolCallWidget item={toolItem({ content: null })} onInspect={() => {}} />);
    expect(screen.queryByRole("button", { name: /Inspect/ })).not.toBeInTheDocument();
    expect(screen.getByText("RUNNING")).toBeInTheDocument();
  });
});
