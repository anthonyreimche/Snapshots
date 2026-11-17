// The Snapshots panel in a DOM, over real zustand stores: the open photo's
// snapshots read when it opens, taken, put back as one step, previewed while
// held, renamed, deleted, kept per photo, and offered to a compare tool.

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { COMPARE_REFERENCE, type CompareReference } from "../src/compare";
import { activate, deactivate } from "../src/index";
import { ACTION_CLASS, DETAIL_CLASS, HOLD_MS, NOTE_CLASS, ROW_CLASS, SnapshotsPanel } from "../src/SnapshotsPanel";
import type { ParamDescriptor } from "../src/safelight";
import { DATA_KEY, decodeSnapshots, encodeSnapshots, takeSnapshot, type Snapshot } from "../src/snapshots";
import { React } from "../src/rt";
import { fakeApi, type Rig } from "./support/fake-api";

afterEach(() => {
  cleanup();
  deactivate();
  vi.useRealTimers();
});

const GLOW: ParamDescriptor = {
  qualifiedKey: "glow.amount",
  localKey: "amount",
  stageId: "glow",
  stageName: "Glow",
  extensionName: "Glow",
  default: 0,
  label: "Amount",
};

function store(rig: Rig, photoId: string, snapshots: Snapshot[]): void {
  rig.photoData.set(photoId, new Map([[DATA_KEY, encodeSnapshots(snapshots)]]));
}

const stored = (rig: Rig, photoId = "photo-1") => decodeSnapshots(rig.photoData.get(photoId)?.get(DATA_KEY) ?? null);

async function mount(rig: Rig): Promise<Rig> {
  activate(rig.api);
  render(<SnapshotsPanel />);
  await act(async () => {});
  return rig;
}

const rows = () => [...document.querySelectorAll<HTMLButtonElement>(`.${ROW_CLASS}`)];
const names = () => rows().map((r) => r.firstChild?.textContent);
const row = (name: string) => rows().find((r) => r.firstChild?.textContent === name)!;
const action = (label: string) => screen.getByRole("button", { name: label });
const takeButton = () => screen.getByRole("button", { name: "+ Snapshot" });

const WARM = takeSnapshot({ params: { exposure: 1, contrast: 0 }, paramBag: { "glow.amount": 0.4 } }, "Warm", "warm", 1);
const COOL = takeSnapshot({ params: { exposure: 0, contrast: 20 } }, "Cool", "cool", 2);

describe("opening a photo", () => {
  it("lists its stored snapshots, oldest first", async () => {
    const rig = fakeApi();
    store(rig, "photo-1", [WARM, COOL]);
    await mount(rig);
    expect(names()).toEqual(["Warm", "Cool"]);
    expect(screen.getByRole("list", { name: "Snapshots" })).toBeTruthy();
  });

  it("says when there are none yet, or no photo is open", async () => {
    const rig = await mount(fakeApi());
    expect(document.querySelector(`.${NOTE_CLASS}`)?.textContent).toMatch(/^No snapshots yet/);
    act(() => rig.openPhoto(null));
    expect(document.querySelector(`.${NOTE_CLASS}`)?.textContent).toBe("No photo open");
  });

  it("shows each photo's own snapshots, and drops a read for a photo already left", async () => {
    const rig = fakeApi({ holdReads: true });
    store(rig, "photo-1", [WARM]);
    store(rig, "photo-2", [COOL]);
    await mount(rig);
    const first = rig.heldReads[0];
    act(() => rig.openPhoto("photo-2"));
    await act(async () => rig.heldReads[1].answer());
    await act(async () => first.answer());
    expect(names()).toEqual(["Cool"]);
  });

  it("never writes over snapshots it can't read", async () => {
    const rig = fakeApi();
    rig.photoData.set("photo-1", new Map([[DATA_KEY, new TextEncoder().encode('{"format":9}')]]));
    await mount(rig);
    expect(document.querySelector(`.${NOTE_CLASS}`)?.textContent).toMatch(/couldn't be read/);
    act(() => rig.keybindings[0].handler());
    expect(new TextDecoder().decode(rig.photoData.get("photo-1")?.get(DATA_KEY))).toBe('{"format":9}');
  });
});

describe("taking a snapshot", () => {
  it("keeps the edit shown under the next name and stores it with the photo", async () => {
    const rig = fakeApi({ params: { exposure: 0.5 }, paramBag: { "glow.amount": 0.2 } });
    store(rig, "photo-1", [WARM]);
    await mount(rig);
    fireEvent.click(takeButton());

    expect(names()).toEqual(["Warm", "Snapshot 1"]);
    const kept = stored(rig)!.at(-1)!;
    expect(kept).toMatchObject({ name: "Snapshot 1", params: { exposure: 0.5 }, paramBag: { "glow.amount": 0.2 } });
  });

  it("takes one from the Develop shortcut, Ctrl+N, and only in Develop", async () => {
    const rig = await mount(fakeApi());
    const shortcut = rig.keybindings.find((k) => k.id === "snapshots.take")!;
    expect(shortcut).toMatchObject({ label: "Take snapshot", category: "Develop", defaultCombo: "Ctrl+N" });

    act(() => rig.ui.setState({ activeModule: "library" }));
    act(() => shortcut.handler());
    expect(names()).toEqual([]);
    act(() => rig.ui.setState({ activeModule: "develop" }));
    act(() => shortcut.handler());
    expect(names()).toEqual(["Snapshot 1"]);
  });
});

describe("putting a snapshot back", () => {
  it("restores its edit as one step named after it", async () => {
    const rig = fakeApi();
    store(rig, "photo-1", [WARM, COOL]);
    await mount(rig);
    fireEvent.click(row("Warm"));

    expect(rig.restored).toEqual([{ edit: { params: WARM.params, paramBag: WARM.paramBag }, label: "Snapshot “Warm”" }]);
  });

  it("marks the snapshot that is the edit shown, and counts what the others would change", async () => {
    const rig = fakeApi({ params: { exposure: 1, contrast: 0 }, paramBag: { "glow.amount": 0.4 }, descriptors: { "glow.amount": GLOW } });
    store(rig, "photo-1", [WARM, COOL]);
    await mount(rig);

    expect(row("Warm").getAttribute("aria-current")).toBe("true");
    expect(row("Cool").getAttribute("aria-current")).toBeNull();
    expect(row("Cool").querySelector(`.${DETAIL_CLASS}`)?.textContent).toBe("3 changes");
    expect(row("Cool").title.split("\n").slice(1)).toEqual([
      "Exposure: 1 → 0",
      "Contrast: 0 → 20",
      "Glow › Amount: 0.4 → 0",
    ]);
  });
});

describe("holding a snapshot", () => {
  it("draws it in place of the edit until let go, without putting it back", async () => {
    vi.useFakeTimers();
    const rig = fakeApi({ paramBag: { "glow.amount": 0.9 }, descriptors: { "glow.amount": GLOW } });
    store(rig, "photo-1", [COOL]);
    await mount(rig);

    fireEvent.pointerDown(row("Cool"), { button: 0 });
    act(() => vi.advanceTimersByTime(HOLD_MS));
    expect(rig.previews).toEqual([{ params: COOL.params, paramBag: { "glow.amount": 0 } }]);
    expect(row("Cool").dataset.previewing).toBe("");

    fireEvent.pointerUp(row("Cool"));
    fireEvent.click(row("Cool"));
    expect(rig.previews.at(-1)).toBeNull();
    expect(rig.restored).toEqual([]);
  });

  it("puts it back on a quick click instead", async () => {
    vi.useFakeTimers();
    const rig = fakeApi();
    store(rig, "photo-1", [COOL]);
    await mount(rig);

    fireEvent.pointerDown(row("Cool"), { button: 0 });
    act(() => vi.advanceTimersByTime(HOLD_MS - 50));
    fireEvent.pointerUp(row("Cool"));
    fireEvent.click(row("Cool"));
    act(() => vi.advanceTimersByTime(HOLD_MS));
    expect(rig.previews).toEqual([]);
    expect(rig.restored.map((r) => r.label)).toEqual(["Snapshot “Cool”"]);
  });
});

describe("renaming and deleting", () => {
  it("renames from its button, keeping the new name with the photo", async () => {
    const rig = fakeApi();
    store(rig, "photo-1", [WARM]);
    await mount(rig);
    fireEvent.click(action("Rename “Warm”"));
    const field = screen.getByRole("textbox", { name: "Snapshot name" });
    fireEvent.change(field, { target: { value: "  Golden hour " } });
    fireEvent.keyDown(field, { key: "Enter" });

    expect(names()).toEqual(["Golden hour"]);
    expect(stored(rig)!.map((s) => s.name)).toEqual(["Golden hour"]);
  });

  it("renames on a double-click or F2 too, and keeps the old name when left blank or on Escape", async () => {
    const rig = fakeApi();
    store(rig, "photo-1", [WARM]);
    await mount(rig);

    fireEvent.doubleClick(row("Warm"));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "   " } });
    fireEvent.blur(screen.getByRole("textbox"));
    expect(names()).toEqual(["Warm"]);

    fireEvent.keyDown(row("Warm"), { key: "F2" });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Nope" } });
    act(() => rig.escape()!());
    expect(names()).toEqual(["Warm"]);
    expect(rig.escape()).toBeNull();
  });

  it("deletes one, and stores nothing once the last is gone", async () => {
    const rig = fakeApi();
    store(rig, "photo-1", [WARM, COOL]);
    await mount(rig);
    fireEvent.click(action("Delete “Warm”"));
    expect(names()).toEqual(["Cool"]);
    expect(stored(rig)!.map((s) => s.name)).toEqual(["Cool"]);

    fireEvent.click(action("Delete “Cool”"));
    expect(rig.photoData.get("photo-1")?.has(DATA_KEY)).toBe(false);
  });
});

describe("comparing", () => {
  const reference = (rig: Rig) => rig.variables.get(COMPARE_REFERENCE) as CompareReference | null;
  const compare = (name: string) => screen.queryByRole("button", { name: `Compare with “${name}”` });

  it("offers no compare button until a compare tool is there", async () => {
    const rig = fakeApi();
    store(rig, "photo-1", [WARM]);
    await mount(rig);
    expect(compare("Warm")).toBeNull();
    act(() => rig.registerVariable(COMPARE_REFERENCE, null));
    expect(compare("Warm")).toBeTruthy();
  });

  it("hands the compare tool a snapshot as Before, and takes it back on a second press", async () => {
    const rig = fakeApi();
    rig.registerVariable(COMPARE_REFERENCE, null);
    store(rig, "photo-1", [WARM]);
    await mount(rig);

    fireEvent.click(compare("Warm")!);
    expect(reference(rig)).toEqual({
      photoId: "photo-1",
      source: "snapshots",
      id: "warm",
      label: "Warm",
      params: WARM.params,
      paramBag: WARM.paramBag,
    });
    expect(compare("Warm")!.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(compare("Warm")!);
    expect(reference(rig)).toBeNull();
    expect(compare("Warm")!.getAttribute("aria-pressed")).toBe("false");
  });

  it("follows a rename, and lets go on delete or when the photo is left", async () => {
    const rig = fakeApi();
    rig.registerVariable(COMPARE_REFERENCE, null);
    store(rig, "photo-1", [WARM, COOL]);
    await mount(rig);

    fireEvent.click(compare("Warm")!);
    fireEvent.click(action("Rename “Warm”"));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Sunset" } });
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    expect(reference(rig)?.label).toBe("Sunset");

    fireEvent.click(action("Delete “Sunset”"));
    expect(reference(rig)).toBeNull();

    fireEvent.click(compare("Cool")!);
    act(() => rig.openPhoto("photo-2"));
    expect(reference(rig)).toBeNull();
  });

  it("leaves a reference another extension set", async () => {
    const rig = fakeApi();
    const theirs = { photoId: "photo-1", source: "other", id: "x", label: "X", params: {}, paramBag: {} };
    rig.registerVariable(COMPARE_REFERENCE, theirs);
    await mount(rig);
    act(() => rig.openPhoto("photo-2"));
    expect(reference(rig)).toEqual(theirs);
  });

  it("leaves a reference set over its own when the photo is left", async () => {
    const rig = fakeApi();
    rig.registerVariable(COMPARE_REFERENCE, null);
    store(rig, "photo-1", [WARM]);
    await mount(rig);
    fireEvent.click(compare("Warm")!);
    const theirs = { photoId: "photo-1", source: "other", id: "x", label: "X", params: {}, paramBag: {} };
    act(() => void rig.api.variables.update(COMPARE_REFERENCE, () => theirs));
    act(() => rig.openPhoto("photo-2"));
    expect(reference(rig)).toEqual(theirs);
  });
});

describe("stopping", () => {
  it("lets go of a preview and of its reference", async () => {
    vi.useFakeTimers();
    const rig = fakeApi();
    rig.registerVariable(COMPARE_REFERENCE, null);
    store(rig, "photo-1", [WARM]);
    await mount(rig);
    fireEvent.click(screen.getByRole("button", { name: "Compare with “Warm”" }));
    fireEvent.pointerDown(row("Warm"), { button: 0 });
    act(() => vi.advanceTimersByTime(HOLD_MS));
    cleanup();
    deactivate();

    expect(rig.previews.at(-1)).toBeNull();
    expect(rig.variables.get(COMPARE_REFERENCE)).toBeNull();
  });
});

it("offers every row's actions as named buttons", async () => {
  const rig = fakeApi();
  store(rig, "photo-1", [WARM]);
  await mount(rig);
  expect([...document.querySelectorAll(`.${ACTION_CLASS}`)].map((b) => b.getAttribute("aria-label"))).toEqual([
    "Rename “Warm”",
    "Delete “Warm”",
  ]);
});
