// A snapshot as kept: named in turn, copied away from the live edit, stored as
// JSON that a damaged or newer file can't be mistaken for, and previewed with
// the extension values it doesn't hold at their defaults.

import { describe, expect, it } from "vitest";
import type { ParamDescriptor } from "../src/safelight";
import {
  decodeSnapshots,
  encodeSnapshots,
  nextName,
  previewBag,
  takeSnapshot,
  type Snapshot,
} from "../src/snapshots";

const named = (...names: string[]): Snapshot[] =>
  names.map((name, i) => ({ id: String(i), name, taken: 0, params: {}, paramBag: {} }));

describe("nextName", () => {
  it("starts at Snapshot 1", () => {
    expect(nextName([])).toBe("Snapshot 1");
  });

  it("goes one past the highest numbered name, whatever else is there", () => {
    expect(nextName(named("Snapshot 1", "Warm", "Snapshot 4"))).toBe("Snapshot 5");
    expect(nextName(named("Warm", "Snapshot 1.5", "Snapshot -2"))).toBe("Snapshot 1");
  });
});

describe("takeSnapshot", () => {
  it("copies the edit, so a later change to the live edit leaves it alone", () => {
    const curve = [[0, 0], [1, 1]];
    const edit = { params: { exposure: 1, curve }, paramBag: { "glow.amount": 0.3 } };
    const snapshot = takeSnapshot(edit, "Warm", "id-1", 42);
    curve.push([0.5, 0.6]);

    expect(snapshot).toEqual({
      id: "id-1",
      name: "Warm",
      taken: 42,
      params: { exposure: 1, curve: [[0, 0], [1, 1]] },
      paramBag: { "glow.amount": 0.3 },
    });
  });

  it("holds an empty bag when the edit holds none", () => {
    expect(takeSnapshot({ params: {} }, "A", "a", 0).paramBag).toEqual({});
  });
});

describe("stored snapshots", () => {
  it("read back as written", () => {
    const snapshots = [takeSnapshot({ params: { exposure: 1 }, paramBag: { "glow.amount": 1 } }, "A", "a", 5)];
    expect(decodeSnapshots(encodeSnapshots(snapshots))).toEqual(snapshots);
  });

  it("are none when nothing is stored", () => {
    expect(decodeSnapshots(null)).toEqual([]);
    expect(decodeSnapshots(new Uint8Array())).toEqual([]);
  });

  it("can't be read from damaged data or a newer format, so they are never written over", () => {
    const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
    expect(decodeSnapshots(new TextEncoder().encode("{not json"))).toBeNull();
    expect(decodeSnapshots(bytes({ format: 2, snapshots: [] }))).toBeNull();
    expect(decodeSnapshots(bytes([]))).toBeNull();
  });

  it("leave out an entry without the fields a snapshot needs", () => {
    const good = { id: "a", name: "A", taken: 1, params: {}, paramBag: {} };
    const stored = { format: 1, snapshots: [good, { id: "b", name: "B" }, null, { ...good, taken: "now" }] };
    expect(decodeSnapshots(new TextEncoder().encode(JSON.stringify(stored)))).toEqual([good]);
  });
});

describe("previewBag", () => {
  const descriptor = (qualifiedKey: string, value: ParamDescriptor["default"]): ParamDescriptor => ({
    qualifiedKey,
    localKey: qualifiedKey.split(".")[1],
    stageId: qualifiedKey.split(".")[0],
    stageName: "Stage",
    extensionName: "Extension",
    default: value,
  });
  const descriptors: Record<string, ParamDescriptor> = {
    "glow.amount": descriptor("glow.amount", 0),
    "grain.size": descriptor("grain.size", 1.5),
  };

  it("keeps the snapshot's values and puts what only the live edit holds at its default", () => {
    const [snapshot] = named("A");
    snapshot.paramBag = { "glow.amount": 0.4 };
    const live = { "glow.amount": 0.9, "grain.size": 3, "gone.value": 7 };

    expect(previewBag(snapshot, live, (key) => descriptors[key])).toEqual({
      "glow.amount": 0.4,
      "grain.size": 1.5,
    });
  });
});
