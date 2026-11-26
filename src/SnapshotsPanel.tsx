// Safelight — founded and principally authored by Anthony Reimche.
// Copyright (C) 2026 Anthony Reimche. Licensed under the GNU GPL v3 with an
// attribution-preservation term (GPL v3 §7b) — see LICENSE. This notice must
// be preserved in derived versions.

// The Snapshots panel: the open photo's snapshots, oldest first. Click one to
// put it back, hold it to see it without putting it back, and compare it, rename
// it or delete it from the buttons beside it.

import { comparedSnapshot } from "./compare";
import { diffEdits } from "./diff";
import { changeCount, describeSnapshot } from "./format";
import { React, api } from "./rt";
import type { UiTokens } from "./safelight";
import type { Snapshot } from "./snapshots";
import { preview, remove, rename, restore, snapshotsStore, take, toggleCompare } from "./store";

export const LIST_CLASS = "snapshots-panel-list";
export const ITEM_CLASS = "snapshots-panel-item";
export const ROW_CLASS = "snapshots-panel-row";
export const LABEL_CLASS = "snapshots-panel-label";
export const DETAIL_CLASS = "snapshots-panel-detail";
export const ACTION_CLASS = "snapshots-panel-action";
export const NOTE_CLASS = "snapshots-panel-note";

/** How long a row is held before it previews instead of being put back. */
export const HOLD_MS = 250;

/** The panel's look as plain CSS (the app's Tailwind build never scans an
 *  extension). `:where()` keeps every rule at zero specificity, so a stylesheet
 *  that restyles buttons wins over it. The last rule repeats core's
 *  Accessibility ▸ Larger text rule for 11 px text. */
export function snapshotsCss(t: UiTokens): string {
  return `
:where(.snapshots-panel) { display: flex; flex-direction: column; gap: 0.25rem; padding: 0.25rem; }
:where(.${LIST_CLASS}) { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 1px; max-height: 20rem; overflow-y: auto; }
:where(.${ITEM_CLASS}) { display: flex; align-items: center; gap: 1px; border-radius: 0.25rem; }
:where(.${ITEM_CLASS}:hover), :where(.${ITEM_CLASS}:focus-within) { background-color: ${t.surface3}; }
:where(.${ROW_CLASS}) { display: flex; flex: 1; min-width: 0; align-items: baseline; gap: 0.5rem; border-radius: 0.25rem; padding: 0.25rem 0.5rem; background-color: transparent; font-size: 11px; text-align: left; color: ${t.textSecondary}; cursor: pointer; touch-action: none; }
:where(.${ITEM_CLASS}:hover .${ROW_CLASS}) { color: ${t.textPrimary}; }
:where(.${ROW_CLASS}[aria-current="true"]) { color: ${t.textPrimary}; box-shadow: inset 2px 0 0 ${t.accent}; }
:where(.${ROW_CLASS}[data-previewing]) { color: ${t.textPrimary}; background-color: ${t.surface3}; }
:where(.${LABEL_CLASS}) { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
:where(.${DETAIL_CLASS}) { flex: none; color: ${t.textMuted}; font-variant-numeric: tabular-nums; }
@media (hover: hover) { :where(.${ITEM_CLASS}:not(:hover):not(:focus-within) .${ACTION_CLASS}:not([aria-pressed="true"])) { opacity: 0; } }
:where(.${NOTE_CLASS}) { padding: 0.25rem 0.5rem; font-size: 11px; color: ${t.textMuted}; }
html.sl-larger-text .${ROW_CLASS}, html.sl-larger-text .${NOTE_CLASS} { font-size: 13px !important; line-height: 1.45 !important; }
`;
}

const takenFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

export function SnapshotsPanel() {
  const useSnapshots = snapshotsStore();
  const snapshots = useSnapshots((s) => s.snapshots);
  const status = useSnapshots((s) => s.status);
  const photoId = useSnapshots((s) => s.photoId);
  const canCompare = useSnapshots((s) => s.canCompare);
  const compared = useSnapshots((s) => comparedSnapshot(s.reference, s.photoId));
  const previewing = useSnapshots((s) => s.previewing);
  const useDevelopStore = api.stores.useDevelopStore;
  const params = useDevelopStore((s) => s.params);
  const paramBag = useDevelopStore((s) => s.paramBag);
  const editError = useDevelopStore((s) => s.editError);
  const [renaming, setRenaming] = React.useState<string | null>(null);

  if (editError) return <div className={NOTE_CLASS}>This photo's edit couldn't be read.</div>;
  if (!photoId) return <div className={NOTE_CLASS}>No photo open</div>;
  if (status === "unreadable") {
    return (
      <div className={NOTE_CLASS}>
        This photo's snapshots couldn't be read. Snapshots kept by a newer version of Snapshots need that version.
      </div>
    );
  }

  const shown = { params, paramBag };
  const describe = (key: string) => api.params.get(key);
  const { Button } = api.ui;
  return (
    <div className="snapshots-panel">
      <Button size="sm" variant="secondary" full disabled={status !== "ready"} onClick={take} title="Keep the edit shown as a snapshot">
        + Snapshot
      </Button>
      {status === "ready" && snapshots.length === 0 && (
        <div className={NOTE_CLASS}>No snapshots yet. Take one to come back to this edit later.</div>
      )}
      {snapshots.length > 0 && (
        <ol className={LIST_CLASS} aria-label="Snapshots">
          {snapshots.map((snapshot) => {
            const changes = diffEdits(shown, snapshot);
            return (
              <li key={snapshot.id} className={ITEM_CLASS}>
                {renaming === snapshot.id ? (
                  <RenameField snapshot={snapshot} onDone={() => setRenaming(null)} />
                ) : (
                  <SnapshotRow
                    snapshot={snapshot}
                    current={changes.length === 0}
                    previewing={previewing === snapshot.id}
                    detail={changeCount(changes)}
                    title={describeSnapshot(takenFormat.format(snapshot.taken), changes, describe)}
                    onRename={() => setRenaming(snapshot.id)}
                  />
                )}
                {canCompare && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className={ACTION_CLASS}
                    active={compared === snapshot.id}
                    aria-pressed={compared === snapshot.id}
                    aria-label={`Compare with “${snapshot.name}”`}
                    title="Compare the edit shown with this snapshot"
                    onClick={() => toggleCompare(snapshot.id)}
                  >
                    ⇆
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className={ACTION_CLASS}
                  aria-label={`Rename “${snapshot.name}”`}
                  title="Rename"
                  onClick={() => setRenaming(snapshot.id)}
                >
                  ✎
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={ACTION_CLASS}
                  aria-label={`Delete “${snapshot.name}”`}
                  title="Delete"
                  onClick={() => remove(snapshot.id)}
                >
                  ✕
                </Button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

interface SnapshotRowProps {
  snapshot: Snapshot;
  /** The snapshot is the edit shown. */
  current: boolean;
  previewing: boolean;
  detail: string;
  title: string;
  onRename(): void;
}

/** A click puts the snapshot back; held past HOLD_MS, the press previews it
 *  instead until it is let go. */
function SnapshotRow({ snapshot, current, previewing, detail, title, onRename }: SnapshotRowProps) {
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = React.useRef(false);

  const letGo = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    if (held.current) preview(null);
  };
  React.useEffect(() => letGo, []);

  return (
    <button
      className={ROW_CLASS}
      aria-current={current ? "true" : undefined}
      data-previewing={previewing ? "" : undefined}
      title={title}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        held.current = false;
        timer.current = setTimeout(() => {
          timer.current = null;
          held.current = true;
          preview(snapshot.id);
        }, HOLD_MS);
      }}
      onPointerUp={letGo}
      onPointerCancel={letGo}
      onPointerLeave={letGo}
      onClick={() => {
        if (held.current) {
          held.current = false;
          return;
        }
        void restore(snapshot.id);
      }}
      onDoubleClick={onRename}
      onKeyDown={(e) => {
        if (e.key === "F2") {
          e.preventDefault();
          onRename();
        }
      }}
    >
      <span className={LABEL_CLASS}>{snapshot.name}</span>
      <span className={DETAIL_CLASS}>{detail}</span>
    </button>
  );
}

function RenameField({ snapshot, onDone }: { snapshot: Snapshot; onDone(): void }) {
  const [name, setName] = React.useState(snapshot.name);
  const done = React.useRef(false);
  const finish = (keep: boolean) => {
    if (done.current) return;
    done.current = true;
    if (keep) rename(snapshot.id, name);
    onDone();
  };
  React.useEffect(() => api.ui.onEscape(() => finish(false)), []);

  const { TextInput } = api.ui;
  return (
    <TextInput
      value={name}
      onChange={setName}
      autoFocus
      aria-label="Snapshot name"
      style={{ flex: 1, minWidth: 0 }}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter") finish(true);
      }}
    />
  );
}
