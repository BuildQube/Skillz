---
name: refresh
description: Use in an orchestrator workspace when the user says "refresh", "status", "where are we", "what moved", "what's next", or asks for a status pass over the plan. Merges origin into the orchestrator worktree, then reports GitHub, issue tracker, and skein state against execution-plan.md and updates the plan's State column.
---

# Refresh

The standing status command. When the user says **refresh**, run the whole sequence and report — no other prompting. References:
- Plan format: `${CLAUDE_SKILL_DIR}/../../references/plan-format.md`
- Trackers: `${CLAUDE_SKILL_DIR}/../../references/trackers.md`

If there's no `execution-plan.md` with `orchestrator: bq-orchestrator` front matter, stop and suggest `/bq-orchestrator:enable-orchestrator`.

## 1. Pull the base branch in

```bash
git fetch origin
git log --oneline HEAD..origin/<base_branch>    # what landed
git merge origin/<base_branch>
```

Always compare against `origin/<base_branch>` — a local base branch lags in a worktree. The plan is untracked, so the merge won't touch it. On a conflict, **stop and say so**; don't resolve unasked. Uncommitted changes to tracked files → don't merge; report and ask.

## 2. Gather (in parallel where you can)

For every workspace row that isn't `proposed` or archived:

- **skein** — `skein list --project <skein_project> --json` once; match rows by workspace id or linked issue. `skein pr <ws> --refresh --json` for each live one.
- **GitHub** — for each PR: `gh pr view <N> --json state,mergedAt,reviewDecision,isDraft,url,title` and `gh pr checks <N> --json name,bucket`. Count unresolved review threads if `bq-code` is installed (`pr-feedback.sh` from its address-pr-feedback skill), otherwise via `gh api graphql` on `reviewThreads { isResolved }`. Pending checks are pending, never green.
- **Trackers** — for each issue id, read status and assignee per trackers.md.
- **Repo** — `gh pr list --state open --json number,title,author,headRefName` for PRs touching the plan's seams that aren't ours (other people's work that will collide).

## 3. Update the plan

Rewrite each row's State to match reality (see the lifecycle in plan-format.md): launched → PR → merged; note checks and open threads on open PRs. Move nothing between sections and don't reword the user's notes. Add a dated `## Log` line summarizing what moved.

## 4. Report against the plan

Short, in this order:
1. **Landed** — what merged since the last refresh (from step 1 and PR states).
2. **In flight** — per workspace: PR, checks (green / N failing / N pending), unresolved threads, review decision. Flag a workspace that's been idle with no PR.
3. **Blocked / needs you** — red checks with no activity, `CHANGES_REQUESTED`, decisions awaiting the user, merge conflicts, dependencies that landed (so a blocked row is now launchable).
4. **Mismatches** — tracker status contradicting the PR (merged but "In Progress", unassigned but launched), and any issue description now stale against what actually shipped.
5. **Next** — what to launch next (unblocked `proposed` rows by priority), PRs that look ready for `/bq-orchestrator:review`, and merged workspaces ready for `/bq-orchestrator:archive`.

Keep it to what changed, what is blocked, what to start next.
