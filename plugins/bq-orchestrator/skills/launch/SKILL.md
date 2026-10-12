---
name: launch
description: Use in an orchestrator workspace when the user wants to start work on one or more planned workspaces — "launch I", "kick off workspace J and K", "start O5326", "spin up the next one", "launch everything that's unblocked". Assigns the issue at start, builds the standard layered prompt (task + quality bar + landing loop + repo addendum), creates the skein workspace, and updates execution-plan.md.
argument-hint: "<WS label(s) | issue id(s) | next>"
---

# Launch

Start implementer workspaces from rows of `execution-plan.md`. References:
- Plan format: `${CLAUDE_SKILL_DIR}/../../references/plan-format.md`
- Trackers: `${CLAUDE_SKILL_DIR}/../../references/trackers.md`
- Prompt layers: `${CLAUDE_SKILL_DIR}/../../references/workspace-prompt.md`

If there's no `execution-plan.md` with `orchestrator: bq-orchestrator` front matter, stop and suggest `/bq-orchestrator:enable-orchestrator`.

## 1. Pick the rows

From `$ARGUMENTS`:
- WS labels (`I`, `J K`) → those rows.
- Issue ids → the row containing them. If none does, ask whether to add a row first (propose WS label, seam, deps) — never launch something absent from the plan.
- `next` or empty → rows in `proposed` state whose dependencies are merged (or launched, when the plan says they can run in parallel), highest priority first. Show the pick and confirm.

For each picked row, refuse and explain if:
- it's already `🚧 launched` / `🔀 PR` / `✅ merged` (check `skein list --project <skein_project> --json` too — a live workspace on the issue means it's already running);
- a dependency hasn't landed and the plan doesn't say it can run in parallel — offer to launch anyway with the dependency named in the prompt;
- a Collisions bullet says it must run serially with an in-flight workspace.

## 2. Assign at start

For each issue id on the row, detect its tracker and assign it per trackers.md. Do this **before** creating the workspace. Failures don't block — collect them for the report.

## 3. Build the prompt

Assemble the four layers from workspace-prompt.md:
1. **Task** — fill the template from the row, the `Context` section, the row's `### <WS> — …` notes, the relevant Collisions bullets, and the live state of dependencies and neighbors. Fetch each issue's title (and a one-paragraph gist of its description) from its tracker so the prompt isn't just ids.
2. **Quality bar** — verbatim.
3. **Landing the work** — verbatim.
4. **Repo addendum** — first that exists, verbatim.

Write the result to `.orchestrator/prompts/<WS>.md` in this worktree (create the directory; it's untracked, like the plan). This is the record of exactly what the workspace was told.

Show the user the Task layer (the part that varies) for each workspace and proceed unless they object. Don't show the fixed layers again.

## 4. Create the workspace

```bash
skein new --project <skein_project> --issue '<primary id>' [--issue '<extra id>' ...] --prompt "$(cat .orchestrator/prompts/<WS>.md)"
```

- The first `--issue` is the primary (names the branch). Order the row's ids by priority.
- No ids → `--name "<WS> <short summary>"` instead of `--issue`.
- Stacked on an unmerged dependency → follow skein's stacking recipe (create the branch off the dependency's branch, `skein new --branch <new> --force`) and say "base your PR on <branch>" in the Task layer.
- On a collision or any error, follow `/skein:skein-new`'s recovery rules — relay the message; `--force` only for the archived-workspace and existing-branch cases. Never blindly re-run.

The prompt is staged **unsent** in the new workspace's terminal. Never claim the workspace has started working.

## 5. Update the plan

Set the row's State to `🚧 launched <date> · ws <id>` and add a `## Log` line. Launching several: do them one at a time, updating the plan after each, so a failure midway leaves an accurate plan.

## 6. Report

Per workspace: WS, issue(s), workspace id, assignment result, addendum used. Then: "Prompts are staged unsent — open each workspace in Skein and press Enter." Plus any manual follow-ups (failed assignments).
