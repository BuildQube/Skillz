# execution-plan.md format

The orchestrator's single source of truth. It lives **untracked** at the orchestrator worktree root, next to any `workspace-prompt-addendum.md` and supporting notes (findings, handoff, screenshots). Untracked means `git merge origin/main` never touches it.

## Front matter

```yaml
---
orchestrator: bq-orchestrator          # marks this worktree as an orchestrator (the SessionStart hook keys off it)
title: WO-screen parity
started: 2026-10-12
status: active                          # active | superseded | done
predecessor: affable-pickle             # optional — orchestrator worktree this continues from
successor:                              # set by handoff
skein_project: 019e8900-0181-7c10-b7e5-1f6f1d69258e
base_branch: main
deadline: 2026-10-20                    # optional
tracker: airtable                       # default for ids that don't self-identify: airtable | github | linear | none
assignee:                               # who to assign at START (see trackers.md)
  airtable: usr0wk10z5dUQkYHQ
  github: "@me"
  linear: me
airtable:                               # only when tracker or any row uses airtable
  base: appBNNrccYY9bXOTU
  table: tblpJStOrnv8SQRoG
  assignee_field: Assignee
  issue_id_field: Issue ID              # field holding the user-facing id (O####)
  issue_pattern: "^O[0-9]{3,5}$"
sprint: S26.33 Eggplant rec75YQ6CztUgsnVI   # optional free text
epics:                                   # optional free text list
  - Aldoa Monorepo Migration rec7b9miuAurnOEIq
---
```

Unknown keys are fine — keep anything the user adds.

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
| **I** | O5326 `formHref` + selected form in URL | P1 | — | `AddNewFormModal`, `WorkOrderScreen` | proposed |
| **J** | O5330 copy form + O5333 skip/restore offline | P2 | I | `RequiredFormsList`, `OFFLINE_MUTATIONS` | 🚧 launched 2026-10-12 · ws `w_abc` |
| **K** | #412 quick-access menu | P2 | I | new menu container | 🔀 PR #380 · checks green · 2 threads open |
| **L** | — lookup drawers (no ticket; details below) | P2 | K | new server procedure | ✅ merged #381 (2026-10-14) · archived |

### L — lookup drawers
<implementation details for rows with no ticket, or extra notes a prompt must carry>

## Collisions / ordering
- I first: J, K, L consume `formHref`.
- M and N both edit the WO action bar — run serially or name each other in prompts.

## Backlog
<filed, not launched>

## Log
- 2026-10-12 — plan created.
```

### The Workspaces table

- **WS** — a short letter/label, **unique across all orchestrator plans for this repo** (check sibling worktrees' plans before picking; continue the predecessor's sequence). Bold it.
- **Issues** — zero or more ids, each self-identifying when possible (`O5326`, `#412`, `owner/repo#12`, `ENG-42`, or a URL), then a short summary. `—` for no ticket; put the details in a `### <WS> — …` subsection.
- **State** — lifecycle, updated by the skills:
  `proposed` → `🚧 launched <date> · ws <id>` → `🔀 PR #N · <checks> · <threads>` → `✅ merged #N (<date>)` → `… · archived`. Also `⏸ blocked: <why>` and `✖ dropped: <why>`.

### Workspace-specific prompt notes

Anything under `### <WS> — …` is passed into that workspace's prompt verbatim by `launch`, along with every `Collisions / ordering` bullet that names the workspace.

## Migrating an existing plan

Plans written before this plugin have no front matter and may lack a `State` column. `enable-orchestrator` adds the front matter (asking only for what it can't infer from the body) and appends a `State` column inferred from inline markers like ✅/🚧 — without rewriting the rest of the document.
