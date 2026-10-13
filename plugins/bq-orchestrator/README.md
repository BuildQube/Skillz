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
| `/bq-orchestrator:review [WS…\|all-open] [merge]` | Check PR status, then review each diff against its plan row in two passes: a correctness agent (`/code-review` by default) and `/ponytail:ponytail-review`. It ranks the findings, asks you which to send (by default), and sends those to the workspace instead of fixing them. It also warns about expected reviewers that never posted and about files shared with open PRs outside the plan. It merges PRs that pass every check, in dependency order, but only when your request says to merge. |
| `/bq-orchestrator:file [summary\|from <PR/finding/WS>]` | File follow-up tickets (deferred review findings, gaps found while scoping). It drafts each one with problem, evidence, fix and tests, applies your domain's `file:` defaults and rules, flags likely duplicates, creates them after you approve, and adds them to the plan's Backlog. |
| `/bq-orchestrator:archive [WS…]` | Archive the skein workspaces whose PRs merged. Never uses `--force`. |
| `/bq-orchestrator:handoff [worktree]` | Carry a finished round's open items into a successor plan, and link the two. In-flight rows carry over as tracked rows owned by the old plan, so they are never re-launched. |

Messaging uses Claude Code's local session messaging (`ListAgents`/`SendMessage`), so the workspace must have a live `claude` session on the same machine.

A SessionStart hook re-applies orchestrator mode in any session that opens in a worktree whose `execution-plan.md` has `orchestrator: bq-orchestrator` front matter and isn't superseded.

## The workspace prompt

Every launched workspace gets four layers (see [references/workspace-prompt.md](references/workspace-prompt.md)):

1. **Task:** generated from the plan row: issues, context, notes, dependencies, and neighboring workspaces.
2. **Quality bar:** ponytail mode, strict DRY, tests that fail when you revert the fix, and a `/simplify` plus `/ponytail:ponytail-review` pass before the PR.
3. **Landing the work:** commit as you go, open the PR, wait for checks to finish, then loop `/bq-code:address-pr-feedback` until green and every thread is resolved.
4. **Repo addendum:** the repo's commit, PR-title and PR-body conventions. The first file found is used, in this order: `workspace-prompt-addendum.md` in the orchestrator worktree (untracked, the default), then `.claude/workspace-prompt.md` committed in the repo, then `~/.claude/bq-orchestrator/<repo>.md`.

An addendum with a `## Quality bar` or `## Landing the work` section replaces that default layer instead of adding to it.

## Trackers

A plan's front matter sets a default tracker (`airtable`, `github`, `linear` or `none`) and an assignee. Each issue ID can override the default by its format (`#12`, `owner/repo#12`, `ENG-42`, a URL, or the plan's Airtable ID pattern), so one plan can mix trackers. Rows without a ticket keep their details in the plan and are launched by name. See [references/trackers.md](references/trackers.md) and [references/plan-format.md](references/plan-format.md).

## Domain config

Settings shared by every plan for one team go in `~/.claude/bq-orchestrator/<domain>.yml`, where `<domain>` is the `domain` that `skein projects --json` shows for the plan's skein project. `enable-orchestrator` seeds new plans from it. At runtime, plan front matter wins over the domain file, which wins over the plugin defaults. The full schema is in [references/config.md](references/config.md).

A sample `~/.claude/bq-orchestrator/Acme.yml`:

```yaml
tracker: airtable
assignee:
  airtable: usrXXXXXXXXXXXXXX
  github: "@me"
airtable:
  base: appXXXXXXXXXXXXXX
  table: tblXXXXXXXXXXXXXX
  assignee_field: Assignee
  issue_id_field: Issue ID
  issue_pattern: "^T([0-9]{3,5})$"     # capture group feeds issue_lookup
  issue_lookup: "{Ticket Number}={1}"  # T5174 → filterByFormula {Ticket Number}=5174
  issue_format: "T{Ticket Number}"     # the reverse: a filed record's id, e.g. T5174
  on_launch:
    Status: In Progress                # the sprint id goes in each plan's front matter
launch:
  submit: false                        # true sends prompts once claude is ready (skein >= 0.6.0)
review:
  correctness_agent: /code-review      # or an agent type such as some-plugin:some-reviewer
  findings: ask                        # ask | auto
  expected_reviewers: [claude]
file:                                  # how /bq-orchestrator:file creates tickets
  assign: false                        # assigned at launch instead
  defaults:
    Status: Backlog
  always:
    Epics: [recEPIC1]                  # list fields union with rule additions
  rules:
    - when: the ticket affects the mobile app
      add: { Epics: [recEPIC2] }
    - when: it is a security or data-loss bug
      add: { Priority: P0 }
  fields:
    title: Name
    description: Description
    type: { field: Type, values: [Bug, Task, Feature] }
    priority: { field: Priority, values: [P0, P1, P2, P3] }
    size: { field: Size, values: ["1", "2", "3", "5", "8"] }
```

GitHub and Linear samples for `file:` are in config.md.
