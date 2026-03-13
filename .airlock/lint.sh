#!/usr/bin/env bash
set -euo pipefail

BASE_SHA="${AIRLOCK_BASE_SHA}"
HEAD_SHA="${AIRLOCK_HEAD_SHA}"

if [[ -z "${BASE_SHA}" || -z "${HEAD_SHA}" ]]; then
  echo "AIRLOCK_BASE_SHA and AIRLOCK_HEAD_SHA must be set" >&2
  exit 1
fi

changed_files=()
while IFS= read -r file; do
  [[ -n "${file}" ]] || continue
  [[ -f "${file}" ]] || continue
  changed_files+=("${file}")
done < <(git diff --name-only --diff-filter=ACMRTUXB "${BASE_SHA}" "${HEAD_SHA}")

if [[ ${#changed_files[@]} -eq 0 ]]; then
  echo "No changed files in range ${BASE_SHA}..${HEAD_SHA}"
  exit 0
fi

prettier_files=()
eslint_files=()
rust_files=()

for file in "${changed_files[@]}"; do
  case "${file}" in
    *.js|*.jsx|*.mjs|*.cjs|*.ts|*.tsx)
      prettier_files+=("${file}")
      eslint_files+=("${file}")
      ;;
    *.json|*.jsonc|*.md|*.mdx|*.yaml|*.yml|*.css|*.scss|*.less|*.html|*.vue|*.svelte|*.graphql|*.gql)
      prettier_files+=("${file}")
      ;;
    *.rs)
      rust_files+=("${file}")
      ;;
  esac
done

if [[ ${#prettier_files[@]} -gt 0 || ${#eslint_files[@]} -gt 0 ]]; then
  if ! command -v npm >/dev/null 2>&1; then
    echo "npm is required for prettier/eslint" >&2
    exit 1
  fi

  if [[ ! -d node_modules ]]; then
    echo "Installing npm dependencies..."
    npm_config_engine_strict=false npm ci
  fi
fi

# Formatters (auto-fix)
if [[ ${#prettier_files[@]} -gt 0 ]]; then
  npx --no-install prettier --write "${prettier_files[@]}"
fi

if [[ ${#rust_files[@]} -gt 0 ]]; then
  cargo fmt
fi

# Linters (auto-fix)
if [[ ${#eslint_files[@]} -gt 0 ]]; then
  npx --no-install eslint --fix "${eslint_files[@]}"
fi

if [[ ${#rust_files[@]} -gt 0 ]]; then
  cargo clippy --fix --allow-dirty --allow-staged --workspace --exclude airlock-app -- -D warnings || true
fi

# Verification checks
if [[ ${#prettier_files[@]} -gt 0 ]]; then
  npx --no-install prettier --check "${prettier_files[@]}"
fi

if [[ ${#eslint_files[@]} -gt 0 ]]; then
  npx --no-install eslint "${eslint_files[@]}"
fi

if [[ ${#rust_files[@]} -gt 0 ]]; then
  cargo clippy --workspace --exclude airlock-app -- -D warnings
fi

echo "Lint/format checks passed for changed files in ${BASE_SHA}..${HEAD_SHA}"
