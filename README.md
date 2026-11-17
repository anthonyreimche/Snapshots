# Snapshots for Safelight

A Develop **Snapshots** panel: keep the edit you're looking at under a name and
come back to it later, however much you change in between.

- **Take a snapshot:** press **+ Snapshot**, or **Ctrl+N** in Develop. It keeps
  the edit shown as "Snapshot 1", "Snapshot 2" and so on.
- **Put one back:** click it. The photo takes that edit again exactly as it was
  kept (every setting, mask and extension value, at the processing it was made
  with) as one step you can undo.
- **See one without putting it back:** press and hold it. The photo shows the
  snapshot until you let go.
- **Compare:** with **Image Comparison** 1.1.0 or later installed, press **⇆**
  beside a snapshot to see it in the before/after split beside the edit shown,
  or hold `\` to flip to it. Press **⇆** again to compare with the original.
- **Rename** with **✎**, a double-click or F2. **Delete** with **✕**.

The snapshot that matches the edit shown is marked, and the others say how many
settings putting them back would change. Hover one for when it was taken and
the full list, such as "Exposure: 1 → 0.5".

Snapshots are kept per photo in the project's `.safelight` folder, so a virtual
copy has its own. They aren't part of the edit itself: copying settings,
presets and exports leave them out.

Needs Safelight 3.2.6 or later.

## Development

```bash
npm install
npm run typecheck
npm run build    # dist/index.js, the file Safelight loads
npm test         # vitest; the bundle checks read dist/, so build first
npm run check    # all three, in that order
```

Safelight hands the extension its own React through `api.react`, so the
bundle never includes React. `src/safelight.d.ts` mirrors the part of the
app's extension API the extension uses.

## Licence

GPL-3.0-only with an attribution term (GPL v3 §7b), the same licence as Safelight; see LICENSE. Copyright (C) 2026 Anthony Reimche.
