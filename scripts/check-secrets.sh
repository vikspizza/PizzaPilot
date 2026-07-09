#!/usr/bin/env sh
set -eu

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v gitleaks >/dev/null 2>&1; then
  echo "gitleaks is not installed."
  echo "Install it with: brew install gitleaks"
  echo "Then re-run your commit."
  exit 1
fi

if [ "${1:-}" = "--all" ]; then
  gitleaks detect --config .gitleaks.toml --verbose
else
  gitleaks protect --staged --config .gitleaks.toml --verbose
fi
