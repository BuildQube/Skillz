---
name: address-pr-feedback
description: Use when the user wants to triage and address feedback on an open pull request — review comments, inline suggestions, blocking reviews, bot reviews, or failing CI checks. Triggers on "address the PR feedback", "read the PR comments and see if anything is worth addressing", "look at the review comments", "fix the reviewer's nits", "the reviewer asked for X", "what does CI say on my PR", "the build is red", "push fixes for the failing checks", or any variation. Defaults to the current branch's PR; accepts a PR number. Applies fixes, runs the repo's own checks for what changed, commits, pushes, then replies to and resolves each handled thread. Not for opening a new PR or rewriting history.
argument-hint: "[PR number]"
---

# Address PR Feedback

Close out review feedback and failing CI on an open PR without the user babysitting it:

1. **Resolve the PR** and learn the repo's conventions.
2. **Pull everything that could be feedback** — unresolved threads, reviews, top-level comments, CI.
3. **Triage** into apply / answer / decline / skip, and show the plan.
4. **Apply fixes.**
5. **Run the checks that matter** for what changed.
6. **Commit and push** — normal push, never `--no-verify`.
7. **Reply on GitHub** and resolve each handled thread.
8. **Report back** — honestly about CI.

The user said "address the feedback" and walked away. Don't ask them to pick which comments to handle — make the call and tell them what you decided.

Helper scripts live in `${CLAUDE_SKILL_DIR}/scripts/` (all need an authenticated `gh` and `jq`):

| Script | Does |
|---|---|
| `pr-feedback.sh [PR] [--all]` | One JSON doc: PR metadata, `me`, unresolved threads (with `threadId`, `firstCommentId`, `lastAuthorIsMe`, `allBots`), reviews, top-level comments. Bots detected by GitHub account type, not a hardcoded list. |
| `ci-status.sh [PR] [--logs] [--watch]` | Per-bucket counts, the failing/pending checks, failed-step logs per job, and a verdict. Exit 0 green, 1 failing, 3 pending. |
| `reply-resolve.sh <PR> <comment-id> <thread-id> <body> [--no-resolve]` | Threaded inline reply, then resolves the thread. |

## 1. Resolve the PR and learn the repo

```bash
gh pr view $ARGUMENTS --json number,url,headRefName,headRefOid,baseRefName,state,isDraft
```

- No PR on the current branch → stop and say so. Don't open one; the user may be on the wrong branch.
- PR not `OPEN` → stop and say so.
- Given a PR number that isn't the current branch: if `git worktree list` shows the head ref checked out elsewhere, work there (`gh pr checkout` hard-errors on a duplicate checkout). Otherwise `gh pr checkout <N>`, but only with a clean working tree.
- Make sure the local branch is up to date with the remote head (`git pull --ff-only`) before editing.

Then build a **repo profile** — the check commands, commit style, and gotchas for *this* repo. Follow [references/repo-profile.md](references/repo-profile.md). In short: if `.claude/pr-feedback.md` exists, it is authoritative; otherwise derive the profile from CI workflows, package scripts, `CLAUDE.md`/`AGENTS.md`, hooks, and `git log`.

## 2. Pull all feedback

```bash
"${CLAUDE_SKILL_DIR}/scripts/pr-feedback.sh" <PR>
"${CLAUDE_SKILL_DIR}/scripts/ci-status.sh" <PR> --logs
```

If `truncated` is true there are more than 100 threads; say so and work the first page.

Read reviews and top-level comments too, not just inline threads — a `CHANGES_REQUESTED` review body or a top-level "can you also…" comment is feedback.

### `pending` is not `pass`

A checks snapshot taken while jobs are still running looks like "some pass, some pending, nothing red" and reads as fine right up until it concludes `failure`. Slow jobs (e2e, build matrices, emulated targets) report last, so the snapshot is most misleading exactly when it matters. Trust the `ci-status.sh` verdict: `PENDING` means unknown, never green. If CI is still running at the start, work the review feedback first and re-check CI before you push.

## 3. Triage

**Skip** a thread (no reply) if:
- it's resolved (the script already drops these), or
- it's outdated *and* about a line that no longer exists, or
- `lastAuthorIsMe` is true — you or the user already responded; don't loop. Also treat a thread as answered if its last comment is an `Addressed in <sha>` reply from any account.

**Bots** (`isBot` / `allBots`) review noisily and without context. Re-running this skill must never get stuck arguing with one.
- Concrete and correct on its merits → **apply**, and reply like you would to a human.
- Paused / rate-limited / billing / advisory / deploy-preview notices, changeset reminders with nothing to do → **skip** silently.
- A top-level review *summary* whose findings are repeated as inline threads → **skip** the summary; handle the inline threads.
- Wrong or out of context → **decline** with a one-line reason. Don't debate.

Everything that survives is one of:
- **apply** — a concrete change is requested or obviously needed (bug, typo, suggestion block, security issue, failing assertion).
- **answer** — a question or a request for context; no code change. Reply with the explanation.
- **decline** — out of scope, would regress something, conflicts with a repo rule, or was already handled in a way the reviewer missed. Reply with the reason.

### CI failures

Default is **apply**: work out the fix from the failed logs. But first confirm the failure is actually caused by this PR:

```bash
gh pr view <PR> --json files --jq '.files[].path'
```

If the failing test/package isn't touched by the diff:
1. Re-run the failing command locally on the PR branch. Passes locally → probably a flake.
2. Check whether the same job is red on the base branch: `gh run list --branch <base> --workflow "<workflow>" --limit 5 --json conclusion,headSha,createdAt`. Red there too → pre-existing.
3. Only red here *and* green on the base branch makes it yours to fix.

For a flake or pre-existing failure: **decline**. Say so in the final report (and in the commit body if you commit anything), and file a follow-up if the repo has a tracker convention. If you need to reproduce on the base branch, use a throwaway worktree (`git worktree add "$TMPDIR/base-check" <base>`), never `git checkout`/`stash` in the PR worktree.

If a failure is on only one exotic target or platform in a matrix, it's a real portability break in the diff, not a flake.

Non-Actions checks (Vercel previews, third-party bots) are usually not yours to fix; only act if the failure clearly points at the diff.

**Never fake a fix.** Disabling or skipping a test, loosening an assertion to match wrong output, bumping a timeout to hide a hang, or adding a sleep to mask a race burns more trust than a red check.

### Show the plan

Print one line per item before editing, then proceed unless the user objects:

```
Apply (4):
  #2041 src/api/orders.ts:42 alice        — null-check customer before deref
  #2042 src/api/orders.ts:88 claude[bot]  — concrete: query missing org filter (bot, but correct)
  review bob (CHANGES_REQUESTED)          — add a test for the empty-cart path
  CI    test / unit                       — your diff broke orders.test.ts:57
Answer (1):
  #2045 README.md:12 carol                — "why drop the cache?" → explain, link the issue
Decline (2):
  #2046 src/legacy.ts:9 dave              — out of scope; follow-up filed
  CI    e2e (4, 8)                        — fails on main too (run 123456), unrelated
Skip: 3 — qodo paused notice, claude summary (covered inline), #2040 already replied
```

## 4. Apply fixes

Edit the files. For inline `suggestion` blocks, apply them verbatim unless they're wrong. Respect the repo profile's conventions — a reviewer citing a house rule is asking you to follow it, not inventing a new pattern. If a request conflicts with `CLAUDE.md`, memory, or `.claude/pr-feedback.md`, follow the rule and decline the request with a one-line citation.

## 5. Run the checks that matter

Use the check commands from the repo profile: always run the cheap always-on gates (lint, format check, typecheck), and add tests/builds only for the areas the diff touched. Prefer the exact commands CI runs.

If something fails, fix and re-run. After about 3 failed attempts at the same check, stop and report what's failing and what you tried — repeated red usually means you misread the request.

## 6. Commit and push

- Match the repo's commit style from the profile (conventional prefix or plain subject). Write the subject in the reviewer's terms ("address review: null-check customer" beats "fix bug"); list the handled items in the body.
- `git add` specific files. Include lockfile drift and any regenerated/committed artifacts the profile calls out.
- End the message with the co-author/attribution line your instructions specify, for whatever model you actually are. Never hardcode a model name into committed files.
- Never `--no-verify`. If a hook fails, fix the cause.
- **Re-verify after committing.** Hooks may rewrite files (formatters, `--fix` linters, codegen). `git status` must be clean; if a hook left changes, inspect them, re-run the checks, and amend if they belong.
- Plain `git push`. If the remote moved, `git pull --rebase`, re-run checks, push. Never force-push. Resolve rebase conflicts properly; if one is non-trivial, stop and ask.

If the PR title must follow a convention and a title-lint check is failing, fix it with `gh pr edit <PR> --title "…"`.

## 7. Reply on GitHub

For each **apply** thread, reply with the commit SHA and what changed, then resolve:

```bash
SHA=$(git rev-parse --short HEAD)
"${CLAUDE_SKILL_DIR}/scripts/reply-resolve.sh" <PR> <firstCommentId> <threadId> "Addressed in $SHA — added the null check before dereferencing \`customer\`."
```

- **answer** → reply with the explanation and resolve.
- **decline** → reply with the reason and resolve. If it's a real follow-up rather than a "no", file it first (the repo's tracker — Linear, `gh issue create`, etc.) and link it in the reply.
- Feedback from a **review body or top-level comment** (not a thread) → one top-level `gh pr comment <PR> --body "…"` summarizing what was addressed, with the SHA. Don't post one comment per item.
- **CI failures** need no reply — the pushed fix and the re-run are the reply.

Leave threads unresolved (`--no-resolve`) only when you're genuinely asking the reviewer a question back.

## 8. Report back

One short summary: PR URL, commit SHA(s), counts of applied / answered / declined / skipped, and the CI state.

Be exact about CI — it's the easiest place to say something untrue by accident. Right after a push the checks will be pending. "Pushed; lint and unit green, e2e still running" is honest; "all green" is not until `ci-status.sh` says `GREEN`. If the user wants a verdict, run `ci-status.sh <PR> --watch` and report what it concludes. If new failures appear after your push, they're part of this task — loop back to triage.

## Failure modes

- **No open PR** → stop and report.
- **Dirty working tree before you start** → don't stash or discard the user's work; ask.
- **Same check red after ~3 fix attempts** → stop and report. Don't keep pushing red commits.
- **You said green and it went red** → you read a pending snapshot. Use the verdict.
- **Working tree dirty after commit** → hooks rewrote files; inspect, re-verify, amend. Don't `git checkout .` over it.
- **Bot thread** → apply only if correct on its merits; you have the context, it doesn't.
