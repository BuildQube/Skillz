#!/usr/bin/env bash
# Scaffold a new plugin from templates/plugin and register it in marketplace.json.
# Usage: scripts/new-plugin.sh <plugin-name> "<description>" [category]
set -euo pipefail

name="${1:-}"; desc="${2:-}"; category="${3:-development}"
if [[ -z "$name" || -z "$desc" ]]; then
  echo "usage: $0 <plugin-name> \"<description>\" [category]" >&2; exit 1
fi
if [[ ! "$name" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]]; then
  echo "plugin name must be kebab-case: $name" >&2; exit 1
fi

root="$(cd "$(dirname "$0")/.." && pwd)"
dest="$root/plugins/$name"
manifest="$root/.claude-plugin/marketplace.json"

[[ -e "$dest" ]] && { echo "already exists: plugins/$name" >&2; exit 1; }
jq -e --arg n "$name" '.plugins[] | select(.name == $n)' "$manifest" >/dev/null \
  && { echo "already in marketplace.json: $name" >&2; exit 1; }

cp -R "$root/templates/plugin" "$dest"
# Escape for sed replacement: backslash, ampersand, and the | delimiter.
esc_desc=$(printf '%s' "$desc" | sed 's/[\\&|]/\\&/g')
find "$dest" -type f ! -name plugin.json -exec sed -i.bak -e "s|__PLUGIN_NAME__|$name|g" -e "s|__PLUGIN_DESCRIPTION__|$esc_desc|g" {} + 
find "$dest" -name '*.bak' -delete
# Set JSON fields with jq so quotes in the description stay valid JSON.
tmp=$(mktemp)
jq --arg n "$name" --arg d "$desc" '.name = $n | .description = $d' "$dest/.claude-plugin/plugin.json" > "$tmp" \
  && mv "$tmp" "$dest/.claude-plugin/plugin.json"


tmp=$(mktemp)
jq --arg n "$name" --arg d "$desc" --arg c "$category" \
  '.plugins += [{name: $n, source: ("./plugins/" + $n), description: $d, version: "0.1.0",
                 author: {name: "BuildQube"}, category: $c, tags: []}]' \
  "$manifest" > "$tmp" && mv "$tmp" "$manifest"

echo "Created plugins/$name and registered it in marketplace.json."

if command -v gh >/dev/null && gh auth status >/dev/null 2>&1; then
  "$root/scripts/plugin-labels.sh" "$name"
else
  echo "gh not available — run scripts/plugin-labels.sh $name later to create its version-bump PR labels."
fi
echo "Next: edit the template components, delete the ones you don't need, then run scripts/validate.sh"
