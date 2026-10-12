---
name: review
description: Use in an orchestrator workspace when the user wants to check on, review, or merge the workspaces' PRs — "check the status of the PRs", "review what's up", "review I and J", "look at the open PRs and merge the ones that are good", "merge it if it looks good", "is K ready to merge". Gathers PR status, reviews each diff against its plan row with /ponytail:ponytail-review, sends findings to the implementing workspace instead of fixing them, and merges clean PRs in dependency order (with confirmation unless the user already authorized merging).
argument-hint: "[WS labels | all-open] [merge]"
---

# Review

Status → review → (maybe) merge for the plan's open PRs. The orchestrator stays read-only on product code: findings go to the implementer through `/bq-orchestrator:message`; the orchestrator never pushes fixes. References:
- Plan format: `${CLAUDE_SKILL_DIR}/../../references/plan-format.md`
- Trackers: `${CLAUDE_SKILL_DIR}/../../references/trackers.md`

## 0. Scope and merge authority

- Rows: WS labels from `$ARGUMENTS`, else every row in PR state (`all-open`). Find each row's PR from its State or `skein pr <ws> --refresh --json`; a launched row with no PR yet → report "no PR yet" and skip.
- **Merge authority:** merging is allowed only if the user's request asks for it ("merge", "merge if good", "ship the clean ones"). Then that request is approval for every PR that passes the gate below — no per-PR question. Without it, review only, and end by offering to merge the ones that passed. Never merge a PR that fails the gate, whatever was asked.

## 1. Status (per PR)

Use bq-code's helper scripts when you can find them — the first existing match of `${CLAUDE_SKILL_DIR}/../../../bq-code/skills/address-pr-feedback/scripts` (same checkout) or `~/.claude/plugins/cache/*/bq-code/*/skills/address-pr-feedback/scripts` (installed; take the newest version) — else plain `gh`:
- **Checks** — `ci-status.sh <N>` (or `gh pr checks <N> --json name,bucket`). Pending is unknown, never green. If the user wants a verdict, `--watch` it.
- **Threads** — unresolved review threads (`pr-feedback.sh <N>`, or GraphQL `reviewThreads { isResolved }`).
- **PR state** — `gh pr view <N> --json state,isDraft,mergeable,mergeStateStatus,reviewDecision,baseRefName,headRefOid,url,title`.
- **Plan** — dependencies merged? Collisions bullets naming an in-flight sibling?
- **Title convention** — if the repo addendum requires a title format (e.g. an issue-id suffix that syncs the tracker), check it.

## 2. Review (per PR that isn't already disqualified by red checks or a draft)

1. **Against the plan** — read the diff (`gh pr diff <N>`) and the row: does it deliver the issue(s)? Respect the plan's Context rules? Stay within its seam, or touch a sibling's files? Anything listed as "do not" in the row notes?
2. **Code quality** — run `/ponytail:ponytail-review` on the PR (pass the PR number or URL). Use the PR's head, not this worktree's files — if the skill needs a checkout, use a throwaway worktree (`git worktree add "$TMPDIR/review-<N>" <headRefOid>`; remove it after), never this orchestrator worktree.
3. Classify each finding: **blocking** (wrong behavior, data/security risk, violates a plan rule, missing test for risky logic) or **non-blocking** (cleanup, nits).

## 3. Findings → the workspace

For each PR with findings, send one message to its workspace via `/bq-orchestrator:message` containing the blocking findings first, then the non-blocking ones, each with file:line and the concrete ask. Don't post them as PR comments unless the user asks — the implementer handles them and its own address-pr-feedback loop covers any reviewer comments. Workspace not live → include the paste-ready text in the report.

## 4. Merge gate

A PR is mergeable only if **all** hold:
- every check concluded green (no pending, no failures — a pre-existing flake counts as red until a human says otherwise);
- zero unresolved review threads; `reviewDecision` isn't `CHANGES_REQUESTED`; not a draft;
- `mergeable` is `MERGEABLE` and `mergeStateStatus` isn't `BEHIND`/`DIRTY`/`BLOCKED`;
- every plan dependency is already merged;
- no blocking findings from step 2;
- the title matches the repo's required convention, if any.

## 5. Merge (only with authority)

- Order: dependencies first, then by priority. One at a time.
- Method: the repo's — check `gh repo view --json squashMergeAllowed,mergeCommitAllowed,rebaseMergeAllowed`; prefer squash when allowed, otherwise the only allowed method. `gh pr merge <N> --squash` (or `--merge`/`--rebase`). Don't pass `--admin` and don't bypass protections. Delete the branch only if the repo's convention or the user says so.
- After each merge, re-check the next PR's gate — a merge can make it `BEHIND` or conflicting. If so, message that workspace to update from the base branch and stop merging it this round.
- Message in-flight siblings that share a seam with the merged PR ("M merged in #N — rebase onto <base> before your next push").

## 6. Update the plan and report

Update each reviewed row's State (`✅ merged #N (<date>)`, or `🔀 PR #N · <checks> · <threads> · reviewed <date>: N blocking`) and add `## Log` lines for reviews, messages and merges.

Report per PR, one line each: **merged** / **ready to merge** (when not authorized) / **findings sent** (N blocking, N non-blocking) / **waiting** (checks pending, threads open, dependency unmerged) / **red** (what's failing). Then next steps: the PRs you'd merge if asked, and merged workspaces ready for `/bq-orchestrator:archive`.
