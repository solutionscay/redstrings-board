# redstrings-board

Agent Skill for composing Redstrings boards over MCP. Redstrings is a local corkboard for investigations. This repository holds the skill only.

The app: [redstrings.app](https://redstrings.app)
Try it: [demo.redstrings.app](https://demo.redstrings.app/)

## Install

Clone or symlink this repo into your agent's skills directory. Keep the folder name `redstrings-board` so it matches the `name` field in SKILL.md.

    git clone https://github.com/solutionscay/redstrings-board ~/.agents/skills/redstrings-board
    ln -s ~/.agents/skills/redstrings-board ~/.codex/skills/redstrings-board
    ln -s ~/.agents/skills/redstrings-board ~/.cursor/skills/redstrings-board

## MCP tools

Redstrings exposes these tools to a connected agent. Reads default to the board open in the app.

| Tool | Purpose |
| --- | --- |
| `redstrings_get_active_context` | Project, board, revision, dirty flag, selection |
| `redstrings_list_boards` | List boards in the open project |
| `redstrings_get_board` | Full board: nodes, edges, viewport, settings |
| `redstrings_get_board_summary` | Counts, metadata, revision, checksum |
| `redstrings_get_sync_status` | Whether the board is active and current |
| `redstrings_search_nodes` | Find cards by name, title, notes, source, or tag |
| `redstrings_get_node_with_relationships` | One card plus every relationship that reaches it |
| `redstrings_create_board` | Create and open a blank board |
| `redstrings_edit_board` | Apply one atomic, undoable batch of edits |
| `redstrings_upload_asset_to_card` | Attach a local file to an existing card |
| `redstrings_export_board_image` | Return a PNG image of the active board |

Full request shapes and edit operations are in [SKILL.md](SKILL.md).

## Helpers

The scripts need Node.js and nothing else:

    node scripts/layout-board.mjs < board.json
    node scripts/audit-strings.mjs < board.json

Tests:

    node scripts/test-layout-board.mjs
    node scripts/test-audit-strings.mjs
    node scripts/test-compactness.mjs
    node scripts/test-label-hits.mjs

## License

MIT. Copyright Solutions Cay.
