import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Landing } from "./Landing";
import * as heading from "../sensors/heading";
import type { HeadingCapability } from "../sensors/heading";

// Mock the sensor functions but keep the pure guessModeFor real so the rendered
// mode genuinely reflects the capability.
vi.mock("../sensors/heading", async (importActual) => {
  const actual = await importActual<typeof import("../sensors/heading")>();
  return {
    ...actual,
    needsHeadingPermission: vi.fn(() => false),
    requestHeadingPermission: vi.fn(() => Promise.resolve("unsupported")),
    detectHeadingCapability: vi.fn(),
  };
});

const needs = vi.mocked(heading.needsHeadingPermission);
const requestPerm = vi.mocked(heading.requestHeadingPermission);
const detect = vi.mocked(heading.detectHeadingCapability);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  needs.mockReturnValue(false);
  requestPerm.mockResolvedValue("unsupported");
});

describe("Landing", () => {
  it("renders identity as real content immediately", () => {
    render(<Landing />);
    expect(
      screen.getByRole("heading", { level: 1, name: "The Inner Compass" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Find out how well you know which way things really are.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Check my compass" }),
    ).toBeInTheDocument();
  });

  it("does not request permission or subscribe to orientation on mount", () => {
    render(<Landing />);
    expect(requestPerm).not.toHaveBeenCalled();
    expect(detect).not.toHaveBeenCalled();
  });

  it("requests permission (when needed) and then detects on button press", async () => {
    needs.mockReturnValue(true);
    requestPerm.mockResolvedValue("granted");
    detect.mockResolvedValue({
      state: "compass_ok",
      source: "ios_compass",
      accuracyDeg: 8,
    });

    render(<Landing />);
    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(detect).toHaveBeenCalled());
    expect(requestPerm).toHaveBeenCalledTimes(1);
    expect(detect).toHaveBeenCalledTimes(1);
    // Order: permission prompt precedes detection.
    expect(requestPerm.mock.invocationCallOrder[0]).toBeLessThan(
      detect.mock.invocationCallOrder[0],
    );
  });

  it("shows a disabled, layout-stable checking state during detection", async () => {
    needs.mockReturnValue(false);
    let resolveDetect: (cap: HeadingCapability) => void = () => {};
    detect.mockReturnValue(
      new Promise<HeadingCapability>((res) => {
        resolveDetect = res;
      }),
    );

    render(<Landing />);
    const button = screen.getByRole("button");
    fireEvent.click(button);

    await waitFor(() => expect(button).toBeDisabled());
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(screen.getAllByText("Checking your compass…").length).toBeGreaterThan(0);

    resolveDetect({ state: "absent", source: "none" });
    await waitFor(() => expect(button).not.toBeDisabled());
  });

  const cases: Array<{
    name: string;
    cap: HeadingCapability;
    copy: string;
    mode: string;
  }> = [
    {
      name: "compass_ok",
      cap: { state: "compass_ok", source: "ios_compass", accuracyDeg: 12 },
      copy: "Compass ready. Readings land within about 12°.",
      mode: "Direction and distance",
    },
    {
      name: "compass_unreliable",
      cap: {
        state: "compass_unreliable",
        source: "android_absolute",
        accuracyDeg: null,
      },
      copy: "Compass readings look unsteady here. You will measure by distance.",
      mode: "Distance only",
    },
    {
      name: "absent",
      cap: { state: "absent", source: "none" },
      copy: "This device has no compass. You will measure by distance.",
      mode: "Distance only",
    },
  ];

  for (const c of cases) {
    it(`renders the exact copy and mode for ${c.name}`, async () => {
      detect.mockResolvedValue(c.cap);
      render(<Landing />);
      fireEvent.click(screen.getByRole("button"));

      expect(await screen.findByText(c.copy)).toBeInTheDocument();
      expect(screen.getByText(c.mode)).toBeInTheDocument();
    });
  }
});
