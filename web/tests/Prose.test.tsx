import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Prose } from "../src/Prose";

describe("Prose", () => {
  it("renders narration text in the prose channel", () => {
    render(<Prose text="So the setback passes." />);
    const el = screen.getByText("So the setback passes.");
    expect(el).toBeInTheDocument();
    expect(el).toHaveAttribute("data-channel", "prose");
  });

  it("renders nothing when empty and not streaming", () => {
    const { container } = render(<Prose text="" />);
    expect(container).toBeEmptyDOMElement();
  });
});
