#!/usr/bin/env bash
#
# Deploys the site to Vercel (production).
#
# Vercel's own automatic git deploy for `main` is disabled in
# apps/site/vercel.json (git.deploymentEnabled.main = false) precisely so the
# test-gated CI path is the ONLY way production ships. Preview deploys on PR
# branches are unaffected.
#
# This is the single source of truth for the deploy. It is run by:
#   - .github/workflows/deploy.yml   (CI, on push to main / manual)
#   - a workstation, for an emergency manual production deploy
#
# The Vercel project's Root Directory must be set to apps/site (Project →
# Settings → Build & Output). `vercel pull` brings that setting down into
# .vercel/project.json, so the `build` below honours it. Run this script from
# the repository root regardless.
#
# Credentials (env vars):
#   VERCEL_TOKEN       required — access token (Vercel → Account Settings → Tokens).
#   VERCEL_ORG_ID      required — the Vercel team/org ID.
#   VERCEL_PROJECT_ID  required — the project ID for the site.
set -euo pipefail

if [ -z "${VERCEL_PROJECT_ID:-}" ]; then
  echo "✗ VERCEL_PROJECT_ID is not set — add it to the GitHub repository secrets." >&2
  exit 1
fi

# Pin the CLI version instead of @latest: the Vercel token is in scope while
# this runs, so we don't want to execute whatever the registry happens to serve.
# Bump deliberately. Latest checked: 54.10.2.
VERCEL_CLI_VERSION="${VERCEL_CLI_VERSION:-54.10.2}"
VC="npx --yes vercel@${VERCEL_CLI_VERSION}"

if [ -z "${VERCEL_TOKEN:-}" ]; then
  echo "✗ VERCEL_TOKEN is not set — add it to the GitHub repository secrets." >&2
  exit 1
fi

# Pull the project settings + production env, build, then deploy the prebuilt
# output. Building in CI (rather than letting Vercel build server-side) keeps
# the full build log in the Action.
#
# SECURITY — keep the deploy token out of scope of the frontend dependency tree.
# Only `pull` and `deploy` talk to Vercel and need VERCEL_TOKEN; both run just
# the pinned Vercel CLI above, no project dependencies. `build` runs the whole
# site build (Astro + every third-party module's build-time code), so we run
# it with `env -u VERCEL_TOKEN` — the token is simply not present in the
# environment those modules execute in. After `pull`, the project is linked
# locally (.vercel/project.json), so `build` needs no token anyway.
echo "▶ Pulling Vercel project settings & production environment"
$VC pull --yes --environment=production --token="$VERCEL_TOKEN"

echo "▶ Building (production) — VERCEL_TOKEN deliberately not in scope"
env -u VERCEL_TOKEN $VC build --prod

echo "▶ Deploying prebuilt output to production"
$VC deploy --prebuilt --prod --token="$VERCEL_TOKEN"

echo "✓ deploy complete"
