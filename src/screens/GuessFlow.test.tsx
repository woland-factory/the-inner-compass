import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { GuessFlow } from "./GuessFlow";
import * as heading from "../sensors/heading";
import * as geolocation from "../sensors/geolocation";
import * as liveHeading from "../sensors/liveHeading";
import type { HeadingCapability } from "../sensors/heading";
import type { GeoResult } from "../sensors/geolocation";

vi.mock("../sensors/heading", async (importActual) => {
  const actual = await importActual<typeof import("../sensors/heading")>();
  return {
    ...actual,
    needsHeadingPermission: vi.fn(() => false),
    requestHeadingPermission: vi.fn(() => Promise.resolve("unsupported")),
    detectHeadingCapability: vi.fn(),
  };
});

vi.mock("../sensors/geolocation", () => ({
  getPositionOnce: vi.fn(),
}));

vi.mock("../sensors/liveHeading", () => ({
  subscribeHeading: vi.fn(() => () => {}),
}));

const detect = vi.mocked(heading.detectHeadingCapability);
const needs = vi.mocked(heading.needsHeadingPermission);
const getPos = vi.mocked(geolocation.getPositionOnce);
const subscribe = vi.mocked(liveHeading.subscribeHeading);

const COMPASS_OK: HeadingCapability = {
  state: "compass_ok",
  source: "ios_compass",
  accuracyDeg: 12,
};

// Anchor at the origin; the reveal position is due east of it, so the true
// bearing back to the anchor is west and the distance is measurable (~111 m).
const ANCHOR_FIX: GeoResult = {
  ok: true,
  lat: 0,
  lng: 0,
  accuracyM: 5,
  timestamp: 1,
};
const REVEAL_FIX: GeoResult = {
  ok: true,
  lat: 0,
  lng: 0.001,
  accuracyM: 5,
  timestamp: 2,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function renderFlow() {
  return render(
    <MemoryRouter initialEntries={["/guess"]}>
      <GuessFlow />
    </MemoryRouter>,
  );
}

// Drive setup -> guess with a successful anchor fix and the given capability.
async function reachGuess(cap: HeadingCapability, anchor: "spot" | "home") {
  getPos.mockResolvedValueOnce(ANCHOR_FIX);
  detect.mockResolvedValueOnce(cap);
  const button =
    anchor === "spot" ? "Mark this spot" : "Set as home";
  fireEvent.click(screen.getByRole("button", { name: button }));
  await screen.findByLabelText("How far away is it?");
}

function typeDistance(value: string) {
  fireEvent.change(screen.getByLabelText("How far away is it?"), {
    target: { value },
  });
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  needs.mockReturnValue(false);
  subscribe.mockReturnValue(() => {});
  localStorage.clear();
});

describe("GuessFlow commit gate", () => {
  it("renders nothing target-derived until both parts are committed", async () => {
    renderFlow();
    await reachGuess(COMPASS_OK, "spot");

    // In the guess phase, no truth is in the DOM.
    expect(screen.queryByTestId("reveal")).toBeNull();
    expect(screen.queryByText(/It was to the/)).toBeNull();
    expect(screen.queryByText("Dead on")).toBeNull();
    expect(screen.queryByText(/km\.|m\./)).toBeNull();

    // Commit both parts.
    fireEvent.click(screen.getByRole("button", { name: "Lock direction" }));
    typeDistance("100");

    getPos.mockResolvedValueOnce(REVEAL_FIX);
    fireEvent.click(screen.getByRole("button", { name: "Reveal" }));

    const reveal = await screen.findByTestId("reveal");
    expect(within(reveal).getByText(/It was to the west\./)).toBeInTheDocument();
  });
});

describe("GuessFlow bearing path", () => {
  it("shows the bucket headline, direction word, and floor caption", async () => {
    renderFlow();
    await reachGuess(COMPASS_OK, "home");

    fireEvent.click(screen.getByRole("button", { name: "Lock direction" }));
    typeDistance("100");
    getPos.mockResolvedValueOnce(REVEAL_FIX);
    fireEvent.click(screen.getByRole("button", { name: "Reveal" }));

    const reveal = await screen.findByTestId("reveal");
    // Locked heading is 0 (no live event); true bearing is 270, so error 90 -> "Off by a bit".
    expect(within(reveal).getByText("Off by a bit")).toBeInTheDocument();
    expect(within(reveal).getByText(/It was to the west\./)).toBeInTheDocument();
    expect(
      within(reveal).getByText("Your compass reads to about ±12°."),
    ).toBeInTheDocument();
    expect(within(reveal).getByText(/You guessed 100 m\./)).toBeInTheDocument();
  });
});

describe("GuessFlow distance-only path", () => {
  const distanceOnlyCaps: Array<[string, HeadingCapability]> = [
    ["absent", { state: "absent", source: "none" }],
    [
      "compass_unreliable",
      { state: "compass_unreliable", source: "android_absolute", accuracyDeg: null },
    ],
  ];

  for (const [name, cap] of distanceOnlyCaps) {
    it(`completes with no bearing UI for ${name}`, async () => {
      renderFlow();
      await reachGuess(cap, "spot");

      expect(
        screen.queryByRole("button", { name: "Lock direction" }),
      ).toBeNull();
      expect(
        screen.getByText(
          "This device measures by distance. Guess how far away it is.",
        ),
      ).toBeInTheDocument();

      typeDistance("100");
      getPos.mockResolvedValueOnce(REVEAL_FIX);
      fireEvent.click(screen.getByRole("button", { name: "Reveal" }));

      const reveal = await screen.findByTestId("reveal");
      // Direction word shown as information; no bearing bucket.
      expect(
        within(reveal).getByText(/It was to the west\./),
      ).toBeInTheDocument();
      expect(within(reveal).queryByText("Off by a bit")).toBeNull();
      expect(within(reveal).queryByText("Dead on")).toBeNull();
    });
  }

  it("reaches the same reveal after Skip direction on a compass device", async () => {
    renderFlow();
    await reachGuess(COMPASS_OK, "spot");

    fireEvent.click(screen.getByRole("button", { name: "Skip direction" }));
    expect(screen.queryByRole("button", { name: "Lock direction" })).toBeNull();

    typeDistance("100");
    getPos.mockResolvedValueOnce(REVEAL_FIX);
    fireEvent.click(screen.getByRole("button", { name: "Reveal" }));

    const reveal = await screen.findByTestId("reveal");
    expect(within(reveal).getByText(/It was to the west\./)).toBeInTheDocument();
    expect(within(reveal).queryByText(/margin\./)).toBeNull();
  });
});

describe("GuessFlow fixing and error states", () => {
  it("shows the fixing state synchronously before the reveal fix resolves", async () => {
    renderFlow();
    await reachGuess(COMPASS_OK, "spot");
    fireEvent.click(screen.getByRole("button", { name: "Lock direction" }));
    typeDistance("100");

    const d = deferred<GeoResult>();
    getPos.mockReturnValueOnce(d.promise);
    fireEvent.click(screen.getByRole("button", { name: "Reveal" }));

    expect(screen.getByText("Getting your location.")).toBeInTheDocument();
    d.resolve(REVEAL_FIX);
    await screen.findByTestId("reveal");
  });

  it("shows a designed anchor loading state before the fix resolves", async () => {
    renderFlow();
    const d = deferred<GeoResult>();
    getPos.mockReturnValueOnce(d.promise);
    fireEvent.click(screen.getByRole("button", { name: "Mark this spot" }));

    expect(screen.getByText("Finding where you are.")).toBeInTheDocument();
    detect.mockResolvedValueOnce(COMPASS_OK);
    d.resolve(ANCHOR_FIX);
    await screen.findByLabelText("How far away is it?");
  });

  it("shows reason-specific reveal errors with a working Retry", async () => {
    renderFlow();
    await reachGuess(COMPASS_OK, "spot");
    fireEvent.click(screen.getByRole("button", { name: "Lock direction" }));
    typeDistance("100");

    getPos.mockResolvedValueOnce({ ok: false, reason: "permission_denied" });
    fireEvent.click(screen.getByRole("button", { name: "Reveal" }));

    expect(
      await screen.findByText(
        "Location is blocked. Turn it on in your browser, then tap Retry.",
      ),
    ).toBeInTheDocument();

    // Retry re-runs the fix and reaches the reveal.
    getPos.mockResolvedValueOnce(REVEAL_FIX);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    const reveal = await screen.findByTestId("reveal");
    expect(within(reveal).getByText(/It was to the west\./)).toBeInTheDocument();
  });

  it("offers no Retry when location is unsupported", async () => {
    renderFlow();
    getPos.mockResolvedValueOnce({ ok: false, reason: "unsupported" });
    fireEvent.click(screen.getByRole("button", { name: "Mark this spot" }));

    expect(
      await screen.findByText(
        "This browser cannot share location. Open the app in Safari or Chrome.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });
});

describe("GuessFlow barely-moved guard", () => {
  it("shows the barely-moved state with Guess again", async () => {
    renderFlow();
    await reachGuess(COMPASS_OK, "home");
    fireEvent.click(screen.getByRole("button", { name: "Lock direction" }));
    typeDistance("100");

    // Reveal fix at the anchor: zero distance is not measurable.
    getPos.mockResolvedValueOnce({ ...ANCHOR_FIX, timestamp: 3 });
    fireEvent.click(screen.getByRole("button", { name: "Reveal" }));

    const reveal = await screen.findByTestId("reveal");
    expect(
      within(reveal).getByText(
        "You barely moved. Walk a bit farther, then guess again.",
      ),
    ).toBeInTheDocument();
    expect(
      within(reveal).getByRole("button", { name: "Guess again" }),
    ).toBeInTheDocument();
  });
});

describe("GuessFlow nudges", () => {
  it("shows exactly one nudge per reveal and rotates on the next guess", async () => {
    renderFlow();
    await reachGuess(COMPASS_OK, "home");

    fireEvent.click(screen.getByRole("button", { name: "Lock direction" }));
    typeDistance("100");
    getPos.mockResolvedValueOnce(REVEAL_FIX);
    fireEvent.click(screen.getByRole("button", { name: "Reveal" }));

    let reveal = await screen.findByTestId("reveal");
    expect(within(reveal).getAllByText(/^For next time:/)).toHaveLength(1);
    expect(
      within(reveal).getByText(
        "For next time: Track your turns as you walk. Count the lefts and rights.",
      ),
    ).toBeInTheDocument();

    // Guess again keeps the home anchor and returns to the guess phase.
    fireEvent.click(within(reveal).getByRole("button", { name: "Guess again" }));
    await screen.findByLabelText("How far away is it?");
    fireEvent.click(screen.getByRole("button", { name: "Lock direction" }));
    typeDistance("100");
    getPos.mockResolvedValueOnce(REVEAL_FIX);
    fireEvent.click(screen.getByRole("button", { name: "Reveal" }));

    reveal = await screen.findByTestId("reveal");
    expect(within(reveal).getAllByText(/^For next time:/)).toHaveLength(1);
    expect(
      within(reveal).getByText(
        "For next time: Notice where the sun sits when you set out.",
      ),
    ).toBeInTheDocument();
  });
});

describe("GuessFlow guided first run", () => {
  it("renders the walkthrough when unseen and is skippable", async () => {
    renderFlow();
    expect(
      screen.getByText("Mark where you are standing now."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(
      screen.queryByText("Mark where you are standing now."),
    ).toBeNull();
    expect(localStorage.getItem("ic_seen_walkthrough")).toBe("1");
  });

  it("does not render the walkthrough once the flag is set", () => {
    localStorage.setItem("ic_seen_walkthrough", "1");
    renderFlow();
    expect(
      screen.queryByText("Mark where you are standing now."),
    ).toBeNull();
  });

  it("sets the flag after the first reveal and never shows again", async () => {
    const view = renderFlow();
    await reachGuess(COMPASS_OK, "home");
    fireEvent.click(screen.getByRole("button", { name: "Lock direction" }));
    typeDistance("100");
    getPos.mockResolvedValueOnce(REVEAL_FIX);
    fireEvent.click(screen.getByRole("button", { name: "Reveal" }));

    await screen.findByTestId("reveal");
    expect(localStorage.getItem("ic_seen_walkthrough")).toBe("1");

    view.unmount();
    renderFlow();
    expect(
      screen.queryByText("Mark where you are standing now."),
    ).toBeNull();
  });
});

describe("GuessFlow commit validation", () => {
  it("keeps Reveal disabled until a valid distance and a locked bearing", async () => {
    renderFlow();
    await reachGuess(COMPASS_OK, "home");

    const reveal = () => screen.getByRole("button", { name: "Reveal" });
    expect(reveal()).toBeDisabled();

    typeDistance("100");
    // Distance alone is not enough in bearing mode.
    expect(reveal()).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Lock direction" }));
    expect(reveal()).toBeEnabled();

    // A non-positive distance disables it again.
    typeDistance("0");
    expect(reveal()).toBeDisabled();
  });
});
