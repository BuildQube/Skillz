---
name: file
description: Use in an orchestrator workspace when the user wants to file one or more follow-up tickets — "file a ticket for that", "file the two deferred findings", "file a follow-up from K's review", "open an issue for this gap", "ticket this for later", "file it under workspace J". Drafts each ticket (problem, evidence, fix, tests, source) from the conversation, applies the domain's filing defaults and rules, checks for duplicates, creates it only after approval, and records it in execution-plan.md.
argument-hint: "[summary | \"from <PR/finding/WS>\" | several]"
---

# File

Turn follow-ups (deferred review findings, gaps found while scoping, decisions that need a later change) into tracker tickets, with the team's filing rules applied every time. References:
- Config (`file.*`, `airtable.issue_format`, `airtable.record_url`; front matter > domain file > defaults): `${CLAUDE_SKILL_DIR}/../../references/config.md`
- Trackers: `${CLAUDE_SKILL_DIR}/../../references/trackers.md`
- Plan format: `${CLAUDE_SKILL_DIR}/../../references/plan-format.md`

If there's no `execution-plan.md` with `orchestrator: bq-orchestrator` front matter, stop and suggest `/bq-orchestrator:enable-orchestrator`.

## 1. Gather

From `$ARGUMENTS` and the conversation, work out each ticket to file. One request often holds several (e.g. two deferred findings from one review); handle them as one batch. For each, collect:
- the problem in the user's words;
- the evidence: file:line, the PR, review comment or finding it came from (with links);
- the decision taken (what to change, and why it was deferred);
- the source: `PR #N`, `review of <WS>`, or `<WS>` scoping.

`from <PR/finding/WS>` points at that source: re-read the finding in `## Log`, the PR (`gh pr view`), or the row's notes. If a ticket's problem or fix is still unclear, ask before drafting it.

## 2. Draft

Resolve the tracker: `file.tracker`, else the plan's `tracker`. `none` → ask which tracker to use.

Per ticket, draft:
- **title**: short and specific;
- **type** and **priority**: values from `file.fields.type.values` / `file.fields.priority.values`;
- **size**: only when `file.fields.size` exists;
- **description**:

  ```markdown
  **Problem** — <what is wrong or missing, and its effect>
  **Evidence** — <file:line, PR/comment links>
  **Fix** — <the concrete change>
  **Tests** — <what proves it, a test that fails without the fix>
  From: <PR #N / review of WS / WS scoping>
  ```

Then build the tracker fields in this order (merge semantics in config.md):
1. `file.defaults`;
2. the draft's own values, mapped through `file.fields`;
3. `file.always`;
4. each `file.rules` entry whose `when` is true for this draft, in order. Judge `when` against the title, description and evidence; when unsure, don't apply it, and say so.

`always` and each matching `add` **union** into list fields and **override** scalars, so a later rule beats an earlier one. Assignment is skipped unless `file.assign` is true (then set `assignee.<tracker>` as in trackers.md).

## 3. Duplicate check

Before showing the drafts, search the tracker for open issues with similar titles or key terms (two or three searches per draft: the key noun phrase, the file or symbol, the error):
- **airtable**: Airtable MCP `search_records`, or `list_records` with a `filterByFormula` using `SEARCH()` on the title field, excluding done statuses;
- **github**: `gh issue list --state open --search "<terms> in:title,body" --json number,title,url`;
- **linear**: the Linear tools' issue search (`list_issues` with a query), open states only.

## 4. Show and wait

Show every draft in full: title, every field value, the description, then:
- `Rules:` one line per matching rule: `<when>` → `<what it added>` because `<why it matched>`. Also list rules you judged close but didn't apply.
- `Possible duplicates:` id, title and link, or "none found". For each, the choice is: **file anyway**, **skip**, or **add to existing** (comment the Evidence/Fix/Tests on that issue instead of filing).

Wait for approval or edits. **Never create without approval.** User edits override every field, rules included.

## 5. Create

Per approved ticket, one at a time:
- **airtable**: Airtable MCP `create_record` in `airtable.base` / `airtable.table` with the field map (link fields take lists of record ids). Read the record back (`get_record`) and build the id from `airtable.issue_format` (e.g. `"T{Ticket Number}"`, where `{Field}` is a field of the created record). Without `issue_format`, the id is the record id. The URL is `airtable.record_url` filled with `{base}`, `{table}` and `{record}`.
- **github**: `gh issue create --repo <owner/repo> --title … --body-file … ` plus `--label` per label, `--milestone`, `--project`, and `--assignee` when assigning. The id is `#N` (or `owner/repo#N` when it isn't this repo) and the URL is the one `gh` prints. Missing labels fail the create: report them and offer to retry without them, never create labels silently.
- **linear**: the Linear tools' create (MCP `save_issue`, or the `linear` CLI) with team, project, labels, priority, estimate and state from the field map. Linear returns the id (`ENG-42`) and URL.
- **add to existing**: comment on that issue (`gh issue comment`, Linear `save_comment`, Airtable `create_comment`) and record its id instead.

A failure doesn't stop the batch: collect it for the report.

## 6. Record in the plan

Per ticket filed or added to:
- By default, add a row to `## Backlog`: the id linked to its URL, a short summary, priority/size, and where it came from. If `## Backlog` already has a table, add the row in that table's columns: map those values onto the closest columns and put whatever doesn't fit in a notes-like column. Use the four-column layout from plan-format.md only when there's no table yet. Never rewrite the existing table.
- If the user says it belongs to a workspace row, add the id to that row's Issues and a line to its `### <WS>` notes instead. When that row is already launched, offer to tell the workspace with `/bq-orchestrator:message`.
- Add one `## Log` line per batch: `<date> — filed T5401, T5402 (from review of K, PR #380)`.

## 7. Report

Per ticket: id, URL, fields set (and which rule set each), and where it was recorded. Then anything that failed or was skipped: create errors, fields the tracker rejected, drafts the user skipped.
