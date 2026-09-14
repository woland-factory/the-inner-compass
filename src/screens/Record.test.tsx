import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Record } from "./Record";
import {
  loadGuesses,
  replaceGuesses,
  type StoredGuess,
} from "../record/store";
import { serializeRecord } from "../record/recordFile";

function row(i: number, overrides: Partial<StoredGuess> = {}): StoredGuess {
  return {
    id: `id-${i}`,
    timestamp: 1_000 + i,
    targetKind: "walk_start",
    mode: "bearing",
    guessedBearingDeg: 90,
    trueBearingDeg: 100,
    bearingErrorDeg: 20,
    signedBearingErrorDeg: 20,
    guessedDistanceM: 150,
    trueDistanceM: 100,
    distanceRatio: 1.5,
    headingAccuracyDeg: 12,
    nudgeIndex: 0,
    ...overrides,
  };
}

function seed(rows: StoredGuess[]) {
  replaceGuesses(rows);
}

function renderRecord() {
  return render(
    <MemoryRouter initialEntries={["/record"]}>
      <Record />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("Record empty state", () => {
  it("shows the empty copy and a link to start a walk", () => {
    renderRecord();
    expect(
      screen.getByText("Your record starts with one walk."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Start a walk" }),
    ).toHaveAttribute("href", "/guess");
    expect(screen.queryByText("Your guesses")).toBeNull();
    expect(screen.queryByText(/error signature$/)).toBeNull();
  });
});

describe("Record chart ordering and labels", () => {
  it("puts the distance hero before the bearing chart, each labeled", () => {
    seed(Array.from({ length: 8 }, (_, i) => row(i)));
    const { container } = renderRecord();

    const hero = container.querySelector('[data-role="hero-chart"]');
    const bearing = container.querySelector('[data-role="bearing-chart"]');
    expect(hero).not.toBeNull();
    expect(bearing).not.toBeNull();
    // Hero precedes bearing in DOM order.
    expect(
      hero!.compareDocumentPosition(bearing!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    expect(within(hero as HTMLElement).getByText("Distance calibration")).toBeInTheDocument();
    expect(within(bearing as HTMLElement).getByText("Bearing error")).toBeInTheDocument();

    const heroImg = within(hero as HTMLElement).getByRole("img");
    const bearingImg = within(bearing as HTMLElement).getByRole("img");
    expect(heroImg.getAttribute("aria-label")).toMatch(/distance calibration/i);
    expect(bearingImg.getAttribute("aria-label")).toMatch(/bearing error/i);
  });

  it("shows a positive note when there are no bearing-mode guesses", () => {
    seed(
      Array.from({ length: 6 }, (_, i) =>
        row(i, {
          mode: "distance_only",
          guessedBearingDeg: null,
          bearingErrorDeg: null,
          signedBearingErrorDeg: null,
        }),
      ),
    );
    renderRecord();
    expect(
      screen.getByText("Lock a bearing on your next walk to chart it here."),
    ).toBeInTheDocument();
  });
});

describe("Record low-data state", () => {
  it("states the remaining count and hides the signature below threshold", () => {
    seed(Array.from({ length: 3 }, (_, i) => row(i)));
    renderRecord();
    expect(
      screen.getByText("Your error signature appears after 2 more guesses."),
    ).toBeInTheDocument();
    // The charts and history still render the existing points.
    expect(screen.getByText("Your guesses")).toBeInTheDocument();
    expect(
      screen.queryByText(/Your distance guesses run long/),
    ).toBeNull();
  });

  it("renders the signature once past the threshold", () => {
    seed(Array.from({ length: 6 }, (_, i) => row(i)));
    renderRecord();
    expect(
      screen.getByText(/Your distance guesses run long, about 1.5× the real distance\./),
    ).toBeInTheDocument();
  });
});

describe("Record history pagination", () => {
  it("renders one page and grows on Show more without rendering all at once", () => {
    seed(Array.from({ length: 25 }, (_, i) => row(i)));
    renderRecord();

    const historyRegion = screen.getByLabelText("Your guesses");
    const initialRows = within(historyRegion).getAllByText(/You guessed/);
    expect(initialRows).toHaveLength(10);

    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(within(historyRegion).getAllByText(/You guessed/)).toHaveLength(20);
  });
});

describe("Record export", () => {
  it("creates a download for a non-empty record", () => {
    seed(Array.from({ length: 3 }, (_, i) => row(i)));
    const createUrl = vi.fn(() => "blob:mock");
    const revokeUrl = vi.fn();
    // jsdom does not implement the object-URL API; provide it for the test.
    (URL as unknown as { createObjectURL: unknown }).createObjectURL = createUrl;
    (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = revokeUrl;
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    renderRecord();
    fireEvent.click(screen.getByRole("button", { name: "Export" }));

    expect(createUrl).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeUrl).toHaveBeenCalledTimes(1);
  });
});

describe("Record import", () => {
  function fileWith(text: string): File {
    const file = new File([text], "record.json", {
      type: "application/json",
    });
    // jsdom's File.text is not always present; guarantee it.
    Object.defineProperty(file, "text", {
      value: () => Promise.resolve(text),
    });
    return file;
  }

  it("replaces an empty record directly on a valid file", async () => {
    renderRecord();
    const incoming = [row(1, { id: "imported" })];
    const text = serializeRecord(incoming, "2026-09-14T00:00:00.000Z");

    const input = screen.getByLabelText("Import a record file");
    fireEvent.change(input, { target: { files: [fileWith(text)] } });

    await waitFor(() => {
      expect(loadGuesses().map((g) => g.id)).toContain("imported");
    });
  });

  it("confirms before replacing a non-empty record, then replaces", async () => {
    seed([row(0, { id: "old" })]);
    renderRecord();

    const incoming = [row(1, { id: "fresh" })];
    const text = serializeRecord(incoming, "2026-09-14T00:00:00.000Z");
    const input = screen.getByLabelText("Import a record file");
    fireEvent.change(input, { target: { files: [fileWith(text)] } });

    expect(
      await screen.findByText("Importing replaces your record. Continue?"),
    ).toBeInTheDocument();
    // Not replaced until confirmed.
    expect(loadGuesses().map((g) => g.id)).toEqual(["old"]);

    fireEvent.click(screen.getByRole("button", { name: "Replace" }));
    await waitFor(() => {
      expect(loadGuesses().map((g) => g.id)).toEqual(["fresh"]);
    });
  });

  it("shows a designed error and keeps the record on a bad file", async () => {
    seed([row(0, { id: "keep" })]);
    renderRecord();

    const input = screen.getByLabelText("Import a record file");
    fireEvent.change(input, { target: { files: [fileWith("not json{")] } });

    expect(
      await screen.findByText(
        "That file is not a record this app can read. Pick a file you exported here.",
      ),
    ).toBeInTheDocument();
    expect(loadGuesses().map((g) => g.id)).toEqual(["keep"]);
  });
});
