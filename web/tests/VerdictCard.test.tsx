import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { VerdictCard } from "../src/VerdictCard";

// The real wire payload for the golden `side/4` case (state preemption caps the
// local 5.0 ft minimum at 4.0 ft), produced by the Python adapter. Kept verbatim
// so the test asserts the card renders what the backend actually emits.
const COMPUTED_PREEMPTED = JSON.stringify({
  tool: "rules_check_setbacks",
  version: { image: "dev", ruleset: "demo-city-2026.08" },
  timestamp: "2026-08-26T17:36:22.850994+00:00",
  authority: [
    { cite: "Demo City Muni Code §12.04.030(B)", kind: "local_code" },
    { cite: "Cal. Gov. Code §66323(a)(1)", kind: "statute" },
  ],
  verdict: "pass",
  responseMode: "COMPUTED",
  proposed: 4.0,
  required: 4.0,
  margin: 0.0,
  trace: [
    { label: "Local minimum", expression: "side setback ≥ 5.0 ft", value: 5.0 },
    { label: "State preemption", expression: "required = min(5.0, 4.0)", value: 4.0 },
    { label: "Margin", expression: "4.0 − 4.0", value: 0.0 },
  ],
  preemption: {
    local: { value: 5.0, authority: { cite: "Demo City Muni Code §12.04.030(B)", kind: "local_code" } },
    controlling: { value: 4.0, authority: { cite: "Cal. Gov. Code §66323(a)(1)", kind: "statute" } },
    note: "State law caps the required side setback at 4.0 ft, preempting the local 5.0 ft minimum.",
  },
});

describe("VerdictCard — COMPUTED", () => {
  it("renders the pass verdict with badge, numbers, ruleset and cites", () => {
    render(<VerdictCard content={COMPUTED_PREEMPTED} />);

    expect(screen.getByText("COMPUTED")).toBeInTheDocument();
    expect(screen.getByText("PASS")).toBeInTheDocument();

    // Numbers come straight from the validated payload, never synthesized.
    // proposed and required are both 4 ft in the preempted golden case.
    expect(screen.getAllByText("4 ft")).toHaveLength(2);
    expect(screen.getByText("+0 ft")).toBeInTheDocument(); // margin

    expect(screen.getByText(/demo-city-2026\.08/)).toBeInTheDocument();
    // The controlling cite appears in both the footer list and the preemption block.
    expect(screen.getAllByText(/Cal\. Gov\. Code §66323/).length).toBeGreaterThan(0);
  });

  it("renders the state-preemption block", () => {
    render(<VerdictCard content={COMPUTED_PREEMPTED} />);

    expect(screen.getByText("State preemption applied")).toBeInTheDocument();
    expect(screen.getByText(/State law caps the required side setback/)).toBeInTheDocument();
  });
});

// The real wire payload for the golden ABSTAIN case (front setback with no
// proposed distance): the honest refusal names the exact missing field.
const ABSTAIN = JSON.stringify({
  tool: "rules_check_setbacks",
  version: { image: "dev", ruleset: "demo-city-2026.08" },
  timestamp: "2026-08-27T08:23:52.711666+00:00",
  verdict: "insufficient_input",
  responseMode: "ABSTAIN",
  missing: ["proposed_ft"],
});

describe("VerdictCard — ABSTAIN (must-survive Q2)", () => {
  it("renders the ABSTAIN badge and names the exact missing field", () => {
    render(<VerdictCard content={ABSTAIN} />);

    expect(screen.getByText("ABSTAIN")).toBeInTheDocument();
    expect(screen.getByText("proposed_ft")).toBeInTheDocument();
  });

  it("fabricates no verdict or number for the abstaining case", () => {
    render(<VerdictCard content={ABSTAIN} />);

    expect(screen.queryByText("PASS")).not.toBeInTheDocument();
    expect(screen.queryByText("FAIL")).not.toBeInTheDocument();
    expect(screen.queryByText("COMPUTED")).not.toBeInTheDocument();
    // No proposed/required/margin metrics rendered.
    expect(screen.queryByText(/ ft$/)).not.toBeInTheDocument();
  });
});

describe("VerdictCard — fail-closed", () => {
  it("shows an error, not a verdict, when the content is not valid JSON", () => {
    render(<VerdictCard content="not json" />);
    expect(screen.getByText("Invalid tool result")).toBeInTheDocument();
    expect(screen.queryByText("PASS")).not.toBeInTheDocument();
  });

  it("shows an error when the payload fails contract validation", () => {
    // Missing required COMPUTED fields (proposed/required/margin/trace) — a
    // payload that must be rejected by the strict generated contract.
    const bad = JSON.stringify({
      tool: "rules_check_setbacks",
      version: { image: "dev" },
      timestamp: "2026-08-26T00:00:00+00:00",
      verdict: "pass",
      responseMode: "COMPUTED",
    });
    render(<VerdictCard content={bad} />);
    expect(screen.getByText("Invalid tool result")).toBeInTheDocument();
    expect(screen.queryByText("PASS")).not.toBeInTheDocument();
  });
});
