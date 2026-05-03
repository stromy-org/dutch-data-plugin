# CLAUDE.md

Instructions for Claude Code when working in this plugin repo.

## Overview

dutch-data-plugin is a Claude Code plugin for Dutch Data. It is a **distribution artifact** — skills are authored in Cowork and cherry-picked here for client deployment.

## Repository Structure

```
dutch-data-plugin/
├── .claude-plugin/
│   └── plugin.json          # Plugin manifest
├── skills/                   # Deliverable skills (from Cowork)
├── companies/dutch-data/  # Brand data (charter, logos, colors)
├── package.json              # Node.js dependencies
├── pyproject.toml            # Python dependencies
├── hooks/hooks.json          # SessionStart dependency install
├── .mcp.json                 # MCP server config
├── CLAUDE.md                 # Plugin instructions
└── README.md
```

## Commands

```bash
# Test locally
claude --plugin-dir .

# Validate skill manifests
for d in skills/*/; do [ -f "$d/SKILL.md" ] && echo "OK: $d" || echo "MISSING: $d"; done
```

## Updating Skills

Skills are maintained in Cowork and cherry-picked into this plugin:

1. Update the skill in `Cowork/.claude/skills/<skill-name>/`
2. Copy updated files to `skills/<skill-name>/`
3. Re-apply portability transforms (`.claude/companies/` -> `companies/`, etc.)
4. Bump version in plugin.json

## Key Rules

- Never reference `.claude/companies/` or `.claude/skills/` — use `companies/` and `skills/` directly
- Company data lives at `companies/dutch-data/` (not `.claude/companies/`)
- Use `${CLAUDE_PLUGIN_ROOT}` to reference plugin paths in hooks and scripts
- Dependencies are auto-installed on session start via `hooks/hooks.json` into `${CLAUDE_PLUGIN_DATA}`
