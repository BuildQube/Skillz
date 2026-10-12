# skillz — BuildQube Claude Code plugin marketplace

This repo is a Claude Code **plugin marketplace**. End users add it once (`/plugin marketplace add BuildQube/Skillz`) and then pick which plugins to install into their own Claude setup.

## Layout

- `.claude-plugin/marketplace.json` — the registry. Every plugin must be listed here with `source: ./plugins/<name>`.
- `plugins/<name>/` — one directory per plugin:
  - `.claude-plugin/plugin.json` — manifest (`name`, `version`, `description`, `author`, optional `userConfig` for secrets)
  - `skills/<skill>/SKILL.md`, `commands/*.md`, `agents/*.md`, `hooks/hooks.json`, `.mcp.json` — include only what the plugin uses
- `templates/plugin/` — the starting point copied by `scripts/new-plugin.sh`.
- `scripts/validate.sh` — runs `claude plugin validate` on the marketplace and each plugin, and checks name/version sync between `marketplace.json` and each `plugin.json`. CI runs it on every PR.

## Conventions

- Plugin names are kebab-case and match their directory name.
- Keep `version` identical in `plugin.json` and the `marketplace.json` entry; bump both when a plugin changes (semver).
- Skill `description` frontmatter says *when* to use the skill (trigger phrases), since that is what Claude matches on.
- Secrets go through `userConfig` with `"sensitive": true` and are referenced as `${user_config.<key>}` in `.mcp.json` — never commit tokens.
- Use `${CLAUDE_PLUGIN_ROOT}` to reference scripts bundled inside a plugin.
- Add new plugins with `/new-plugin` (or `scripts/new-plugin.sh`), then run `scripts/validate.sh`.
