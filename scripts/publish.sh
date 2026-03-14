#!/usr/bin/env bash

set -euo pipefail

if [ $# -lt 1 ]; then
  echo 'Usage: ./scripts/publish.sh "your commit message"'
  exit 1
fi

MESSAGE="$1"

if [ -z "$(git status --porcelain)" ]; then
  echo "No changes to publish."
  exit 0
fi

git add .
git commit -m "$MESSAGE"
git push origin main

echo "Published to origin/main."
