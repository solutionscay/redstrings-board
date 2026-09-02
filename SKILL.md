---
name: redstrings-board
description: Create or update Redstrings detective boards over MCP. Read the active board, reuse cards, add missing evidence, and pack related cards into tight clusters. Use for Redstrings, detective board, cards, MCP, tight clusters, and layout; run compact packing for new boards or explicit arrange requests, not Visio grids.
license: MIT
compatibility: Redstrings MCP; Node.js for scripts/*.mjs
metadata:
  author: solutionscay
  product: Redstrings
  version: "0.1.0"
---

# Redstrings board

Make the requested board change directly. For ordinary updates, the deliverable is the updated board—not a layout process or quality report.

MCP cannot open a case file. If no project is open, stop.

## Tight-cluster math

Related cards are neighbors first, then a group. One hop equals one gap: 40-60px of whitespace plus the actual card sizes (size.width/size.height, else 220x140).

- Rest length = max((wa+wb)/2, (ha+hb)/2) + padding.
- Place related cards in 8-dir slots around an anchor using those sizes.
- Attract along edges to close extra hops. Do not restore a large ring radius.
- Reject neighbor center distance greater than 2.5 x rest length.
- Cluster should fit about 1100x700 at zoom 1. Helper rejects freeform bounds over 1600px on either axis.
- Organic stagger 20-50px horizontal and 30-70px vertical, deterministic. Not Visio.

See [references/layout-schema.md](references/layout-schema.md).

## Workflow

1. Read with `redstrings_get_active_context` then `redstrings_get_board`. If nothing is open, stop.
2. Reuse existing cards and relationships. Update stale evidence; add only what is missing; do not duplicate entities.
3. Choose the path:
   - Ordinary update: keep unrelated positions; place only new cards one hop from what they connect to. Do not relayout unless asked.
   - New full-board or explicit arrange/redesign: run `scripts/layout-board.mjs` then `scripts/audit-strings.mjs`.
4. Apply one `redstrings_edit_board` batch with `expectedRevision` and `expectedChecksum`.
5. Re-read the board once to confirm content and positions.

## MCP tools

Live sidecar tools:

- `redstrings_get_active_context` — project, board, revision, dirty, selection
- `redstrings_list_boards`
- `redstrings_create_board` — blank board in the open project (`name` only)
- `redstrings_get_board` / `redstrings_get_board_summary` — default to the active board
- `redstrings_edit_board` — one atomic undoable batch; pass `expectedRevision` and `expectedChecksum`
- `redstrings_upload_asset_to_card` — `{ nodeId, sourcePath }`
- `redstrings_search_nodes`
- `redstrings_get_node_with_relationships`
- `redstrings_get_sync_status`

`add_edge` source/target are objects: `{ "kind": "node", "id": "card-a" }`.

## Content rules

- Represent only facts supported by the user's request or supplied sources.
- Preserve confidence, source, notes, direction, and labels when they already exist.
- Put new evidence in the most relevant existing card or relationship when a new card would add no useful concept.
- Use clear relationship labels that describe the claim directly.

## Placement rules

- Keep the current layout unless the user asks to rearrange it.
- Place each new card near the cards it connects to.
- Treat cards as rectangles using their actual size when available, or 220 × 140 otherwise.
- Leave roughly 40–60 pixels of whitespace and ensure the new card does not overlap existing cards.
- For freeform investigation, research, and relationship compositions, avoid a perfect grid. Offset neighboring non-anchor cards in alternating horizontal and vertical bands, using roughly 20–50 pixels horizontally and 30–70 pixels vertically.
- Make staggering deterministic from the board input and seed. Do not add unconstrained random jitter.
- Keep focal cards stable. Group related cards before staggering, then repair collisions and connection-label conflicts.
- Avoid placing more than three unrelated cards within roughly 12 pixels of the same x or y origin unless alignment communicates structure.
- Treat the canvas as two-dimensional. Before placing a card below existing content, inspect open sectors to the left, right, above, below, and on the diagonals.
- Prefer the least-occupied sector that keeps related cards close. If the occupied board is taller than it is wide, expand left or right; if it is much wider than tall, expand above or below.
- Distribute several cards connected to one anchor across multiple sides of it. Do not grow a freeform board downward as a default sequence.
- Preserve deliberate alignment for timelines, process stages, and strict hierarchies.
- Move existing cards only when necessary to make room for the new content.
- A quick visual or coordinate check for overlap is sufficient for ordinary updates.

## Full composition

For a new board or explicit arrangement:

1. Choose `investigation`, `research`, or `relationship` for an organic composition; use `timeline`, `process`, or `hierarchy` only when that structure carries meaning.
2. Mark focal cards and semantic groups, include actual card sizes, and choose a stable seed.
3. Run `node scripts/layout-board.mjs` with the schema input on stdin. It always prints JSON, even when quality is unresolved.
4. Reject output with node overlaps, strings through cards, label collisions, distanceOutliers, non-empty compactnessRejects, a freeform box over 1600px on either axis, a freeform `maxSharedX`/`maxSharedY` above three, or a freeform `aspectRatio` outside 0.65–1.85 for boards of four or more cards. Adjust groups or seed and rerun if needed.
5. After applying positions, run `node scripts/audit-strings.mjs` on the live board dump (nodes, edges, `relationshipSag`). Reject `stringsThroughCards` or `stringCrossings`. Route every relationship as a local path: neighbors, empty gutters, no third card on the span. Split a multi-target relationship when its branches cross other cards or strings. See [references/layout-schema.md](references/layout-schema.md).
6. Apply returned positions without changing IDs or content, then visually check the board once.

## Boundaries

- MCP cannot open a case file. The user must already have the project open.
- Do not relayout unless asked.
- Do not run full layout helpers for an ordinary incremental content update. New full-board generation and explicit arrangement are layout tasks and should use the helper.
- Do not broaden a content update into a full-board cleanup.
- Do not launch, restart, or switch Redstrings builds to recover a connection unless the user asks. If the active-board connection is unavailable or version-mismatched, stop and report the blocker concisely.
