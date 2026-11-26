// Safelight — founded and principally authored by Anthony Reimche.
// Copyright (C) 2026 Anthony Reimche. Licensed under the GNU GPL v3 with an
// attribution-preservation term (GPL v3 §7b) — see LICENSE. This notice must
// be preserved in derived versions.

// Registers the Develop "Snapshots" panel: named edits of the open photo to put
// back, preview and compare, and a shortcut that takes one.

import { SnapshotsPanel, snapshotsCss } from "./SnapshotsPanel";
import { initRuntime } from "./rt";
import type { SafelightAPI } from "./safelight";
import { startSnapshots, take } from "./store";

export const EXTENSION_ID = "snapshots";
export const PANEL_ID = `${EXTENSION_ID}.panel`;
export const STYLESHEET_ID = `${EXTENSION_ID}.styles`;
export const TAKE_ACTION = `${EXTENSION_ID}.take`;

let stop: (() => void) | null = null;

export function activate(host: SafelightAPI): void {
  initRuntime(host);
  stop = startSnapshots();
  host.registerStylesheet({ id: STYLESHEET_ID, css: snapshotsCss(host.ui.tokens) });
  host.registerPanel({
    id: PANEL_ID,
    title: "Snapshots",
    component: SnapshotsPanel,
    defaultDock: { module: "develop", direction: "left", order: 4, width: 240, height: 200 },
    modules: ["develop"],
  });
  host.registerKeybinding({
    id: TAKE_ACTION,
    label: "Take snapshot",
    category: "Develop",
    defaultCombo: "Ctrl+N",
    handler: () => {
      if (host.navigation.current() === "develop") take();
    },
  });
}

export function deactivate(): void {
  stop?.();
  stop = null;
}
