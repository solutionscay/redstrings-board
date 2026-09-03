---
name: redstrings-board
description: Create or update Redstrings detective boards over MCP. Read the active board, reuse cards, add missing evidence, and pack related cards into tight clusters. Use for any Redstrings, detective board, card, relationship, or board layout request. Run the compact layout helper only for new boards or explicit arrange requests.
license: MIT
compatibility: Redstrings MCP; Node.js for scripts/*.mjs
metadata:
  author: solutionscay
  product: Redstrings
  version: "0.3.0"
---

# Redstrings board

Make the requested board change directly. For an ordinary update the deliverable is the updated board. Do not hand back a layout process or a quality report.

MCP cannot open a case file. If no project is open in Redstrings, stop and say so.

## Workflow

1. Read the board with `redstrings_get_active_context`, then `redstrings_get_board`.
2. Reuse existing cards and relationships. Update stale evidence and add only what is missing. Do not duplicate entities.
3. Pick the path:
   - Ordinary update: keep every unrelated position. Place each new card one hop from the cards it connects to. Do not relayout unless asked.
   - New full board, or an explicit arrange or redesign request: follow "Full composition" below.
4. Apply one `redstrings_edit_board` batch. Pass `expectedRevision` and `expectedChecksum`.
5. Read the board once more to confirm content and positions.

## MCP tools

- `redstrings_get_active_context`: project, board, revision, dirty flag, selection
- `redstrings_list_boards`
- `redstrings_create_board`: blank board in the open project, takes `name` only
- `redstrings_get_board` and `redstrings_get_board_summary`: default to the active board
- `redstrings_edit_board`: one atomic, undoable batch; pass `expectedRevision` and `expectedChecksum`
- `redstrings_upload_asset_to_card`: `{ nodeId, sourcePath }`
- `redstrings_search_nodes`
- `redstrings_get_node_with_relationships`
- `redstrings_get_sync_status`

`add_edge` source and target are objects: `{ "kind": "node", "id": "card-a" }`.

## Content rules

- Represent only facts that the user's request or the supplied sources support.
- Keep confidence, source, notes, direction, and labels when they already exist.
- When a new card would add no useful concept, put the evidence on the most relevant existing card or relationship instead.
- Write relationship labels that state the claim directly.

## Placement rules

Cards are rectangles. Use the real size when the board has one, else 220 x 140.

One hop is one gap: 40 to 60 px of whitespace between card edges, or as much as the relationship label needs to clear both cards. Rest length between two cards is max((wa+wb)/2, (ha+hb)/2) plus padding. Reject a connected pair whose centers sit more than 2.5 rest lengths apart. Aim for a cluster near 1100 x 700 at zoom 1. The helper only rejects freeform bounds over 1600 px on an axis, so the target is on you.

For an ordinary update:

- Keep the current layout unless the user asks to rearrange it.
- Put each new card next to the cards it connects to, and check that it overlaps nothing. A quick coordinate check is enough.
- Look at all eight sectors around the anchor before you pick one: left, right, above, below, and the diagonals. Prefer the least occupied sector that keeps related cards close.
- If the occupied board is taller than it is wide, grow left or right. If it is much wider than tall, grow above or below.
- Spread several cards that hang off one anchor around its sides. Do not grow the board downward by default.
- Move existing cards only when you must make room.

For freeform compositions (investigation, research, relationship):

- Pull connected cards together along their edges. Do not spread them on a large ring.
- Avoid a perfect grid. Offset neighboring non-anchor cards in alternating horizontal and vertical bands, 20 to 50 px horizontally and 30 to 70 px vertically.
- Derive the offsets from the board input and the seed so the result is deterministic. Do not add random jitter.
- Keep focal cards where they are. Group related cards first, then stagger, then repair collisions and label conflicts.
- Do not line up more than three unrelated cards within 12 px of the same x or y origin, unless the alignment means something.

Keep deliberate alignment for timelines, process stages, and strict hierarchies.

## Full composition

For a new board or an explicit arrangement:

1. Choose `investigation`, `research`, or `relationship` for an organic composition. Use `timeline`, `process`, or `hierarchy` only when that structure carries meaning.
2. Mark focal cards and semantic groups, include real card sizes, and pick a stable seed.
3. Run `node scripts/layout-board.mjs` with the schema input on stdin. It always prints JSON, even when `unresolved` is not empty.
4. Reject the output if any of these hold, then adjust groups or the seed and rerun:
   - node overlaps, strings through cards, label collisions, or `distanceOutliers`
   - a non-empty `compactnessRejects`
   - a freeform box over 1600 px on either axis
   - a freeform `maxSharedX` or `maxSharedY` above three
   - a freeform `aspectRatio` outside 0.65 to 1.85 on a board of four or more cards
5. Apply the positions without changing IDs or content.
6. Run `node scripts/audit-strings.mjs` on the live board dump (nodes, edges, `relationshipSag`). Reject `stringsThroughCards` and `stringCrossings`. Every relationship should be a local path: neighbors, empty gutters, no third card on the span. Split a multi-target relationship when a branch crosses another card or string.
7. Look at the board once.

Input and output details are in [references/layout-schema.md](references/layout-schema.md).

## Boundaries

- The user must already have the project open. MCP cannot open one.
- Do not relayout unless asked, and do not run the layout helpers for an incremental content update.
- Do not widen a content update into a full-board cleanup.
- Do not launch, restart, or switch Redstrings builds to recover a connection unless the user asks. If the active board is unavailable or the versions do not match, stop and report the blocker in a sentence.
