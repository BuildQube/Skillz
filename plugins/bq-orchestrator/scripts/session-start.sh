#!/usr/bin/env bash
# SessionStart hook: if this worktree holds an orchestrator plan, re-inject the orchestrator role.
plan="${CLAUDE_PROJECT_DIR:-$PWD}/execution-plan.md"
[[ -f "$plan" ]] || exit 0
# Only plans enabled by this plugin (front matter `orchestrator: bq-orchestrator`, not superseded/done).
head -n 40 "$plan" | grep -q '^orchestrator: *bq-orchestrator' || exit 0
head -n 40 "$plan" | grep -Eq '^status: *(superseded|done)' && exit 0

role="$(cat "${CLAUDE_PLUGIN_ROOT}/references/orchestrator-role.md")"
jq -n --arg ctx "$role

Read execution-plan.md before acting on any request in this session." \
  '{hookSpecificOutput: {hookEventName: "SessionStart", additionalContext: $ctx}}'
