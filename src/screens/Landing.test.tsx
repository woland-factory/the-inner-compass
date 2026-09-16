import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Landing } from "./Landing";
import { loadGuesses } from "../record/store";

afterEach(() => {
  cleanup();
  localStorage.clear();
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

  it("hides the sample panel until the sample button is tapped", () => {
    renderLanding();
    expect(
      screen.queryByRole("heading", { level: 2, name: "A sample guess" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/° off\./)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try a sample guess" }),
    ).toBeInTheDocument();
  });

  it("reveals a real scored measurement on tap", () => {
    renderLanding();
    fireEvent.click(screen.getByRole("button", { name: "Try a sample guess" }));

    expect(
      screen.getByRole("heading", { level: 2, name: "A sample guess" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Here is a real guess scored against the truth."),
    ).toBeInTheDocument();
    // A concrete, non-zero degrees-off line from the real engine.
    expect(screen.getByText(/^[1-9]\d*° off\.$/)).toBeInTheDocument();
    // A real distance comparison with a verdict.
    expect(
      screen.getByText(/^You guessed .+\. It was .+\.$/),
    ).toBeInTheDocument();
    expect(screen.getByText("You guessed long.")).toBeInTheDocument();
    expect(screen.getByText("Now measure your own.")).toBeInTheDocument();
    // The landing has no device compass, so its caption stays off.
    expect(
      screen.queryByText(/Your compass reads to about/),
    ).not.toBeInTheDocument();
  });

  it("keeps a single h1 and a non-skipping outline with the sample open", () => {
    renderLanding();
    fireEvent.click(screen.getByRole("button", { name: "Try a sample guess" }));

    // Exactly one h1 on the app's front door: the landing title.
    const h1s = screen.getAllByRole("heading", { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent("The Inner Compass");

    // The sample panel is h2, and the bucket headline inside it is h3, so the
    // outline reads 1, 2, 3 without skipping backward.
    expect(
      screen.getByRole("heading", { level: 2, name: "A sample guess" }),
    ).toBeInTheDocument();
    const h3 = screen.getByRole("heading", { level: 3 });
    // The bucket headline from the real engine (for example "Close").
    expect(h3.textContent).toBeTruthy();
    expect(h3).toHaveTextContent(/^[A-Z]/);
  });

  it("stores nothing when the sample is revealed", () => {
    renderLanding();
    fireEvent.click(screen.getByRole("button", { name: "Try a sample guess" }));

    expect(loadGuesses()).toEqual([]);
    expect(localStorage.getItem("ic_seen_walkthrough")).toBeNull();
    expect(localStorage.length).toBe(0);
  });
});
