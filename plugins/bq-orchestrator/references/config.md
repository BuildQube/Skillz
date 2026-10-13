# Configuration

Every setting can live in three places. When the skills read a setting, the highest one wins:

1. **Plan front matter** in `execution-plan.md`. It holds per-plan values, such as this sprint's id.
2. **Domain file** at `~/.claude/bq-orchestrator/<domain>.yml`. It holds per-team values that every plan in that domain shares: tracker base and fields, assignee ids, review setup.
3. **Plugin defaults**, listed below.

`<domain>` is the `domain` that `skein projects --json` reports for the plan's `skein_project`, used verbatim (e.g. `Acme` → `~/.claude/bq-orchestrator/Acme.yml`). A missing file is fine. The skill then uses only the front matter and the defaults.

**Merging:** maps merge key by key, at every depth. Any other value, a list included, is replaced whole by the higher layer. So a plan can set `airtable.on_launch.Sprint` and still inherit `airtable.on_launch.Status` from the domain file.

`enable-orchestrator` seeds a new plan's front matter from the domain file, so the plan records the values it started with. The domain file is still read at runtime for any key the plan leaves out.

The prompt addendum (`~/.claude/bq-orchestrator/<repo>.md`) is a separate per-repo file. It's described in workspace-prompt.md and is unaffected by this file.

## Schema

The domain file and the plan front matter share one schema. The keys that only make sense per plan (`title`, `started`, `status`, `predecessor`, `successor`, `skein_project`, `deadline`) belong in the front matter only. See plan-format.md.

```yaml
tracker: none                 # default tracker for ids that don't self-identify: airtable | github | linear | none
base_branch: main

assignee:                     # who to assign at START (trackers.md)
  airtable: usrXXXXXXXXXXXXXX # collaborator id
  github: "@me"
  linear: me                  # me = the authenticated user

airtable:
  base: appXXXXXXXXXXXXXX
  table: tblXXXXXXXXXXXXXX
  assignee_field: Assignee
  issue_id_field: Issue ID    # the field holding the human id, compared for equality when issue_lookup is absent
  issue_pattern: "^T([0-9]{3,5})$"   # ids matching this are Airtable ids; capture groups feed issue_lookup
  issue_lookup: "{Ticket Number}={1}" # optional filterByFormula template; {1}, {2}… are capture groups
  on_launch:                  # fields set together with the assignee at START (field name → value)
    Status: In Progress
    # Sprint: [recXXXXXXXXXXXXXX]   # usually in the plan, since it changes each sprint

github:
  on_launch:
    labels: [in-progress]
    # milestone: "Sprint 12"        # usually in the plan

linear:
  on_launch:
    state: In Progress
    # cycle: <cycle id or number>   # usually in the plan

launch:
  submit: false                     # true passes --submit to skein new (needs skein >= 0.6.0)

review:
  correctness_agent: /code-review   # or an agent type, e.g. some-plugin:some-reviewer
  findings: ask                     # ask | auto
  expected_reviewers: []            # logins that must post on each PR's head commit, e.g. [claude]
```

Unknown keys are kept and ignored. Later skills add their own top-level section (a ticket-filing skill would add `file:`) without moving any of these keys.

## Defaults

| Key | Default |
|---|---|
| `tracker` | ask at `enable-orchestrator` |
| `base_branch` | the repo's default branch |
| `<tracker>.on_launch` | `{}`, so only the assignee is set |
| `airtable.issue_lookup` | absent: match `issue_id_field` equal to the id |
| `launch.submit` | `false`, so prompts are staged unsent |
| `review.correctness_agent` | `/code-review` |
| `review.findings` | `ask` |
| `review.expected_reviewers` | `[]` |

## Keys in detail

- **`<tracker>.on_launch`**: see "Assign at START" in trackers.md. A sprint or cycle can move after launch (re-planning, carry-over). `refresh` reports one that differs from the plan's as information and never changes it back.
- **`airtable.issue_pattern` / `issue_lookup`**: see "Finding a record" in trackers.md.
- **`launch.submit`**: `true` makes `launch` (and `handoff`'s successor suggestion) pass `--submit` to `skein new`, so the prompt is sent once claude is ready in the workspace instead of being staged unsent. If skein doesn't detect claude's prompt, it stays staged. Needs skein ≥ 0.6.0.
- **`review.correctness_agent`**: the bug-hunting pass in `review`. `/code-review` is the built-in skill. Any other value is an agent type run with the Agent tool. `review` gives it the plan row, the plan's Context and the previous round's findings.
- **`review.findings`**: `ask` shows you the ranked findings and a recommended fix list and sends only what you approve. `auto` sends blocking and non-blocking findings to the workspace without asking.
- **`review.expected_reviewers`**: after checks finish, `review` warns when one of these logins posted nothing on the PR's head commit. That catches a review bot that silently skipped a PR.
