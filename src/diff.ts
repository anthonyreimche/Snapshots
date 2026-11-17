// Safelight — founded and principally authored by Anthony Reimche.
// Copyright (C) 2026 Anthony Reimche. Licensed under the GNU GPL v3 with an
// attribution-preservation term (GPL v3 §7b) — see LICENSE. This notice must
// be preserved in derived versions.

// What putting a snapshot back would change: every setting, extension value and
// mask that differs between the edit shown and the snapshot.

import type { Edit, MaskLike } from "./safelight";

/** A core setting ("param") or an extension value ("bag", by qualified key). */
export interface SettingChange {
  kind: "param" | "bag";
  key: string;
  before: unknown;
  after: unknown;
}

export interface MaskChange {
  kind: "mask";
  id: string;
  name: string;
  change: "added" | "removed" | "edited";
}

export type Change = SettingChange | MaskChange;

/** Every setting, extension value and mask that differs from `prev` to `next`:
 *  in `next`'s order, then what only `prev` held. */
export function diffEdits(prev: Edit, next: Edit): Change[] {
  const { masks: prevMasks = [], ...prevParams } = prev.params;
  const { masks: nextMasks = [], ...nextParams } = next.params;
  return [
    ...diffValues("param", prevParams, nextParams),
    ...diffMasks(prevMasks, nextMasks),
    ...diffValues("bag", prev.paramBag ?? {}, next.paramBag ?? {}),
  ];
}

function diffValues(
  kind: "param" | "bag",
  prev: Readonly<Record<string, unknown>>,
  next: Readonly<Record<string, unknown>>,
): Change[] {
  const keys = new Set([...Object.keys(next), ...Object.keys(prev)]);
  return [...keys]
    .filter((key) => !sameValue(prev[key], next[key]))
    .map((key) => ({ kind, key, before: prev[key], after: next[key] }));
}

function diffMasks(prev: readonly MaskLike[], next: readonly MaskLike[]): Change[] {
  const before = new Map(prev.map((m) => [m.id, m]));
  const after = new Set(next.map((m) => m.id));
  const changes: Change[] = [];
  for (const mask of next) {
    const was = before.get(mask.id);
    if (!was) changes.push({ kind: "mask", id: mask.id, name: mask.name, change: "added" });
    else if (!sameValue(was, mask)) changes.push({ kind: "mask", id: mask.id, name: mask.name, change: "edited" });
  }
  for (const mask of prev) {
    if (!after.has(mask.id)) changes.push({ kind: "mask", id: mask.id, name: mask.name, change: "removed" });
  }
  return changes;
}

/** Equal as stored values: numbers by value (0 and -0 alike, NaN as itself),
 *  arrays item by item, objects key by key. An object key holding undefined
 *  counts as absent, as it is once stored. */
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b || (Number.isNaN(a) && Number.isNaN(b))) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const entries = Object.entries(a).filter(([, value]) => value !== undefined);
  const other = new Map(Object.entries(b).filter(([, value]) => value !== undefined));
  return entries.length === other.size && entries.every(([key, value]) => other.has(key) && sameValue(value, other.get(key)));
}
