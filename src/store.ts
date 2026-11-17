// Safelight — founded and principally authored by Anthony Reimche.
// Copyright (C) 2026 Anthony Reimche. Licensed under the GNU GPL v3 with an
// attribution-preservation term (GPL v3 §7b) — see LICENSE. This notice must
// be preserved in derived versions.

// The open photo's snapshots: read when the photo opens, written back with each
// change, and put back through core's restoreEdit, one undoable step each.

import { COMPARE_REFERENCE, SOURCE, comparedSnapshot, type CompareReference } from "./compare";
import { api } from "./rt";
import type { StoreApi } from "./safelight";
import {
  DATA_KEY,
  decodeSnapshots,
  encodeSnapshots,
  nextName,
  previewBag,
  takeSnapshot,
  type Snapshot,
} from "./snapshots";

export interface SnapshotsState {
  /** The photo the list belongs to, or null with none open. */
  photoId: string | null;
  snapshots: readonly Snapshot[];
  /** "loading" until the photo's snapshots are read, "unreadable" when what is
   *  stored can't be read and must not be written over. */
  status: "idle" | "loading" | "ready" | "unreadable";
  /** Whether a compare tool has registered the compare reference. */
  canCompare: boolean;
  reference: CompareReference | null;
  /** The snapshot drawn in place of the edit while its row is held, or null. */
  previewing: string | null;
}

const INITIAL: SnapshotsState = {
  photoId: null,
  snapshots: [],
  status: "idle",
  canCompare: false,
  reference: null,
  previewing: null,
};

let store: StoreApi<SnapshotsState> | null = null;
/** The reference this window set, the only one it clears on leaving the photo. */
let setHere: { photoId: string; id: string } | null = null;

export function snapshotsStore(): StoreApi<SnapshotsState> {
  if (!store) throw new Error("[snapshots] store used before activate()");
  return store;
}

/** Follow the open photo and the compare reference. Returns the function that
 *  stops, which also lets go of a preview and of this extension's reference. */
export function startSnapshots(): () => void {
  store = api.stores.create<SnapshotsState>()(() => ({ ...INITIAL }));
  const develop = api.stores.useDevelopStore;
  open(develop.getState().photoId);
  const stopPhoto = develop.subscribe((s, prev) => {
    if (s.photoId !== prev.photoId) open(s.photoId);
  });
  const stopReference = api.variables.subscribe<CompareReference | null>(COMPARE_REFERENCE, (snapshot) => {
    snapshotsStore().setState({ canCompare: true, reference: snapshot.value });
  });
  return () => {
    stopPhoto();
    stopReference();
    preview(null);
    clearOwnReference();
  };
}

function open(photoId: string | null): void {
  clearOwnReference();
  const s = snapshotsStore();
  s.setState({ photoId, snapshots: [], status: photoId ? "loading" : "idle", previewing: null });
  if (!photoId) return;
  api.develop.getPhotoData(DATA_KEY).then(
    (bytes) => {
      if (s.getState().photoId !== photoId) return;
      const snapshots = decodeSnapshots(bytes);
      s.setState(snapshots ? { snapshots, status: "ready" } : { status: "unreadable" });
    },
    () => {
      if (s.getState().photoId === photoId) s.setState({ status: "unreadable" });
    },
  );
}

/** Store `snapshots` for the open photo, if they are the open photo's to change. */
function save(snapshots: readonly Snapshot[]): boolean {
  const s = snapshotsStore();
  const { photoId, status } = s.getState();
  if (status !== "ready" || !photoId || api.stores.useDevelopStore.getState().photoId !== photoId) return false;
  s.setState({ snapshots });
  api.develop.putPhotoData(DATA_KEY, snapshots.length > 0 ? encodeSnapshots(snapshots) : null);
  return true;
}

const find = (id: string) => snapshotsStore().getState().snapshots.find((s) => s.id === id);

/** Keep the edit shown as a new snapshot, named after the last. */
export function take(): void {
  const { params, paramBag, editError } = api.stores.useDevelopStore.getState();
  if (editError) return;
  const { snapshots } = snapshotsStore().getState();
  save([...snapshots, takeSnapshot({ params, paramBag }, nextName(snapshots), crypto.randomUUID(), Date.now())]);
}

/** Rename a snapshot; a blank name keeps the old one. */
export function rename(id: string, name: string): void {
  const trimmed = name.trim();
  const snapshot = find(id);
  if (!snapshot || !trimmed || trimmed === snapshot.name) return;
  const renamed = { ...snapshot, name: trimmed };
  if (!save(snapshotsStore().getState().snapshots.map((s) => (s.id === id ? renamed : s)))) return;
  updateOwnReference(id, (reference) => ({ ...reference, label: trimmed }));
}

export function remove(id: string): void {
  if (!save(snapshotsStore().getState().snapshots.filter((s) => s.id !== id))) return;
  if (snapshotsStore().getState().previewing === id) preview(null);
  updateOwnReference(id, () => null);
  if (setHere?.id === id) setHere = null;
}

/** Put a snapshot back as the photo's edit, one undoable step. */
export function restore(id: string): Promise<void> {
  const snapshot = find(id);
  if (!snapshot) return Promise.resolve();
  snapshotsStore().setState({ previewing: null });
  const { params, paramBag } = snapshot;
  return api.stores.useDevelopStore.getState().restoreEdit({ params, paramBag }, `Snapshot “${snapshot.name}”`);
}

/** Draw a snapshot in place of the edit, without changing it, or with null go
 *  back to the edit. */
export function preview(id: string | null): void {
  const s = snapshotsStore();
  const develop = api.stores.useDevelopStore.getState();
  const snapshot = id === null ? undefined : find(id);
  if (!snapshot) {
    if (s.getState().previewing === null) return;
    s.setState({ previewing: null });
    develop.setPreviewParams(null);
    return;
  }
  s.setState({ previewing: snapshot.id });
  develop.setPreviewParams(snapshot.params, previewBag(snapshot, develop.paramBag, (key) => api.params.get(key)));
}

/** Show a snapshot as the compare tool's Before, or stop when it already is. */
export function toggleCompare(id: string): void {
  const snapshot = find(id);
  const { photoId } = snapshotsStore().getState();
  if (!snapshot || !photoId) return;
  let shown = false;
  const result = api.variables.update<CompareReference | null>(COMPARE_REFERENCE, (current) => {
    shown = comparedSnapshot(current, photoId) !== id;
    if (!shown) return null;
    const { params, paramBag } = snapshot;
    return { photoId, source: SOURCE, id, label: snapshot.name, params, paramBag };
  });
  if (result.ok) setHere = shown ? { photoId, id } : null;
}

function updateOwnReference(id: string, change: (reference: CompareReference) => CompareReference | null): void {
  const { reference, photoId } = snapshotsStore().getState();
  if (comparedSnapshot(reference, photoId) !== id) return;
  api.variables.update<CompareReference | null>(COMPARE_REFERENCE, (current) =>
    current && comparedSnapshot(current, photoId) === id ? change(current) : current,
  );
}

function clearOwnReference(): void {
  const mine = setHere;
  if (!mine) return;
  setHere = null;
  api.variables.update<CompareReference | null>(COMPARE_REFERENCE, (current) =>
    comparedSnapshot(current, mine.photoId) === mine.id ? null : current,
  );
}

/** Develop is the module shown, in the main window or its own. */
export function inDevelop(): boolean {
  const detached = new URLSearchParams(window.location.search).get("detached");
  return api.stores.useUIStore.getState().activeModule === "develop" || detached === "develop";
}
