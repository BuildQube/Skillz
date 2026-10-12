# skillz

BuildQube's Claude Code plugin marketplace — a catalog of plugins (skills, slash commands, agents, hooks, and MCP integrations) that anyone can add to their own Claude Code setup and enable à la carte.

## Using the marketplace

Add the marketplace once:

```
/plugin marketplace add BuildQube/Skillz
```

Then browse and install interactively with `/plugin`, or install directly:

```
/plugin install hello-skillz@skillz
```

Pull updates later with `/plugin marketplace update skillz`.

For local development, point at a checkout instead: `/plugin marketplace add /path/to/skillz`.

## Plugins

| Plugin | Category | Description |
|--------|----------|-------------|
| [`hello-skillz`](plugins/hello-skillz) | examples | Minimal skill + command that prove the install path works |

## Adding a plugin

In Claude Code, from this repo:

```
/new-plugin my-plugin "What it does"
```

Or by hand:

```bash
scripts/new-plugin.sh my-plugin "What it does" development
# edit plugins/my-plugin/...
scripts/validate.sh
```

See [CLAUDE.md](CLAUDE.md) for layout and conventions.

## Repository structure

```
.
├── .claude-plugin/marketplace.json   # plugin registry
├── plugins/                          # one directory per plugin
│   └── hello-skillz/
├── templates/plugin/                 # scaffold copied by new-plugin.sh
├── scripts/                          # new-plugin.sh, validate.sh
├── .claude/commands/new-plugin.md    # /new-plugin for contributors
└── .github/workflows/validate.yml    # CI validation
```
