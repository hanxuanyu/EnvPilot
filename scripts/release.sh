#!/usr/bin/env bash

set -euo pipefail

usage() {
  echo "Usage: ./scripts/release.sh <tag>"
  echo "Example: ./scripts/release.sh v0.0.1"
}

if [[ $# -ne 1 ]]; then
  usage
  exit 1
fi

tag_name="$1"

if [[ ! "$tag_name" =~ ^v[0-9]+\.[0-9]+\.[0-9]+([-.][0-9A-Za-z.-]+)?$ ]]; then
  echo "Invalid tag: $tag_name"
  echo "Tag must start with 'v', for example: v0.0.1"
  exit 1
fi

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "Current directory is not a git repository"
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is not clean. Commit or stash changes before creating a release tag."
  exit 1
fi

if git show-ref --verify --quiet "refs/tags/$tag_name"; then
  echo "Local tag already exists, deleting and recreating: $tag_name"
  git tag -d "$tag_name"
fi

remote_tag_exists=false
if git ls-remote --tags origin "refs/tags/$tag_name" | grep -q "$tag_name"; then
  remote_tag_exists=true
fi

release_branch="${RELEASE_BRANCH:-}"
if [[ -z "$release_branch" ]]; then
  if git ls-remote --exit-code --heads origin master >/dev/null 2>&1; then
    release_branch="master"
  else
    release_branch="$(git remote show origin | sed -n '/HEAD branch/s/.*: //p')"
  fi
fi

if [[ -z "$release_branch" ]]; then
  echo "Unable to determine release branch. Set RELEASE_BRANCH explicitly and retry."
  exit 1
fi

current_branch="$(git rev-parse --abbrev-ref HEAD)"

echo "Fetching origin/$release_branch..."
git fetch origin "$release_branch"

if [[ "$current_branch" != "$release_branch" ]]; then
  echo "Switching to $release_branch..."
  git checkout "$release_branch"
fi

echo "Updating local $release_branch to origin/$release_branch..."
git pull --ff-only origin "$release_branch"

if git show-ref --verify --quiet "refs/tags/$tag_name"; then
  echo "Removing local tag before recreate: $tag_name"
  git tag -d "$tag_name"
fi

echo "Creating annotated tag $tag_name..."
git tag -a "$tag_name" -m "Release $tag_name"

if [[ "$remote_tag_exists" == "true" ]]; then
  echo "Remote tag already exists, deleting before recreate: $tag_name"
  git push origin ":refs/tags/$tag_name"
else
  echo "Pushing tag $tag_name to origin..."
fi
git push --force origin "refs/tags/$tag_name:refs/tags/$tag_name"

echo "Release tag pushed successfully: $tag_name"
echo "GitHub Actions release workflow should start automatically."