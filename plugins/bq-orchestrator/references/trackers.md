# Trackers

A plan can mix trackers. Resolve each issue id independently.

The settings named here (`tracker`, `assignee`, `airtable.*`, `<tracker>.on_launch`) are read from plan front matter > domain file > defaults. See [config.md](config.md).

## Detecting the tracker for an id

First match wins:

| Id shape | Tracker |
|---|---|
| `github.com/.../issues/N` or `.../pull/N` URL, `owner/repo#N`, `#N` | github |
| `linear.app/...` URL | linear |
| `airtable.com/...` URL | airtable |
| matches `airtable.issue_pattern` (e.g. `^T[0-9]{3,5}$`) | airtable |
| `TEAM-123` shape | linear (skein routes it to Airtable if the project has no Linear team — follow skein) |
| anything else | front matter `tracker` |
| no id (`—`) | none |

Pass every id to `skein new` as `--issue` in its original form; skein resolves all of these shapes itself. Quote `#N` (`'#412'`) — an unquoted `#` starts a shell comment.

## Finding an Airtable record

Use the record id directly when the id is an Airtable URL. Otherwise:

- **With `airtable.issue_lookup`**, match the id against `airtable.issue_pattern`. Substitute each capture group into the template (`{1}` is group 1, `{2}` group 2, and so on; any other `{Name}` is an Airtable field reference and stays as it is). Then list records with that `filterByFormula`. Use this when the base stores the human id in a different form, or when search can't find it.
  - Example: a base stores `T5174` as the number `5174` in a `Ticket Number` field. With `issue_pattern: "^T([0-9]{3,5})$"` and `issue_lookup: "{Ticket Number}={1}"`, `T5174` becomes the formula `{Ticket Number}=5174`.
- **Without it**, find the record whose `airtable.issue_id_field` equals the id.

Zero or several matches → don't guess. Report the id as "not found" or "ambiguous".

## Assign at START

Assign the issue to the plan's assignee *before* launching the workspace, not at PR time — an unassigned in-progress issue is invisible in the views the team reads. In the same update, set the fields in that tracker's `on_launch` map. Skip for `none`.

- **github** — `gh issue edit <N> --repo <owner/repo> --add-assignee "@me"` (or `assignee.github`). `github.on_launch` adds `--add-label <l>` for each of `labels` and `--milestone <m>` for `milestone`.
- **linear** — use the Linear tools available in the session (Linear MCP `save_issue`, or the `linear` CLI) to set the assignee to `assignee.linear` (`me` = the authenticated user), plus `linear.on_launch` (`state`, `cycle`, …) in the same save.
- **airtable** — use the Airtable tools available in the session (Airtable MCP). Find the record as above, then set `airtable.assignee_field` to `assignee.airtable` (a collaborator id like `usr…`) and each `airtable.on_launch` entry (field name → value; link fields take a list of record ids) in one update.

Sprint and cycle ids change every sprint, so they normally live in the plan's front matter. Steady fields such as a status go in the domain file.

If the needed tool isn't available, or there's no assignee configured, don't block the launch: launch, and list "assign <id> manually" (and any `on_launch` fields not set) in your report.

## Reading status (for refresh)

- **github** — `gh issue view <N> --json state,assignees,title,url` (or `gh pr view` for PR refs).
- **linear** — the Linear tools' get-issue: state, assignee, cycle.
- **airtable** — the Airtable tools' get record (found as above): status, assignee, sprint.

**A sprint or cycle can legitimately move after launch.** When an issue's sprint, cycle or milestone differs from the plan's `on_launch` value, report it as information ("T5330 is now in Sprint 13"). Never set it back.

Report what *moved* since the last refresh and any status that contradicts reality (issue "In Progress" but PR merged, "Done" but PR open, unassigned but launched). Many repos sync status from the PR title (e.g. a `(T####)` suffix read by a workflow) — if the addendum or repo docs say so, a mismatch usually means a malformed PR title.
