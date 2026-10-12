# bq-orchestrator

Run a [skein](https://github.com/BuildQube/Skein) workspace as an **orchestrator**: it plans and launches work, and other skein workspaces implement it. The plan of record is an untracked `execution-plan.md` at the orchestrator worktree root.

## Install

```
/plugin marketplace add BuildQube/Skillz
/plugin install bq-orchestrator@skillz
```

Dependencies are installed with it: `bq-code` (this marketplace), `skein@skein-marketplace`, and `ponytail@ponytail`. Those marketplaces must already be added. `/simplify` ships with Claude Code. You also need the Skein desktop app running with its Companion CLI (`skein`) on PATH, an authenticated `gh`, and whichever tracker tools your plans use (the Airtable MCP, Linear MCP or CLI, or nothing for GitHub).

## Skills

| Skill | Use it to |
|---|---|
| `/bq-orchestrator:enable-orchestrator [source]` | Make this worktree an orchestrator. It scaffolds `execution-plan.md` (optionally from a Slack thread, findings doc, epic or issue list), or migrates a plan written before this plugin. It also finds the prompt addendum and switches the session into orchestrator mode. |
| `/bq-orchestrator:launch <WS…\|ids\|next>` | Assign the issue at start, build the layered workspace prompt, run `skein new`, and mark the row launched. |
| `/bq-orchestrator:refresh` | Merge `origin/<base>`, then report GitHub, tracker and skein state against the plan, and update the State column. |
| `/bq-orchestrator:message <WS…> <text>` | Send a finding or decision to the Claude session running in a launched workspace (it resolves the workspace to its local session). It can broadcast to every workspace on a seam, and when no session is live it falls back to text you can paste. Each send is logged in the plan. |
| `/bq-orchestrator:review [WS…\|all-open] [merge]` | Check PR status, review each diff against its plan row with `/ponytail:ponytail-review`, and send findings to the workspace instead of fixing them. It merges PRs that pass every check, in dependency order, but only when your request says to merge. |
| `/bq-orchestrator:archive [WS…]` | Archive the skein workspaces whose PRs merged. Never uses `--force`. |
| `/bq-orchestrator:handoff [worktree]` | Carry a finished round's open items into a successor plan, and link the two. |

Messaging uses Claude Code's local session messaging (`ListAgents`/`SendMessage`), so the workspace must have a live `claude` session on the same machine.

A SessionStart hook re-applies orchestrator mode in any session that opens in a worktree whose `execution-plan.md` has `orchestrator: bq-orchestrator` front matter and isn't superseded.

## The workspace prompt

Every launched workspace gets four layers (see [references/workspace-prompt.md](references/workspace-prompt.md)):

1. **Task:** generated from the plan row: issues, context, notes, dependencies, and neighboring workspaces.
2. **Quality bar:** ponytail mode, strict DRY, tests that fail when you revert the fix, and a `/simplify` plus `/ponytail:ponytail-review` pass before the PR.
3. **Landing the work:** commit as you go, open the PR, wait for checks to finish, then loop `/bq-code:address-pr-feedback` until green and every thread is resolved.
4. **Repo addendum:** the repo's commit, PR-title and PR-body conventions. The first file found is used, in this order: `workspace-prompt-addendum.md` in the orchestrator worktree (untracked, the default), then `.claude/workspace-prompt.md` committed in the repo, then `~/.claude/bq-orchestrator/<repo>.md`.

## Trackers

A plan's front matter sets a default tracker (`airtable`, `github`, `linear` or `none`) and an assignee. Each issue ID can override the default by its format (`#12`, `owner/repo#12`, `ENG-42`, a URL, or the plan's Airtable ID pattern), so one plan can mix trackers. Rows without a ticket keep their details in the plan and are launched by name. See [references/trackers.md](references/trackers.md) and [references/plan-format.md](references/plan-format.md).
