#!/usr/bin/env bash
# Fetch all review feedback for a PR as one compact JSON document.
# Usage: pr-feedback.sh [PR_NUMBER] [--all]
#   PR_NUMBER  defaults to the PR for the current branch
#   --all      include resolved threads (default: only unresolved, with a count of the rest)
# Output: { pr, me, threads[], reviews[], comments[], resolvedThreadCount, truncated }
set -euo pipefail

pr=""; all=false
for a in "$@"; do
  case "$a" in
    --all) all=true ;;
    *) pr="$a" ;;
  esac
done

# shellcheck disable=SC2086
meta=$(gh pr view $pr --json number,url,headRefName,headRefOid,baseRefName,reviewDecision,isDraft,state 2>/dev/null) \
  || { if [[ -n "$pr" ]]; then echo "Pull request #$pr not found in this repo." >&2; else echo "No pull request for the current branch." >&2; fi; exit 2; }
num=$(jq -r .number <<<"$meta")
owner=$(gh repo view --json owner --jq .owner.login)
repo=$(gh repo view --json name --jq .name)
me=$(gh api user --jq .login)

raw=$(gh api graphql -F owner="$owner" -F repo="$repo" -F num="$num" -f query='
  query($owner:String!, $repo:String!, $num:Int!) {
    repository(owner:$owner, name:$repo) {
      pullRequest(number:$num) {
        reviewThreads(first:100) {
          pageInfo { hasNextPage }
          nodes {
            id isResolved isOutdated path line
            comments(first:50) {
              nodes { databaseId author { __typename login } body createdAt }
            }
          }
        }
        reviews(last:50) {
          nodes { author { __typename login } state body submittedAt }
        }
        comments(last:50) {
          nodes { databaseId author { __typename login } body createdAt }
        }
      }
    }
  }')

jq --argjson meta "$meta" --arg owner "$owner" --arg repo "$repo" --arg me "$me" --argjson all "$all" '
  def who: { login: (.author.login // "ghost"), isBot: ((.author.__typename // "") == "Bot" or ((.author.login // "") | test("\\[bot\\]$"))) };
  .data.repository.pullRequest as $p
  | ($p.reviewThreads.nodes) as $threads
  | {
      pr: ($meta + { owner: $owner, repo: $repo }),
      me: $me,
      resolvedThreadCount: ([$threads[] | select(.isResolved)] | length),
      truncated: $p.reviewThreads.pageInfo.hasNextPage,
      threads: [
        $threads[] | select($all or (.isResolved | not)) | {
          threadId: .id, isResolved, isOutdated, path, line,
          firstCommentId: .comments.nodes[0].databaseId,
          lastAuthor: (.comments.nodes[-1].author.login // "ghost"),
          lastAuthorIsMe: ((.comments.nodes[-1].author.login // "") == $me),
          allBots: ([.comments.nodes[] | who | .isBot] | all),
          comments: [ .comments.nodes[] | who + { id: .databaseId, body, createdAt } ]
        }
      ],
      reviews: [ $p.reviews.nodes[] | select((.body // "") != "" or .state == "CHANGES_REQUESTED")
                 | who + { state, body, submittedAt } ],
      comments: [ $p.comments.nodes[] | who + { id: .databaseId, body, createdAt } ]
    }' <<<"$raw"
