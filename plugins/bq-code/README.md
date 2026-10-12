# bq-code

BuildQube coding workflow for Claude Code — skills for the day-to-day loop of shipping code, starting with closing out PR feedback.

## Install

```
/plugin marketplace add BuildQube/Skillz
/plugin install bq-code@skillz
```

Requires an authenticated [`gh`](https://cli.github.com/) CLI and `jq`.

## What's inside

| Type | Name | Purpose |
|------|------|---------|
| Skill | `address-pr-feedback` | Read a PR's review threads, reviews, comments, and CI; decide what's worth addressing; fix, run the repo's checks, commit, push; reply to and resolve each handled thread. |

### address-pr-feedback

Triggers on things like "address the PR feedback", "read the PR comments and see if anything is worth addressing", or "fix the failing checks". Or invoke it directly: `/bq-code:address-pr-feedback [PR number]`.

It works in any repo: it learns the check commands, commit style, and gotchas from the repo's CI workflows, package scripts, `CLAUDE.md`/`AGENTS.md`, and git history. To pin repo-specific rules (check matrix, generated files, hooks that rewrite code, house rules reviewers cite), add a `.claude/pr-feedback.md` — see [the template](skills/address-pr-feedback/references/repo-profile.md#source-1-claudepr-feedbackmd-authoritative-if-present).

Bundled helpers (in `skills/address-pr-feedback/scripts/`, usable standalone):

| Script | Does |
|---|---|
| `pr-feedback.sh [PR] [--all]` | All feedback as one JSON doc: unresolved threads with IDs needed to reply/resolve, reviews, top-level comments, bot detection by account type |
| `ci-status.sh [PR] [--logs] [--watch]` | CI verdict that never confuses pending with green; per-job failed logs anchored on the error |
| `reply-resolve.sh <PR> <comment-id> <thread-id> <body>` | Threaded reply + resolve |
