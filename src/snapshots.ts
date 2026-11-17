// Safelight — founded and principally authored by Anthony Reimche.
// Copyright (C) 2026 Anthony Reimche. Licensed under the GNU GPL v3 with an
// attribution-preservation term (GPL v3 §7b) — see LICENSE. This notice must
// be preserved in derived versions.

// A snapshot is a whole edit kept under a name, to come back to. A photo's
// snapshots are stored with it in the project, as JSON in one blob.

import type { DescribeParam } from "./format";
import type { Edit, EditParams } from "./safelight";

export interface Snapshot {
  id: string;
  name: string;
  /** When it was taken, in ms since the epoch. */
  taken: number;
  params: EditParams;
  paramBag: Readonly<Record<string, unknown>>;
}

/** The photo-data key the snapshots are stored under. */
export const DATA_KEY = "snapshots";
const FORMAT = 1;
const NAME_PREFIX = "Snapshot ";

/** A snapshot of `edit` named `name`. The edit is copied as JSON, the way it is
 *  stored, so it never shares an object with the live edit. */
export function takeSnapshot(edit: Edit, name: string, id: string, taken: number): Snapshot {
  const { params, paramBag = {} } = JSON.parse(JSON.stringify(edit)) as Edit;
  return { id, name, taken, params, paramBag };
}

/** "Snapshot 1", or one past the highest "Snapshot n" already there. */
export function nextName(snapshots: readonly Snapshot[]): string {
  const taken = snapshots
    .map((s) => (s.name.startsWith(NAME_PREFIX) ? Number(s.name.slice(NAME_PREFIX.length)) : 0))
    .filter((n) => Number.isInteger(n) && n > 0);
  return `${NAME_PREFIX}${Math.max(0, ...taken) + 1}`;
}

export function encodeSnapshots(snapshots: readonly Snapshot[]): Uint8Array {
  return new TextEncoder().encode(JSON.stringify({ format: FORMAT, snapshots }));
}

/** A photo's stored snapshots: none for no data, null for data this version
 *  can't read (damaged, or written by a newer version), which must not be
 *  written over. Entries without the fields a snapshot needs are left out. */
export function decodeSnapshots(bytes: Uint8Array | null): Snapshot[] | null {
  if (!bytes || bytes.length === 0) return [];
  let stored: unknown;
  try {
    stored = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
  if (!isObject(stored) || stored.format !== FORMAT || !Array.isArray(stored.snapshots)) return null;
  return stored.snapshots.filter(isSnapshot);
}

/** The extension values a preview of `snapshot` draws. A preview's values are
 *  merged over the live ones, so each value only the live edit holds is put
 *  back at the default a stage reads when an edit holds none. */
export function previewBag(
  snapshot: Snapshot,
  live: Readonly<Record<string, unknown>>,
  describe: DescribeParam,
): Record<string, unknown> {
  const bag: Record<string, unknown> = { ...snapshot.paramBag };
  for (const key of Object.keys(live)) {
    if (key in bag) continue;
    const fallback = describe(key)?.default;
    if (fallback !== undefined) bag[key] = fallback;
  }
  return bag;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSnapshot(value: unknown): value is Snapshot {
  return (
    isObject(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    Number.isFinite(value.taken) &&
    isObject(value.params) &&
    isObject(value.paramBag)
  );
}
