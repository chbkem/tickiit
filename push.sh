#!/usr/bin/env bash
set -euo pipefail

REMOTE="origin"
MESSAGE="${1:-Update from local}"
BRANCH="$(git branch --show-current)"

if [ -z "${BRANCH}" ]; then
  echo "error: not on a branch" >&2
  exit 1
fi

git add -A

if git diff --cached --quiet; then
  echo "Nothing new to commit."
else
  git commit -m "${MESSAGE}"
fi

git push "${REMOTE}" "${BRANCH}"
echo "Pushed \"${BRANCH}\" to \"${REMOTE}\"."