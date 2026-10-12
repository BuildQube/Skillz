# Trackers

A plan can mix trackers. Resolve each issue id independently.

## Detecting the tracker for an id

First match wins:

| Id shape | Tracker |
|---|---|
| `github.com/.../issues/N` or `.../pull/N` URL, `owner/repo#N`, `#N` | github |
| `linear.app/...` URL | linear |
| `airtable.com/...` URL | airtable |
| matches front matter `airtable.issue_pattern` (e.g. `^O[0-9]{3,5}$`) | airtable |
| `TEAM-123` shape | linear (skein routes it to Airtable if the project has no Linear team — follow skein) |
| anything else | front matter `tracker` |
| no id (`—`) | none |

Pass every id to `skein new` as `--issue` in its original form; skein resolves all of these shapes itself. Quote `#N` (`'#412'`) — an unquoted `#` starts a shell comment.

## Assign at START

Assign the issue to the plan's assignee *before* launching the workspace, not at PR time — an unassigned in-progress issue is invisible in the views the team reads. Skip for `none`.

- **github** — `gh issue edit <N> --repo <owner/repo> --add-assignee "@me"` (or the front matter `assignee.github`).
- **linear** — use the Linear tools available in the session (Linear MCP `save_issue`, or the `linear` CLI) to set the assignee to `assignee.linear` (`me` = the authenticated user).
- **airtable** — use the Airtable tools available in the session (Airtable MCP): find the record in `airtable.base`/`airtable.table` whose `airtable.issue_id_field` equals the id (or use the record id from a URL), then set `airtable.assignee_field` to `assignee.airtable` (a collaborator id like `usr…`).

If the needed tool isn't available or the front matter lacks the assignee, don't block the launch: launch, and list "assign <id> manually" in your report.

## Reading status (for refresh)

- **github** — `gh issue view <N> --json state,assignees,title,url` (or `gh pr view` for PR refs).
- **linear** — the Linear tools' get-issue: state, assignee, cycle.
- **airtable** — the Airtable tools' get/search record: status, assignee, sprint.

Report what *moved* since the last refresh and any status that contradicts reality (issue "In Progress" but PR merged, "Done" but PR open, unassigned but launched). Many repos sync status from the PR title (e.g. an `(O####)` suffix read by a workflow) — if the addendum or repo docs say so, a mismatch usually means a malformed PR title.
