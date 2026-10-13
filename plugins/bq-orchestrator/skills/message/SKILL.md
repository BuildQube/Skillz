---
name: message
description: Use in an orchestrator workspace when the user wants to tell a launched workspace something — "send this to I", "tell J about the bug we found", "let K know M merged and it should rebase", "pass this finding to the workspace on T5326", "tell everyone touching the action bar …". Resolves plan workspaces to their live Claude sessions and delivers the message; falls back to paste-ready text when no session is live. Also used by review to deliver findings.
argument-hint: "<WS label(s) | issue id | all-in-flight | seam> <message>"
---

# Message

Deliver a message from this orchestrator to the Claude session running inside a launched workspace. Plan format: `${CLAUDE_SKILL_DIR}/../../references/plan-format.md`.

Delivery uses Claude Code's local session messaging: **ListAgents** (lists peer sessions on this machine) and **SendMessage** (`to` = a peer's name). If they're deferred tools, load both with one ToolSearch (`select:ListAgents,SendMessage`).

## 1. Resolve recipients

From `$ARGUMENTS`, the targets are one of:
- WS labels (`I`, `J K`) or issue ids → those plan rows;
- `all-in-flight` → every row in launched or PR state;
- a seam or file ("everyone touching the checkout action bar") → rows whose Seam, notes, or Collisions bullets match. Show the resolved list before sending.

For each row, find its session:
1. **Recorded session.** If the row's State has `· session <name>` and **ListAgents** still lists that name, use it and skip the rest.
2. Workspace id from the row's State (`ws <id>`), else match the row's issue id against `skein list --project <skein_project> --json` (`linked_issue`).
3. `skein status <id> --json` gives the worktree path. Its basename is the worktree name.
4. **ListAgents**, then match. Claude Code truncates long worktree names and appends a 2-hex suffix (worktree `ab-123-offline-outbox-replay-under-load`, session `ab-123-offline-outbox-replay-u-9e`). So strip one trailing `-[0-9a-f]{2}` from each session name. A session matches when its stripped name equals the worktree name or is a prefix of it — never the reverse: a stem longer than the worktree name (`json-composite-types-v2` for worktree `json-composite-types`) belongs to a different worktree. A stem much shorter than the worktree name is suspicious; ask before sending. Never pick this session (it's the orchestrator).
   - One match → use it.
   - Several matches → don't guess. Ask the user which one, listing each name and whether it's idle.

After the first successful send to a row, append `· session <name>` to its State (replacing an older one) so the next send goes straight there.

A row that's `proposed` has no workspace — say so and suggest adding the note to its `### <WS>` section so `launch` carries it.

## 2. Compose

The user's words are often terse ("tell I the cartUrl helper should live in the shared utils package"). Expand to a self-contained message the implementer can act on without this conversation:

```
From the orchestrator (<orchestrator session name>) — plan "<title>", workspace <WS>:

<the message: the finding/decision, the evidence (file:line, PR comment link, failing check, ticket), and what you want done>

Reply with SendMessage to <orchestrator session name>: what you changed (with commit SHA) or why not.
```

Rules:
- Keep the user's intent and any exact wording they gave. Add evidence and context; don't add new asks.
- One message per workspace. For a broadcast, the same core text, each addressed to its workspace.
- Never include secrets or tokens.

## 3. Send

**SendMessage** to each resolved session. If no live session matches (workspace closed, or `claude` isn't running in it), don't fail silently: print the composed message as paste-ready text, labeled with the workspace name/id, and say "no live session — paste this when you open the workspace".

## 4. Record

Add a `## Log` line per send: `- <date> → <WS>: <one-line gist> (delivered | not delivered — no live session)`. Replies arrive later as messages into this session; when one does, log the outcome too, and update the row's State if it changed.

## 5. Report

Per recipient: delivered to `<session>` / not delivered (with the paste-ready text). One line each.
