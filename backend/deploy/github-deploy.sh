#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

required=(AWS_HOST AWS_USER AWS_DEPLOY_PATH AWS_SSH_PRIVATE_KEY AWS_SSH_KNOWN_HOSTS GITHUB_SHA GITHUB_RUN_ID GITHUB_RUN_ATTEMPT RUNNER_TEMP GITHUB_WORKSPACE)
for name in "${required[@]}"; do
    if [[ -z "${!name:-}" ]]; then
        echo "Missing GitHub deployment setting: $name" >&2
        exit 1
    fi
done
port=${AWS_SSH_PORT:-22}
if [[ ! "$AWS_HOST" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]*$ ]] ||
   [[ ! "$AWS_USER" =~ ^[a-zA-Z_][a-zA-Z0-9_-]*$ ]] ||
   [[ ! "$AWS_DEPLOY_PATH" =~ ^/([a-zA-Z0-9_.-]+/)*[a-zA-Z0-9_.-]+$ ]] ||
   [[ "/$AWS_DEPLOY_PATH/" == *'/../'* ]] ||
   [[ "/$AWS_DEPLOY_PATH/" == *'/./'* ]] ||
   [[ ! "$port" =~ ^[0-9]{1,5}$ ]] || (( 10#$port < 1 || 10#$port > 65535 )); then
    echo "Invalid AWS host, username, deployment directory or SSH port." >&2
    exit 1
fi
release_id="${GITHUB_SHA}-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}"
if [[ ! "$release_id" =~ ^([a-f0-9]{40}|[a-f0-9]{64})-[0-9]+-[0-9]+$ ]]; then
    echo "Invalid release identifier." >&2
    exit 1
fi

temporary=$(mktemp -d "$RUNNER_TEMP/socialrecipe-deploy.XXXXXX")
trap 'rm -rf "$temporary"' EXIT
printf '%s\n' "$AWS_SSH_PRIVATE_KEY" > "$temporary/key"
printf '%s\n' "$AWS_SSH_KNOWN_HOSTS" > "$temporary/known_hosts"
chmod 600 "$temporary/key" "$temporary/known_hosts"
unset AWS_SSH_PRIVATE_KEY AWS_SSH_KNOWN_HOSTS

ssh_options=(-i "$temporary/key" -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$temporary/known_hosts" -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=4)
target="${AWS_USER}@${AWS_HOST}"
archive="$temporary/backend.tar.gz"
# Runtime credentials stay on the server; only backend source is transferred.
tar -czf "$archive" --exclude=node_modules --exclude=dist --exclude=coverage \
    --exclude=src/generated --exclude=.env --exclude='.env.*' \
    -C "$GITHUB_WORKSPACE/backend" .
archive_sha=$(sha256sum "$archive")
archive_sha=${archive_sha%% *}

ssh "${ssh_options[@]}" -p "$port" "$target" "mkdir -p '$AWS_DEPLOY_PATH/incoming'"
scp "${ssh_options[@]}" -P "$port" "$archive" "$target:$AWS_DEPLOY_PATH/incoming/$release_id.tar.gz"
ssh "${ssh_options[@]}" -p "$port" "$target" \
    "bash -s -- '$AWS_DEPLOY_PATH' '$release_id' '$archive_sha'" \
    < "$GITHUB_WORKSPACE/backend/deploy/deploy-release.sh"
