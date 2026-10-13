# execution-plan.md format

The orchestrator's single source of truth. It lives **untracked** at the orchestrator worktree root, next to any `workspace-prompt-addendum.md` and supporting notes (findings, handoff, screenshots). Untracked means `git merge origin/main` never touches it.

## Front matter

```yaml
---
orchestrator: bq-orchestrator          # marks this worktree as an orchestrator (the SessionStart hook keys off it)
title: Checkout redesign
started: 2026-10-12
status: active                          # active | superseded | done
predecessor: prior-worktree             # optional — orchestrator worktree this continues from
successor:                              # set by handoff
skein_project: 01234567-89ab-cdef-0123-456789abcdef
base_branch: main
deadline: 2026-10-20                    # optional
tracker: airtable                       # default for ids that don't self-identify: airtable | github | linear | none
assignee:                               # who to assign at START (see trackers.md)
  airtable: usrXXXXXXXXXXXXXX
  github: "@me"
  linear: me
airtable:                               # only when tracker or any row uses airtable
  base: appXXXXXXXXXXXXXX
  table: tblXXXXXXXXXXXXXX
  assignee_field: Assignee
  issue_id_field: Issue ID              # field holding the user-facing id (T####)
  issue_pattern: "^T[0-9]{3,5}$"
  on_launch:                            # set with the assignee at START; sprint ids live here, per plan
    Sprint: [recXXXXXXXXXXXXXX]
sprint: Sprint 12                       # optional free text
epics:                                  # optional free text list
  - Checkout v2
---
```

Most of these keys can come from the domain file `~/.claude/bq-orchestrator/<domain>.yml` instead. Front matter wins over the domain file, which wins over the plugin defaults. See [config.md](config.md) for the full schema, including `review:` and each tracker's `on_launch`. Unknown keys are fine. Keep anything the user adds.

## Body sections

Keep these headings so the skills can find them. Everything else is free-form.

```markdown
# <title> — execution plan

<2–5 lines: where this came from (link), what "done" means, deadline.>

## Context
<the rule / product decision / background a launched workspace must not violate>

## Workspaces

| WS | Issues | Pri | Depends on | Seam | State |
|---|---|---|---|---|---|
| **I** | T5326 `cartUrl` + selected step in URL | P1 | — | `CartModal`, `CheckoutScreen` | proposed |
| **J** | T5330 copy cart + T5333 offline restore | P2 | I | `CartList`, `OFFLINE_QUEUE` | 🚧 launched 2026-10-12 · ws `w_abc` · session `j-cart-copy-3f` |
| **K** | #412 quick-access menu | P2 | I | new menu container | 🔀 PR #380 · checks green · 2 threads open |
| **L** | — lookup drawers (no ticket; details below) | P2 | K | new server procedure | ✅ merged #381 (2026-10-14) · archived |

### L — lookup drawers
<implementation details for rows with no ticket, or extra notes a prompt must carry>

## Collisions / ordering
- I first: J, K, L consume `cartUrl`.
- M and N both edit the checkout action bar — run serially or name each other in prompts.

## Backlog

| Issue | Summary | Pri / size | From |
|---|---|---|---|
| [T5401](https://airtable.com/appXXX/tblXXX/recXXX) | retry drops the idempotency key | P1 · 3 | review of K (PR #380), deferred |

## Log
- 2026-10-12 — plan created.
```

### The Workspaces table

- **WS** — a short letter/label, **unique within this plan** (a successor continues its predecessor's sequence). Bold it. Skip a label that would read as a tracker id: if `<label><digits>` matches `airtable.issue_pattern`, don't use it (with `^T[0-9]+$`, skip `T`).
- **Issues** — zero or more ids, each self-identifying when possible (`T5326`, `#412`, `owner/repo#12`, `ENG-42`, or a URL), then a short summary. `—` for no ticket; put the details in a `### <WS> — …` subsection.
- **State** — lifecycle, updated by the skills:
  `proposed` → `🚧 launched <date> · ws <id>` → `🔀 PR #N · <checks> · <threads>` → `✅ merged #N (<date>)` → `… · archived`. Also `⏸ blocked: <why>` and `✖ dropped: <why>`.
  - `· session <name>` is appended by `message` after its first successful send, so later sends go straight to that session. Keep it through later State changes.
  - `in flight · owned by <old plan>` marks a row carried over by `handoff` (`<old plan>` is the predecessor's worktree name) that still belongs to the predecessor's workspace. `refresh` tracks it like any other row (it becomes `🔀 PR …`, then `✅ merged …`, keeping the `owned by` note); `launch` never launches it.

### Workspace-specific prompt notes

Anything under `### <WS> — …` is passed into that workspace's prompt verbatim by `launch`, along with every `Collisions / ordering` bullet that names the workspace.

### Backlog

Tickets filed but not launched. `/bq-orchestrator:file` adds one row per ticket: the id linked to its URL, a short summary, priority and size (when the tracker has one), and where it came from. When the section already has a table (migrated plans often use other columns, e.g. `Ticket | Size | Notes`), the row follows that table's columns: values go in the closest columns, and whatever doesn't fit goes in a notes-like column. The table above is used only when there's no table yet. The existing table is never rewritten. A ticket that belongs to a workspace goes on that row's Issues and `### <WS>` notes instead. To launch a backlog ticket, add it to a Workspaces row first.

## Migrating an existing plan

Plans written before this plugin have no front matter and may lack a `State` column. `enable-orchestrator` adds the front matter (asking only for what it can't infer from the body) and appends a `State` column inferred from inline markers like ✅/🚧 — without rewriting the rest of the document.
