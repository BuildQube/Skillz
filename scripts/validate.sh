#!/usr/bin/env bash
# Validate the marketplace and every plugin, and check marketplace.json stays in sync with plugin.json.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
manifest="$root/.claude-plugin/marketplace.json"
fail=0

claude plugin validate "$root" || fail=1

while IFS=$'\t' read -r name source version; do
  dir="$root/${source#./}"
  pj="$dir/.claude-plugin/plugin.json"
  if [[ ! -f "$pj" ]]; then echo "✗ $name: missing $source/.claude-plugin/plugin.json"; fail=1; continue; fi
  claude plugin validate "$dir" || fail=1
  pj_name=$(jq -r .name "$pj"); pj_version=$(jq -r .version "$pj")
  [[ "$pj_name" == "$name" ]] || { echo "✗ $name: plugin.json name is '$pj_name'"; fail=1; }
  [[ "$pj_version" == "$version" ]] || { echo "✗ $name: version mismatch (marketplace $version, plugin.json $pj_version)"; fail=1; }
done < <(jq -r '.plugins[] | [.name, .source, .version] | @tsv' "$manifest")

# Plugins on disk that aren't registered
for d in "$root"/plugins/*/; do
  n=$(basename "$d")
  jq -e --arg n "$n" '.plugins[] | select(.name == $n)' "$manifest" >/dev/null \
    || { echo "✗ plugins/$n is not listed in marketplace.json"; fail=1; }
done

[[ $fail -eq 0 ]] && echo "✓ marketplace valid" || exit 1
