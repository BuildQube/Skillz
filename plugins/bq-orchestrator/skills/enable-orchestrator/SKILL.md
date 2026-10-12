---
name: enable-orchestrator
description: Use when the user wants to turn the current skein workspace into an orchestrator — "make this an orchestrator", "enable orchestrator", "set up an execution plan here", "this workspace plans and launches, it doesn't implement", or when starting a new multi-workspace effort from a Slack thread, findings doc, epic, or issue list. Scaffolds or migrates execution-plan.md, locates the workspace prompt addendum, and switches the session into orchestrator mode.
argument-hint: "[source: link, file, epic, or issue ids]"
---

# Enable orchestrator

Turn this worktree into a bq-orchestrator workspace. Shared references:
- Plan format: `${CLAUDE_SKILL_DIR}/../../references/plan-format.md`
- Trackers: `${CLAUDE_SKILL_DIR}/../../references/trackers.md`
- Prompt layers: `${CLAUDE_SKILL_DIR}/../../references/workspace-prompt.md`
- Role: `${CLAUDE_SKILL_DIR}/../../references/orchestrator-role.md`

Read the plan format before writing anything.

## 1. Preconditions

- `command -v skein` and `skein projects --json` succeed. If not, relay the error (open the Skein app / install the Companion CLI) and stop.
- You're at the root of a git worktree (`git rev-parse --show-toplevel` equals the cwd). If not, ask whether to use the toplevel.

## 2. Plan file

**If `execution-plan.md` exists without front matter** (a pre-plugin plan): migrate it. Infer as much front matter as you can from the body (title, started date, sprint/epics, skein project id from any `skein new --project …` line, deadline, Airtable base/table from links, assignee ids mentioned, predecessor). Ask only for what's missing and required: `skein_project` and the default `tracker`. Add a `State` column to the workspace table, inferred from inline markers (✅ merged #N, 🚧 PR #N, launched …). Don't rewrite the rest of the document.

**If it exists with `orchestrator: bq-orchestrator`**: it's already enabled — say so, skip to step 4.

**If it doesn't exist**: scaffold it.
1. Gather the header. Resolve `skein_project` via `skein projects --json` (match the repo; ask if ambiguous). Ask for the default tracker and assignee if they can't be inferred — offer `none` as a valid tracker. For Airtable, ask for base/table/fields once; they'll be reused by every launch.
2. If the user gave a source ($ARGUMENTS — a Slack thread, a findings file, an epic, a list of issue ids): read it and propose the Workspaces table — group issues into workspaces by seam, set priorities and dependencies, and write the Collisions / ordering section. Pick WS labels that are unique across sibling orchestrator plans (`git worktree list`, then each worktree's `execution-plan.md` front matter): continue after the highest label in use.
3. Otherwise write the skeleton with an empty Workspaces table.
4. Write `execution-plan.md` at the worktree root. Add a `## Log` entry for today.

Never commit the plan — it stays untracked. Check it isn't gitignored-away in a way that hides it from the user; untracked is the intent.

## 3. Prompt addendum

Look for the repo addendum in the order in the prompt-layers reference (worktree `workspace-prompt-addendum.md` → committed `.claude/workspace-prompt.md` → `~/.claude/bq-orchestrator/<repo>.md`). Report which one launches will use.

If none exists, offer to draft `workspace-prompt-addendum.md` in this worktree from the repo's real conventions: commitlint/commit history, PR title rules (look for a title-lint workflow and any workflow that parses the title), `.github/PULL_REQUEST_TEMPLATE.md`, and labels that don't exist. Keep it to repo conventions — the review loop is already in the default prompt. Show the draft and write it only on approval.

## 4. Switch into orchestrator mode

Read `orchestrator-role.md` and follow it for the rest of this session. (The plugin's SessionStart hook re-applies it automatically in future sessions in this worktree.)

## 5. Report

Short: plan path (created / migrated / already enabled), the header values, the workspaces proposed (if any), which addendum will be used, and the next step — usually "review the plan, then `/bq-orchestrator:launch <WS>`".
