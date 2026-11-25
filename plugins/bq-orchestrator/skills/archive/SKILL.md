---
name: archive
description: Use in an orchestrator workspace when the user wants to clean up finished workspaces — "archive the merged ones", "clean up skein", "archive A through G", "close out finished workspaces". Finds plan workspaces whose PRs merged, confirms, archives them in skein (never discarding uncommitted work), and marks them archived in execution-plan.md.
argument-hint: "[WS labels | all-merged]"
---

# Archive

Archive skein workspaces whose work has landed. Plan format: `${CLAUDE_SKILL_DIR}/../../references/plan-format.md`.

## 1. Find candidates

- `$ARGUMENTS` names WS labels → those rows. Empty or `all-merged` → every row whose PR is merged and isn't already archived.
- Map rows to live workspaces by workspace id from the State column, else by linked issue/branch: first in `skein list --parent <orchestrator id> --json` (skein ≥ 0.56.1, "Parent workspaces" in config.md), then in `skein list --project <skein_project> --json` for rows launched before parents.
- Verify each is really done: `gh pr view <N> --json state,mergedAt` is `MERGED`. A closed-unmerged PR or no PR → not a candidate; mention it.
- Never include the orchestrator's own workspace, or the one you're running in (skein refuses the latter anyway).

## 2. Confirm

Show the list — WS, workspace id/name, PR, merged date — and ask once for confirmation. Archiving is reversible (branches are kept; `skein new … --force` reopens), but it closes the user's terminals.

## 3. Archive

```bash
skein archive <id> [<id> ...] --json
```

**Never pass `--force`** — it discards uncommitted work. **Never pass `--with-children`**: candidates are children, not parents. If skein refuses a workspace for uncommitted changes, leave it, and report what's dirty (`skein status <id> --json` gives the worktree path; `git -C <path> status --short`). Let the user decide.

## 4. Update the plan and report

Append ` · archived` to each archived row's State and add a `## Log` line. Report archived / refused (with reason) / skipped (not merged).
