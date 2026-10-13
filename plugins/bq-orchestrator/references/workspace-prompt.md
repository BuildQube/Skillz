# Workspace prompt

`launch` builds every implementer workspace's starting prompt from these layers, in this order. Layers 2 and 3 are the plugin default; layer 4 is per repo.

1. **Task** — generated from the plan row.
2. **Quality bar** — verbatim block below.
3. **Landing the work** — verbatim block below.
4. **Repo addendum** — the first of these that exists, verbatim:
   1. `workspace-prompt-addendum.md` in the orchestrator worktree root (untracked; the default)
   2. `.claude/workspace-prompt.md` committed in the repo
   3. `~/.claude/bq-orchestrator/<repo-name>.md` (user-level; `<repo-name>` = basename of the main worktree, i.e. the first entry of `git worktree list`)

   If none exists, omit the layer and mention it in the launch report.

   **The addendum can replace a default layer.** If it has a `## Quality bar` heading, that section (up to the next `## ` heading) is used as layer 2 in place of the default block. A `## Landing the work` heading does the same for layer 3. Headings match case-insensitively. Whatever remains of the addendum becomes layer 4 as usual. Use this when a repo's conventions conflict with a default, so the workspace never receives both versions.

## 1. Task (template)

```
You are implementing workspace <WS> of the "<plan title>" plan. You are an implementer: build, test, and land this as a PR.

Issues: <ids with titles/links, or "none — details below">
Priority: <Pri>   Seam: <Seam>
<If Depends on is set:> Builds on workspace <X> (<its state: merged in #N / PR #N open / not yet landed — coordinate>).

Context:
<the plan's Context section, trimmed to what this workspace needs>

What to do:
<issue description summary if fetched, plus the plan's "### <WS> — …" notes verbatim>

Neighbors — other workspaces touching nearby code; don't step on them:
<each Collisions / ordering bullet naming this workspace, plus any in-flight workspace sharing a file/seam>

<If several issues:> These ship as ONE PR covering <ids>.
<If base_branch is not the default or the workspace is stacked:> Base your PR on <branch>.
```

Keep it tight. The workspace agent can read the issue itself; give it the decisions and constraints it can't discover.

## 2. Quality bar (verbatim)

```
QUALITY BAR:
- Read each linked issue in full first; treat findings in it as claims to verify against current code, not facts.
- Work in ponytail mode: run /ponytail:ponytail first. Smallest change that actually works, at the right altitude. No speculative abstraction, no interface with one implementation, no config for a value that never changes.
- DRY, hard. Before writing anything, look for the helper, type, or pattern that already exists and reuse it. A second copy of logic that lives a few files over is the failure mode we care most about. If two call sites need the same rule, extract it once.
- Beneficial tests wherever applicable: a test that fails if the logic breaks, not one that restates it. Mutation-check it — revert the fix and confirm that exact test goes red. Pick the test lane that can actually observe the claim.
- Follow CLAUDE.md / AGENTS.md and any path-scoped rules files for every path you touch. Update a rules file when your change establishes a rule a future reader would otherwise re-derive.
- Before opening the PR, the diff must pass /simplify and /ponytail:ponytail-review. Apply what they find, or note in the PR why not.
```

## 3. Landing the work (verbatim)

```
LANDING THE WORK:
- Commit as you go — a step that passes its test is a commit.
- The end goal is a PR following this repo's conventions (see the repo addendum below, if any).
- After pushing, wait for every check to FINISH before reading the PR — automated reviewers often post as part of the check run, so a PR read early looks clean. Use `gh pr checks --watch`.
- Then run /bq-code:address-pr-feedback. Repeat — wait for checks to finish, then address-pr-feedback — until every check is green and every review thread is replied to and resolved. Any push restarts the loop, because a new review can land on new commits.
- A pre-existing or flaky failure is not "done" by re-running: say so explicitly with evidence.
- Done means: PR open, checks green, all threads resolved, nothing in flight. Report the PR URL.
```

## 4. Repo addendum

Verbatim (minus any section that replaced layer 2 or 3), prefixed with `REPO CONVENTIONS:` if it doesn't already start with a heading. Typical content: commit message format, PR title format (e.g. a required issue-id suffix and why it matters), PR body template sections, labels to avoid, required local gates. It should *not* repeat the review loop, because layer 3 owns that. To change the loop, replace layer 3 with a `## Landing the work` section.
