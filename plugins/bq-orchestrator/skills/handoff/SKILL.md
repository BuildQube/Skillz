---
name: handoff
description: Use in an orchestrator workspace when one plan's round is finishing and the next begins — "hand off to a new orchestrator", "start the next round", "carry the open items over", "seed a new plan from this one", or when continuing from a predecessor orchestrator ("pick up where <old worktree> left off"). Writes a handoff summary, seeds the successor plan with carry-over items, and links the two plans.
argument-hint: "[successor worktree | predecessor worktree]"
---

# Handoff

Move an orchestrator's open work into a successor plan. References:
- Plan format: `${CLAUDE_SKILL_DIR}/../../references/plan-format.md`
- Role: `${CLAUDE_SKILL_DIR}/../../references/orchestrator-role.md`

Two directions — work out which from where you are and `$ARGUMENTS`:
- **Outgoing** — run in the old orchestrator: the successor worktree is given, or will be created.
- **Incoming** — run in a new worktree: the predecessor worktree is given (find it with `git worktree list`, then read its `execution-plan.md`).

## 1. Refresh first

The handoff must start from current state. Run the `/bq-orchestrator:refresh` sequence on the old plan (skip the merge step if you're in the new worktree; read the old plan's PRs and trackers directly).

## 2. Collect carry-over

From the old plan:
- Rows not `✅ merged` — still `proposed`, launched, or in PR. In-flight ones stay owned by their existing workspaces: carry them as rows, not new work (see step 4).
- Backlog items, follow-ups filed during the round, unticketed findings, and decisions still awaiting the user.
- Context and rules the new round must not violate.

## 3. Write the handoff summary

In the old worktree, `handoff.md` (append if it exists): what shipped (PRs), what's carried and why, open decisions, gotchas learned (tool quirks, review patterns, flaky checks), and the successor's location.

## 4. Seed the successor plan

If the successor worktree has no `execution-plan.md`: write one per plan-format.md with `predecessor: <old worktree>` and the old header's skein project, tracker, assignee, tracker settings and `review:` (keys the domain file already supplies can be left out). Carry-over rows keep their WS labels, Issues, Seam and Depends on; new rows continue the label sequence.
- Not-started rows (`proposed`, `⏸ blocked`) carry with their State and `### <WS>` notes as they are. The successor launches them.
- In-flight rows (launched or in PR) carry with State `in flight · owned by <old plan>` (`<old plan>` = the old orchestrator's worktree name), keeping the `ws <id>`, `PR #N` and `· session <name>` parts. The successor's `refresh` tracks them to merge, and its `launch` refuses them. If the successor already has a plan, merge the carry-over into it without duplicating rows (match on issue ids).

If the successor worktree doesn't exist yet, offer to create it as a skein workspace: `skein new --project <skein_project> --name "<next round title>" --prompt "/bq-orchestrator:handoff <old worktree>"` (plus `--submit` when `launch.submit` is true) — then that prompt runs there (the user presses Enter, or skein sends it with `--submit`), in the incoming direction. Create it top-level: never `--parent` (skein allows one level, and children hang off orchestrators).

**Move the children** (skein ≥ 0.56.1, see "Parent workspaces" in config.md). Once the successor workspace exists, resolve the old orchestrator's id and the successor's id (its row in `skein list --project <skein_project> --json` by `worktree_path`, or the id `skein new` printed). List the old orchestrator's children with `skein list --parent <old id> --json` and move the open ones (not archived) under the successor:

```bash
skein move <child id> [<child id> ...] --parent <successor id> --json
```

Run in either direction, whichever side first has both ids. Children already under the successor are fine to pass again. On an older skein, or if an id doesn't resolve, skip this and say so; the rows still carry as `in flight · owned by <old plan>`.

## 5. Close the old plan

Set the old plan's front matter `status: superseded` and `successor: <new worktree>`, and add a `## Log` line. A superseded plan no longer triggers orchestrator mode in its worktree. Suggest `/bq-orchestrator:archive` for its merged workspaces.

## 6. Report

Successor plan path, rows carried (in flight vs not started), open decisions, and the next step there.
