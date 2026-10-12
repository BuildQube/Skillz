#!/usr/bin/env bash
# Create the <plugin>:patch|minor|major PR labels the version-bump workflow reads.
# Usage: scripts/plugin-labels.sh <plugin-name>   (requires gh, authenticated with push access)
set -euo pipefail
name="${1:?usage: $0 <plugin-name>}"

create() {
  if gh label create "$name:$1" --color "$2" --description "Auto-bump $name with a $1 version on merge" >/dev/null 2>&1; then
    echo "created  $name:$1"
  else
    echo "exists   $name:$1 (or could not be created)"
  fi
}
create patch 0e8a16
create minor fbca04
create major d93f0b
