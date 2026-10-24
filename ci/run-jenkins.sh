#!/bin/sh
# Runs the Jenkins job, waits for it to finish, prints the summary, and copies
# that run's results into mcp-project/ so the ci-triage-agent can read them.
#
# Usage: ci/run-jenkins.sh
# Env overrides: JENKINS_URL, JENKINS_JOB, JENKINS_USER_ID, JENKINS_TOKEN_FILE
#   (JENKINS_TOKEN_FILE defaults to the setup password file; if you changed the
#   admin password, put an API token in a file and point this at it.)
set -eu

JENKINS_URL=${JENKINS_URL:-http://127.0.0.1:8080/}
JOB=${JENKINS_JOB:-mcp-playwright-project}
JHOME=${JENKINS_HOME:-$HOME/.jenkins}
TOKEN_FILE=${JENKINS_TOKEN_FILE:-$JHOME/secrets/initialAdminPassword}
CLI_JAR=$JHOME/jenkins-cli.jar
ROOT=$(cd "$(dirname "$0")/.." && pwd)
export PATH="/opt/homebrew/opt/openjdk@21/bin:/opt/homebrew/bin:$PATH"

[ -f "$CLI_JAR" ] || curl -sf -o "$CLI_JAR" "${JENKINS_URL}jnlpJars/jenkins-cli.jar"
export JENKINS_USER_ID=${JENKINS_USER_ID:-admin}
JENKINS_API_TOKEN=$(cat "$TOKEN_FILE")
export JENKINS_API_TOKEN

log=$(mktemp)
# -f waits for the build; it exits non-zero for UNSTABLE/FAILURE, which we report below.
java -jar "$CLI_JAR" -s "$JENKINS_URL" -http build "$JOB" -f -v > "$log" 2>&1 || true
grep -E '^Started|Running [0-9]+ tests|[0-9]+ (passed|failed|flaky|skipped)|Sending email|^Finished:' "$log" || tail -20 "$log"

# Evidence for triage: same paths the ci-triage-agent expects.
WS=$JHOME/workspace/$JOB/mcp-project
rm -rf "$ROOT/mcp-project/results" "$ROOT/mcp-project/test-results"
cp -R "$WS/results" "$ROOT/mcp-project/results" 2>/dev/null || true
cp -R "$WS/test-results" "$ROOT/mcp-project/test-results" 2>/dev/null || true
rm -f "$log"
