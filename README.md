# redstrings-board

Agent Skill for composing Redstrings boards over MCP. Redstrings is a local corkboard for investigations. This repository holds the skill only. The app lives elsewhere, and the Redstrings website links here.

## Install

Clone or symlink this repo into your agent's skills directory. Keep the folder name `redstrings-board` so it matches the `name` field in SKILL.md.

    git clone https://github.com/solutionscay/redstrings-board ~/.agents/skills/redstrings-board
    ln -s ~/.agents/skills/redstrings-board ~/.codex/skills/redstrings-board
    ln -s ~/.agents/skills/redstrings-board ~/.cursor/skills/redstrings-board

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
