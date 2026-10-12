# skillz — BuildQube Claude Code plugin marketplace

This repo is a Claude Code **plugin marketplace**. End users add it once (`/plugin marketplace add BuildQube/Skillz`) and then pick which plugins to install into their own Claude setup.

## Layout

- `.claude-plugin/marketplace.json` — the registry. Every plugin must be listed here with `source: ./plugins/<name>`.
- `plugins/<name>/` — one directory per plugin:
  - `.claude-plugin/plugin.json` — manifest (`name`, `version`, `description`, `author`, optional `userConfig` for secrets)
  - `skills/<skill>/SKILL.md`, `commands/*.md`, `agents/*.md`, `hooks/hooks.json`, `.mcp.json` — include only what the plugin uses
- `templates/plugin/` — the starting point copied by `scripts/new-plugin.sh`.
- `scripts/validate.sh` — runs `claude plugin validate` on the marketplace and each plugin, and checks name/version sync between `marketplace.json` and each `plugin.json`. CI runs it plus `bun test scripts/` on every PR.
- `scripts/bump-plugins.ts`, `scripts/apply-bump.ts` — auto-versioning used by the version-bump workflows.

## Conventions

- Plugin names are kebab-case and match their directory name.
- **Don't bump versions by hand.** On PR merge, `.github/workflows/version-bump.yml` bumps every plugin whose files changed (patch by default; a `<plugin>:minor` or `<plugin>:major` PR label overrides), commits the bump to `main`, and creates a `<plugin>@<version>` tag and GitHub release. `version-preview.yml` comments the planned bumps on each PR. Logic lives in `scripts/bump-plugins.ts` / `scripts/apply-bump.ts` (Bun, tests via `bun test scripts/`).
- New plugins start at `0.1.0`; `scripts/new-plugin.sh` also creates their bump labels (`scripts/plugin-labels.sh <name>` to do it separately).
- Skill `description` frontmatter says *when* to use the skill (trigger phrases), since that is what Claude matches on.
- Secrets go through `userConfig` with `"sensitive": true` and are referenced as `${user_config.<key>}` in `.mcp.json` — never commit tokens.
- Use `${CLAUDE_PLUGIN_ROOT}` to reference scripts bundled inside a plugin, and `${CLAUDE_SKILL_DIR}` inside a SKILL.md (e.g. `${CLAUDE_SKILL_DIR}/../../references/x.md` for plugin-level references).
- Plugin `dependencies` in `plugin.json`: same-marketplace plugins by bare name (`"bq-code"`); other marketplaces as `name@marketplace`, and that marketplace must be listed in `allowCrossMarketplaceDependenciesOn` in `marketplace.json`. Don't use version constraints — they resolve against `<plugin>--v<version>` tags, and our release tags are `<plugin>@<version>`.
- Add new plugins with `/new-plugin` (or `scripts/new-plugin.sh`), then run `scripts/validate.sh`.
