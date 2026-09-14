import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Landing } from "./Landing";

afterEach(() => {
  cleanup();
});

function renderLanding() {
  return render(
    <MemoryRouter>
      <Landing />
    </MemoryRouter>,
  );
}

describe("Landing", () => {
  it("renders identity as real content immediately", () => {
    renderLanding();
    expect(
      screen.getByRole("heading", { level: 1, name: "The Inner Compass" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Find out how well you know which way things really are.",
      ),
    ).toBeInTheDocument();
  });

  it("links into the guess flow with a single primary action", () => {
    renderLanding();
    const start = screen.getByRole("link", { name: "Start a walk" });
    expect(start).toHaveAttribute("href", "/guess");
    // No competing compass-check control lives on the landing anymore.
    expect(
      screen.queryByRole("button", { name: /compass/i }),
    ).not.toBeInTheDocument();
  });
});
