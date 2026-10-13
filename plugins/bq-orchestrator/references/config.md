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
  issue_format: "T{Ticket Number}"    # optional: builds a created record's human id; {Field} reads that field (the inverse of issue_lookup)
  record_url: "https://airtable.com/{base}/{table}/{record}"   # link to a record, used in the plan and reports
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

file:                               # how /bq-orchestrator:file creates tickets
  tracker: airtable                 # default: the plan's tracker
  assign: false                     # default false: assignment happens at launch (assign at START)
  defaults:                         # field → value on every ticket (tracker-native field names)
    Status: Backlog
  always:                           # added to every ticket; list fields are UNIONED, not replaced
    Epics: [recEPIC1]
  rules:                            # plain-English `when`, judged by the skill against the draft
    - when: the ticket affects the mobile app
      add: { Epics: [recEPIC2] }
    - when: it is a security or data-loss bug
      add: { Priority: P0 }
  fields:                           # how the draft maps onto this tracker's fields
    title: Name
    description: Description
    type: { field: Type, values: [Bug, Task, Feature] }
    priority: { field: Priority, values: [P0, P1, P2, P3] }
    size: { field: Size, values: ["1", "2", "3", "5", "8"] }   # omit when the tracker has none
```

Unknown keys are kept and ignored. Later skills add their own top-level section without moving any of these keys.

## Defaults

| Key | Default |
|---|---|
| `tracker` | ask at `enable-orchestrator` |
| `base_branch` | the repo's default branch |
| `<tracker>.on_launch` | `{}`, so only the assignee is set |
| `airtable.issue_lookup` | absent: match `issue_id_field` equal to the id |
| `airtable.issue_format` | absent: a filed record's id is its record id (`rec…`) |
| `airtable.record_url` | `https://airtable.com/{base}/{table}/{record}` |
| `launch.submit` | `false`, so prompts are staged unsent |
| `review.correctness_agent` | `/code-review` |
| `review.findings` | `ask` |
| `review.expected_reviewers` | `[]` |
| `file.tracker` | the plan's `tracker` |
| `file.assign` | `false` |
| `file.defaults`, `file.always` | `{}` |
| `file.rules` | `[]` |
| `file.fields` | absent: ask for the field names on first use, and suggest saving them to the domain file |

## Keys in detail

- **`<tracker>.on_launch`**: see "Assign at START" in trackers.md. A sprint or cycle can move after launch (re-planning, carry-over). `refresh` reports one that differs from the plan's as information and never changes it back.
- **`airtable.issue_pattern` / `issue_lookup`**: see "Finding a record" in trackers.md.
- **`launch.submit`**: `true` makes `launch` (and `handoff`'s successor suggestion) pass `--submit` to `skein new`, so the prompt is sent once claude is ready in the workspace instead of being staged unsent. If skein doesn't detect claude's prompt, it stays staged. Needs skein ≥ 0.6.0.
- **`review.correctness_agent`**: the bug-hunting pass in `review`. `/code-review` is the built-in skill. Any other value is an agent type run with the Agent tool. `review` gives it the plan row, the plan's Context and the previous round's findings.
- **`review.findings`**: `ask` shows you the ranked findings and a recommended fix list and sends only what you approve. `auto` sends blocking and non-blocking findings to the workspace without asking.
- **`review.expected_reviewers`**: after checks finish, `review` warns when one of these logins posted nothing on the PR's head commit. That catches a review bot that silently skipped a PR.
- **`airtable.issue_format`**: after `file` creates a record, it reads the record back and fills this template. `{Field}` is that field's value on the created record, so `"T{Ticket Number}"` turns autonumber `5174` into `T5174`. Without it, the id is the record id. Keep it consistent with `issue_pattern` so `launch` and `refresh` can find the ticket again.
- **`airtable.record_url`**: the link written to the plan and reports. `{base}`, `{table}` and `{record}` are `airtable.base`, `airtable.table` and the record id.

### `file`

- **`file.tracker`**: where `file` creates tickets. Defaults to the plan's `tracker`.
- **`file.assign`**: `true` assigns each new ticket to `assignee.<tracker>` on creation. Leave it `false` when tickets are assigned at launch (see "Assign at START" in trackers.md).
- **`file.defaults`**: tracker field → value, set on every ticket unless the draft or a rule sets that field.
- **`file.always`**: tracker field → value, added to every ticket.
- **`file.rules`**: a list of `{ when, add }`. `when` is plain English. `file` judges it against each draft and shows, per draft, which rules matched and why, so a wrong judgment is easy to catch. `add` is a field → value map, like `always`.
- **`file.fields`**: maps the draft (`title`, `description`, `type`, `priority`, `size`) onto the tracker. A plain string is the field name. A map has `field`, optional `values` (the allowed values, which the skill picks from) and optional `prefix` (prepended to the value). `field: label` adds the value to the ticket's labels instead of setting a field. Omit `size` when the tracker has no size field.

**How a ticket's fields merge.** Across layers, `file:` merges like every other key: plan > domain > defaults, maps key by key, and a list (including `rules` and a list value inside `always`) replaced whole by the higher layer. Inside one ticket, the fields are built in this order:

1. `file.defaults`;
2. the draft's own values (title, type, priority, size, description), through `file.fields`;
3. `file.always`;
4. each matching rule's `add`, in list order.

In steps 3 and 4, list fields are **unioned** with what's already there (duplicates dropped) and scalars are **overridden**, so a later rule wins over an earlier one for the same scalar. The user's edits at approval override everything.

**GitHub.** Title and description are the issue's own; `fields` maps the rest onto labels, milestone and project. Type and priority are usually labels:

```yaml
file:
  tracker: github
  defaults:
    milestone: Backlog
  always:
    labels: [follow-up]
  rules:
    - when: the ticket affects the mobile app
      add: { labels: [mobile] }
  fields:
    type: { field: label, values: [bug, task, feature] }
    priority: { field: label, prefix: "priority:", values: [p0, p1, p2, p3] }
    size: { field: label, prefix: "size:", values: [s, m, l] }
```

Field names are `labels` (a list), `milestone` and `project`, which become `gh issue create` flags.

**Linear.** Title and description are the issue's own; `fields` maps the rest onto team, project, labels, priority, estimate and state:

```yaml
file:
  tracker: linear
  defaults:
    team: ENG
    state: Backlog
  always:
    labels: [follow-up]
  rules:
    - when: the ticket affects the mobile app
      add: { project: Mobile App }
  fields:
    type: { field: label, values: [Bug, Improvement, Feature] }
    priority: { field: priority, values: [Urgent, High, Medium, Low] }
    size: { field: estimate, values: [1, 2, 3, 5, 8] }
```
