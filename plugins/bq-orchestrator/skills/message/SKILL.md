---
name: message
description: Use in an orchestrator workspace when the user wants to tell a launched workspace something — "send this to I", "tell J about the bug we found", "let K know M merged and it should rebase", "pass this finding to the workspace on O5326", "tell everyone touching the action bar …". Resolves plan workspaces to their live Claude sessions and delivers the message; falls back to paste-ready text when no session is live. Also used by review to deliver findings.
argument-hint: "<WS label(s) | issue id | all-in-flight | seam> <message>"
---

# Message

Deliver a message from this orchestrator to the Claude session running inside a launched workspace. Plan format: `${CLAUDE_SKILL_DIR}/../../references/plan-format.md`.

Delivery uses Claude Code's local session messaging: **ListAgents** (lists peer sessions on this machine) and **SendMessage** (`to` = a peer's name). If they're deferred tools, load both with one ToolSearch (`select:ListAgents,SendMessage`).

## 1. Resolve recipients

From `$ARGUMENTS`, the targets are one of:
- WS labels (`I`, `J K`) or issue ids → those plan rows;
- `all-in-flight` → every row in launched or PR state;
- a seam or file ("everyone touching the WO action bar") → rows whose Seam, notes, or Collisions bullets match. Show the resolved list before sending.

For each row, find its session:
1. Workspace id from the row's State (`ws <id>`), else match the row's issue id against `skein list --project <skein_project> --json` (`linked_issue`).
2. `skein status <id> --json` → the worktree path. Its basename is the worktree name.
3. **ListAgents** → the peer session whose name is `<worktree name>` or starts with `<worktree name>-`. Several matches → prefer one that isn't idle, else the most recently started, and say which you chose. Never pick this session (it's the orchestrator).

A row that's `proposed` has no workspace — say so and suggest adding the note to its `### <WS>` section so `launch` carries it.

## 2. Compose

The user's words are often terse ("tell I the formHref helper should live in `@aldoa/forms`"). Expand to a self-contained message the implementer can act on without this conversation:

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
