// Safelight — founded and principally authored by Anthony Reimche.
// Copyright (C) 2026 Anthony Reimche. Licensed under the GNU GPL v3 with an
// attribution-preservation term (GPL v3 §7b) — see LICENSE. This notice must
// be preserved in derived versions.

// The edit a compare tool shows as Before, shared as a variable so neither
// extension needs the other. A compare tool (Image Comparison 1.1.0 and later)
// registers it, which is how Snapshots knows one is there; anything may then
// set a reference for the open photo, and the compare tool shows it in place of
// the photo as opened.

import type { EditParams } from "./safelight";

export const COMPARE_REFERENCE = "compare.reference";

export interface CompareReference {
  /** The photo it belongs to; a compare tool ignores it on any other. */
  photoId: string;
  /** The extension that set it, so it clears or renames only its own. */
  source: string;
  /** Which of the source's edits it is. */
  id: string;
  /** Shown on the Before side. */
  label: string;
  params: EditParams;
  paramBag: Readonly<Record<string, unknown>>;
}

export const SOURCE = "snapshots";

/** The id of this extension's snapshot that `reference` shows for `photoId`, or null. */
export function comparedSnapshot(reference: CompareReference | null, photoId: string | null): string | null {
  return reference && reference.source === SOURCE && reference.photoId === photoId ? reference.id : null;
}
