#!/usr/bin/env bash
# Report CI status for a PR's head commit, distinguishing pending from passing.
# Usage: ci-status.sh [PR_NUMBER] [--logs] [--watch]
#   --logs   print failed-step logs per failing job (last $LOG_LINES lines each, default 120)
#   --watch  block until every check has concluded, then report
# Exit code: 0 all green, 1 something failed, 3 still pending.
set -euo pipefail

pr=""; logs=false; watch=false
for a in "$@"; do
  case "$a" in
    --logs) logs=true ;;
    --watch) watch=true ;;
    *) pr="$a" ;;
  esac
done

if $watch; then
  # shellcheck disable=SC2086
  gh pr checks $pr --watch --fail-fast=false >/dev/null 2>&1 || true
fi

# shellcheck disable=SC2086
checks=$(gh pr checks $pr --json name,bucket,workflow,link,description 2>/dev/null || true)
if [[ -z "$checks" || "$checks" == "[]" ]]; then
  echo "verdict: none — no checks reported for this PR"; exit 0
fi

jq -r '
  group_by(.bucket) | map("\(.[0].bucket): \(length)") | join("  ")' <<<"$checks"
echo

jq -r '.[] | select(.bucket == "fail" or .bucket == "pending" or .bucket == "cancel")
       | "\(.bucket | ascii_upcase)\t\(.workflow // "-") / \(.name)\t\(.link)"' <<<"$checks"

fail=$(jq '[.[] | select(.bucket == "fail")] | length' <<<"$checks")
cancel=$(jq '[.[] | select(.bucket == "cancel")] | length' <<<"$checks")
pending=$(jq '[.[] | select(.bucket == "pending")] | length' <<<"$checks")

if $logs && [[ "$fail" -gt 0 ]]; then
  # One section per failing job (a matrix run has many), with gh's "job<TAB>step<TAB>timestamp" prefix stripped.
  jq -r '.[] | select(.bucket == "fail") | [.name, (.link | capture("/job/(?<id>[0-9]+)").id // "")] | @tsv' <<<"$checks" 2>/dev/null \
  | while IFS=$'\t' read -r name job; do
      echo; echo "===== failed: $name ====="
      if [[ -z "$job" ]]; then echo "(not a GitHub Actions job — open the check link)"; continue; fi
      gh run view --job "$job" --log-failed 2>/dev/null \
        | sed -E -e $'s/^[^\t]*\t[^\t]*\t//' -e 's/^(\xEF\xBB\xBF)?[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z ?//' \
        | awk -v n="${LOG_LINES:-120}" '
            # Show the n lines ending at the last ##[error] (skips post-job cleanup noise); plain tail if none.
            { l[NR] = $0; if ($0 ~ /##\[error\]/) e = NR }
            END { last = e ? e : NR; for (i = (last - n + 1 > 1 ? last - n + 1 : 1); i <= last; i++) print l[i] }' \
        || echo "(no logs available — logs may have expired)"
    done
fi

echo
if [[ "$fail" -gt 0 || "$cancel" -gt 0 ]]; then
  extra=""
  [[ "$cancel" -gt 0 ]] && extra+=", $cancel cancelled"
  [[ "$pending" -gt 0 ]] && extra+=", $pending still pending"
  echo "verdict: FAILING — $fail check(s) failed$extra"; exit 1
elif [[ "$pending" -gt 0 ]]; then
  echo "verdict: PENDING — $pending check(s) still running; nothing red so far, which is NOT the same as green"; exit 3
else
  echo "verdict: GREEN — every check concluded successfully"; exit 0
fi
