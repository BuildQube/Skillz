#!/usr/bin/env bash
# Reply inline on a review thread and (by default) resolve it.
# Usage: reply-resolve.sh <pr-number> <comment-id> <thread-id> <body> [--no-resolve]
#   comment-id  numeric databaseId of any comment in the thread (use firstCommentId from pr-feedback.sh)
#   thread-id   GraphQL node id of the thread (threadId from pr-feedback.sh)
set -euo pipefail

[[ $# -ge 4 ]] || { echo "usage: $0 <pr-number> <comment-id> <thread-id> <body> [--no-resolve]" >&2; exit 1; }
pr="$1"; comment="$2"; thread="$3"; body="$4"; resolve=true
[[ "${5:-}" == "--no-resolve" ]] && resolve=false

url=$(gh api -X POST "repos/{owner}/{repo}/pulls/$pr/comments/$comment/replies" -f body="$body" --jq .html_url)
echo "replied: $url"

if $resolve; then
  gh api graphql -f threadId="$thread" -f query='
    mutation($threadId: ID!) {
      resolveReviewThread(input: {threadId: $threadId}) { thread { isResolved } }
    }' --jq '"resolved: \(.data.resolveReviewThread.thread.isResolved)"'
fi
