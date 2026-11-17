// What activate() registers: the Snapshots panel in Develop's left rail, under
// History, the stylesheet that gives it the app's look, and the shortcut.

import { afterEach, describe, expect, it } from "vitest";
import { ROW_CLASS, SnapshotsPanel } from "../src/SnapshotsPanel";
import { PANEL_ID, STYLESHEET_ID, activate, deactivate } from "../src/index";
import { fakeApi } from "./support/fake-api";

afterEach(() => deactivate());

describe("activate", () => {
  it("registers the Snapshots panel in Develop, below History", () => {
    const rig = fakeApi();
    activate(rig.api);
    expect(rig.panels).toEqual([
      {
        id: "snapshots.panel",
        title: "Snapshots",
        component: SnapshotsPanel,
        defaultDock: { module: "develop", direction: "left", order: 4, width: 240, height: 200 },
      },
    ]);
    expect(PANEL_ID).toBe("snapshots.panel");
  });

  it("registers one stylesheet, coloured from the theme tokens", () => {
    const rig = fakeApi();
    activate(rig.api);
    expect(rig.stylesheets.map((s) => s.id)).toEqual([STYLESHEET_ID]);
    const css = rig.stylesheets[0].css;
    expect(css).toContain(`:where(.${ROW_CLASS}) {`);
    expect(css).toContain("var(--color-accent)");
  });

  it("keeps its rules at zero specificity, below any stylesheet that restyles buttons", () => {
    const rig = fakeApi();
    activate(rig.api);
    const rules = rig.stylesheets[0].css.split("\n").filter((line) => line.includes("snapshots-panel"));
    const plain = rules.filter((line) => !line.includes(":where(") && !line.startsWith("html.sl-larger-text"));
    expect(plain).toEqual([]);
  });
});
