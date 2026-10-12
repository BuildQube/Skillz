---
description: Scaffold a new plugin in this marketplace from the template
argument-hint: "<plugin-name> [description]"
---

Create a new plugin in this marketplace. Arguments: $ARGUMENTS

1. Determine the plugin name (kebab-case) and a one-line description. Ask for the description and a category (e.g. `development`, `operations`, `productivity`, `integration`) if not given.
2. Run `scripts/new-plugin.sh <name> "<description>" <category>`.
3. Ask what the plugin should do, then replace the template's example skill/command/agent with real ones — rename directories and frontmatter `name` fields to match, and delete component types the plugin doesn't need.
4. Fill in `tags` in `.claude-plugin/marketplace.json` and update the plugin's README table.
5. Run `scripts/validate.sh` and fix anything it reports.
6. Add the plugin to the table in the root `README.md`.

Do not commit.
