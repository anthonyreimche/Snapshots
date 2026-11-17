// What putting a snapshot back would change: every setting, extension value
// and mask that differs between the edit shown and the snapshot.

import { describe, expect, it } from "vitest";
import { diffEdits } from "../src/diff";
import type { Edit } from "../src/safelight";

const step = (params: Edit["params"], paramBag?: Edit["paramBag"]): Edit => ({ params, paramBag });

const mask = (id: string, name: string, opacity = 100) => ({ id, name, opacity });

describe("diffEdits", () => {
  it("finds nothing between equal edits, however their values are held", () => {
    const curve = { rgb: [{ x: 0, y: 0 }, { x: 1, y: 1 }] };
    const a = step({ exposure: 0.5, toneCurve: curve, masks: [mask("m1", "Sky")] }, { "fx.glow.amount": [1, 2] });
    const b = step(
      { exposure: 0.5, toneCurve: structuredClone(curve), masks: [mask("m1", "Sky")] },
      { "fx.glow.amount": [1, 2] },
    );
    expect(diffEdits(a, b)).toEqual([]);
  });

  it("lists each changed setting with its value before and after", () => {
    const a = step({ exposure: 0, contrast: 10, toneCurve: { rgb: [] } });
    const b = step({ exposure: 0.5, contrast: 10, toneCurve: { rgb: [{ x: 0, y: 1 }] } });
    expect(diffEdits(a, b)).toEqual([
      { kind: "param", key: "exposure", before: 0, after: 0.5 },
      { kind: "param", key: "toneCurve", before: { rgb: [] }, after: { rgb: [{ x: 0, y: 1 }] } },
    ]);
  });

  it("counts 0 and -0 as the same value", () => {
    expect(diffEdits(step({ tint: 0 }), step({ tint: -0 }))).toEqual([]);
  });

  it("lists extension values set, changed and cleared", () => {
    const a = step({}, { "fx.glow.amount": 0.2, "fx.glow.radius": 4 });
    const b = step({}, { "fx.glow.amount": 0.6, "fx.grain.size": 2 });
    expect(diffEdits(a, b)).toEqual([
      { kind: "bag", key: "fx.glow.amount", before: 0.2, after: 0.6 },
      { kind: "bag", key: "fx.grain.size", before: undefined, after: 2 },
      { kind: "bag", key: "fx.glow.radius", before: 4, after: undefined },
    ]);
  });

  it("reads a step with no bag as an empty one", () => {
    expect(diffEdits(step({}), step({}, {}))).toEqual([]);
    expect(diffEdits(step({}), step({}, { "fx.glow.amount": 1 }))).toEqual([
      { kind: "bag", key: "fx.glow.amount", before: undefined, after: 1 },
    ]);
  });

  it("tells masks apart by id: added, edited and removed, never as one masks setting", () => {
    const a = step({ masks: [mask("m1", "Sky"), mask("m2", "Face")] });
    const b = step({ masks: [mask("m1", "Sky", 50), mask("m3", "Eyes")] });
    expect(diffEdits(a, b)).toEqual([
      { kind: "mask", id: "m1", name: "Sky", change: "edited" },
      { kind: "mask", id: "m3", name: "Eyes", change: "added" },
      { kind: "mask", id: "m2", name: "Face", change: "removed" },
    ]);
  });

  it("reads missing masks as none", () => {
    expect(diffEdits(step({}), step({ masks: [] }))).toEqual([]);
    expect(diffEdits(step({}), step({ masks: [mask("m1", "Sky")] }))).toEqual([
      { kind: "mask", id: "m1", name: "Sky", change: "added" },
    ]);
  });

  it("counts a value held as undefined as not held, as it is once stored", () => {
    expect(diffEdits(step({ exposure: 0, extra: undefined }), step({ exposure: 0 }))).toEqual([]);
    expect(diffEdits(step({ crop: { x: 0, y: undefined } }), step({ crop: { x: 0 } }))).toEqual([]);
  });
});
