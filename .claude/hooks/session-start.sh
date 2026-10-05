#!/bin/bash
set -euo pipefail

# Runs at the start of every Claude Code on the web session, so the agent lands
# in a container where the tests actually run. Local machines already have
# these tools, so this is web-only and exits immediately elsewhere.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# ── Astro / Vitest / Playwright ──────────────────────────────────────────────
npm install --no-audit --no-fund
echo "session-start: npm deps installed"

# NOTE ON PLAYWRIGHT: browsers are pre-provisioned in the sandbox image and
# PLAYWRIGHT_BROWSERS_PATH already points at them, so `playwright install` is
# neither needed nor (usually) able to reach its CDN. This is why
# @playwright/test is pinned to a minor version in package.json — the package
# has to match the provisioned browser build. See CLAUDE.md.
