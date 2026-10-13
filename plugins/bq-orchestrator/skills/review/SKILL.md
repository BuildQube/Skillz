---
name: review
description: Use in an orchestrator workspace when the user wants to check on, review, or merge the workspaces' PRs — "check the status of the PRs", "review what's up", "review I and J", "look at the open PRs and merge the ones that are good", "merge it if it looks good", "is K ready to merge". Gathers PR status, reviews each diff against its plan row with a correctness pass and a /ponytail:ponytail-review pass, sends approved findings to the implementing workspace instead of fixing them, and merges clean PRs in dependency order (with confirmation unless the user already authorized merging).
argument-hint: "[WS labels | all-open] [merge]"
---

# Review

Status → review → (maybe) merge for the plan's open PRs. The orchestrator stays read-only on product code: findings go to the implementer through `/bq-orchestrator:message`; the orchestrator never pushes fixes. References:
- Plan format: `${CLAUDE_SKILL_DIR}/../../references/plan-format.md`
- Trackers: `${CLAUDE_SKILL_DIR}/../../references/trackers.md`
- Config (`review.*`; front matter > domain file > defaults): `${CLAUDE_SKILL_DIR}/../../references/config.md`

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
- **Expected reviewers.** Once checks have finished, check each login in `review.expected_reviewers` for a review on `headRefOid` (`gh api repos/{owner}/{repo}/pulls/<N>/reviews`, `commit_id`) or a PR comment created after the head commit (`gh pr view <N> --json comments,commits`). Warn when one posted nothing: the bot may have silently skipped the PR. Don't warn while checks are still pending.
- **Cross-PR overlap.** Intersect the PR's files (`gh pr view <N> --json files`) with every other open PR that isn't in the plan (`gh pr list --state open --json number,title,author,files`). Report each shared file with the other PR. Two PRs editing one module can each pass alone and break together, for example when one calls a method the other's version removes.

## 2. Review (per PR that isn't already disqualified by red checks or a draft)

Review all PRs in parallel: start every PR's correctness agent in the background first, then do the other passes while they run.

1. **Against the plan** — read the diff (`gh pr diff <N>`) and the row: does it deliver the issue(s)? Respect the plan's Context rules? Stay within its seam, or touch a sibling's files? Anything listed as "do not" in the row notes?
2. **Correctness** — hunts bugs. Run `review.correctness_agent` (default `/code-review`) as a **background** agent, one per PR. If the value is `/code-review`, the agent runs `/code-review <N>`. Otherwise use it as the agent's `subagent_type`. Its prompt carries:
   - the PR number/URL and head SHA, the plan row, its `### <WS>` notes, and the plan's `Context` section;
   - on a re-review, the previous round's findings (from the last review's `## Log` lines or the message sent): verify each one is fixed, citing file:line, and that each required test would fail if its fix were reverted;
   - the ask: **a verdict first** (ship / fix first), then **blockers**, **should-fix** and **nits**, each with file:line and a concrete failure scenario (inputs or state → wrong result). Pay attention to auth/session boundaries, races, and state carried across users or accounts.
3. **Simplicity**: run `/ponytail:ponytail-review` on the PR (pass the PR number or URL). It hunts complexity, not bugs, so it never replaces pass 2. Use the PR's head, not this worktree's files. If a pass needs a checkout, use a throwaway worktree (`git worktree add "$TMPDIR/review-<N>" <headRefOid>`; remove it after), never this orchestrator worktree.
4. **Merge the findings.** Collect all three passes and dedupe findings that cite the same line or the same root cause. Rank them as **blocking** (wrong behavior, data/security risk, violates a plan rule, missing test for risky logic, an unfixed previous finding), then **should-fix**, then **nits**.

## 3. Findings → the workspace

Follow `review.findings` (default `ask`):

- **`ask`**: show the user, per PR, the ranked findings and your recommended action. List what to fix in this PR and what to defer to a follow-up ticket, with one line of reasoning each. Wait. Send only what the user approves, edited as they say. The user may overrule a finding (e.g. ask for parity with existing behavior over a stricter design the reviewer suggested). Their decision goes in the message as the instruction, and in `## Log`.
- **`auto`**: send everything without asking, blocking findings first.

Send one message per PR to its workspace via `/bq-orchestrator:message`, which resolves the session (the row's recorded `· session`, else the prefix match) and asks you when several match: blocking first, then the rest, each with file:line and the concrete ask. Don't post them as PR comments unless the user asks — the implementer handles them and its own address-pr-feedback loop covers any reviewer comments. Workspace not live → include the paste-ready text in the report. Record what was sent in `## Log`, because the next round's correctness pass verifies it.

## 4. Merge gate

A PR is mergeable only if **all** hold:
- every check concluded green (no pending, no failures — a pre-existing flake counts as red until a human says otherwise);
- zero unresolved review threads; `reviewDecision` isn't `CHANGES_REQUESTED`; not a draft;
- `mergeable` is `MERGEABLE` and `mergeStateStatus` isn't `BEHIND`/`DIRTY`/`BLOCKED`;
- every plan dependency is already merged;
- no blocking findings from step 2 that the user hasn't waived;
- the title matches the repo's required convention, if any.

## 5. Merge (only with authority)

- Order: dependencies first, then by priority. One at a time.
- Method: the repo's — check `gh repo view --json squashMergeAllowed,mergeCommitAllowed,rebaseMergeAllowed`; prefer squash when allowed, otherwise the only allowed method. `gh pr merge <N> --squash` (or `--merge`/`--rebase`). Don't pass `--admin` and don't bypass protections. Delete the branch only if the repo's convention or the user says so.
- After each merge, re-check the next PR's gate — a merge can make it `BEHIND` or conflicting. If so, message that workspace to update from the base branch and stop merging it this round.
- Message in-flight siblings that share a seam with the merged PR ("M merged in #N — rebase onto <base> before your next push").

## 6. Update the plan and report

Update each reviewed row's State (`✅ merged #N (<date>)`, or `🔀 PR #N · <checks> · <threads> · reviewed <date>: N blocking`) and add `## Log` lines for reviews, messages and merges.

Report per PR, one line each: **merged** / **ready to merge** (when not authorized) / **findings sent** / **findings awaiting your call** (N blocking, N should-fix, N nits) / **waiting** (checks pending, threads open, dependency unmerged) / **red** (what's failing). Add warnings for silent expected reviewers and for files shared with open PRs outside the plan. Then next steps: the PRs you'd merge if asked, and merged workspaces ready for `/bq-orchestrator:archive`.
