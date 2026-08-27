import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Inspector } from "../src/Inspector";
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

describe("Inspector — drawer", () => {
  it("renders nothing when there is no item", () => {
    const { container } = render(<Inspector item={null} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the structured trace steps from the validated COMPUTED result", () => {
    render(<Inspector item={toolItem()} onClose={() => {}} />);

    expect(screen.getByRole("dialog", { name: "Inspector" })).toBeInTheDocument();
    // The three golden trace steps (label + expression + value).
    expect(screen.getByText("Computation trace · 3 steps")).toBeInTheDocument();
    expect(screen.getByText("Local minimum")).toBeInTheDocument();
    expect(screen.getByText("required = min(5.0, 4.0)")).toBeInTheDocument();
    expect(screen.getByText("State preemption")).toBeInTheDocument();
  });

  it("shows the request arguments and the raw tool-result content", () => {
    render(<Inspector item={toolItem()} onClose={() => {}} />);
    expect(screen.getByText("Arguments")).toBeInTheDocument();
    // Pretty-printed args include the proposed_ft key.
    expect(screen.getByText(/"proposed_ft": 4/)).toBeInTheDocument();
    expect(screen.getByText("Raw TOOL_CALL_RESULT.content")).toBeInTheDocument();
  });

  it("omits the trace section for an ABSTAIN result (no computation)", () => {
    render(<Inspector item={toolItem({ content: ABSTAIN })} onClose={() => {}} />);
    expect(screen.queryByText(/Computation trace/)).not.toBeInTheDocument();
    // The ABSTAIN verdict card still renders, naming the missing field.
    expect(screen.getByText("proposed_ft")).toBeInTheDocument();
  });
});

describe("Inspector — closing", () => {
  it("calls onClose on the close button, the scrim, and Escape", () => {
    const onClose = vi.fn();
    render(<Inspector item={toolItem()} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Close inspector" }));
    fireEvent.click(screen.getByTestId("inspector-scrim"));
    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
