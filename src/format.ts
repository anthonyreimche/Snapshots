// Safelight — founded and principally authored by Anthony Reimche.
// Copyright (C) 2026 Anthony Reimche. Licensed under the GNU GPL v3 with an
// attribution-preservation term (GPL v3 §7b) — see LICENSE. This notice must
// be preserved in derived versions.

// How a snapshot reads in the list: how many settings putting it back would
// change beside its name, and a line per change when it is hovered.

import type { Change, SettingChange } from "./diff";
import type { ParamDescriptor } from "./safelight";

export type DescribeParam = (qualifiedKey: string) => ParamDescriptor | undefined;

const MOST_LINES = 12;
const ACRONYMS = new Set(["hsl", "nr", "wb", "ev", "lut", "rgb", "ca"]);

/** "luminanceNRDetail" → "Luminance NR detail", in Canadian spelling. */
export function humanize(key: string): string {
  const words = key
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => (ACRONYMS.has(word.toLowerCase()) ? word.toUpperCase() : word.toLowerCase()))
    .map((word) => word.replace(/^colo(?=r)/, "colou"));
  const text = words.join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** A setting's name: a core setting from its key, an extension value as
 *  "Tool › Label" from what its extension registered. */
export function settingName(change: SettingChange, describe: DescribeParam): string {
  if (change.kind === "param") return humanize(change.key);
  const descriptor = describe(change.key);
  if (!descriptor) return humanize(change.key.slice(change.key.lastIndexOf(".") + 1));
  const label = descriptor.label ?? humanize(descriptor.localKey);
  return label.startsWith(descriptor.stageName) ? label : `${descriptor.stageName} › ${label}`;
}

/** A change's values as a stage reads them: an extension value the edit holds
 *  none of is at its registered default. */
function values(change: SettingChange, describe: DescribeParam): [before: unknown, after: unknown] {
  if (change.kind === "param") return [change.before, change.after];
  const fallback = describe(change.key)?.default;
  return [change.before ?? fallback, change.after ?? fallback];
}

/** A plain value as shown, or null for a curve, crop or other compound value. */
function shown(value: unknown): string | null {
  if (value === undefined || value === null) return "—";
  if (typeof value === "number") return String(Math.round(value * 100) / 100);
  if (typeof value === "boolean") return value ? "On" : "Off";
  if (typeof value === "string" && value.length <= 24) return value;
  return null;
}

export function describeChange(change: Change, describe: DescribeParam): string {
  if (change.kind === "mask") {
    const mask = change.name ? `Mask “${change.name}”` : "Mask";
    return `${mask} ${change.change}`;
  }
  const name = settingName(change, describe);
  const [before, after] = values(change, describe).map(shown);
  return before === null || after === null ? `${name} edited` : `${name}: ${before} → ${after}`;
}

/** Beside a snapshot's name: nothing when it is the edit shown, else how many
 *  settings putting it back would change. */
export function changeCount(changes: readonly Change[]): string {
  if (changes.length === 0) return "";
  return changes.length === 1 ? "1 change" : `${changes.length} changes`;
}

/** A snapshot's hover text: when it was taken, then a line per change putting
 *  it back would make, the rest counted past twelve. */
export function describeSnapshot(taken: string, changes: readonly Change[], describe: DescribeParam): string {
  if (changes.length === 0) return `Taken ${taken}\nThe edit shown`;
  const lines = changes.slice(0, MOST_LINES).map((change) => describeChange(change, describe));
  if (changes.length > MOST_LINES) lines.push(`and ${changes.length - MOST_LINES} more`);
  return [`Taken ${taken}`, ...lines].join("\n");
}
