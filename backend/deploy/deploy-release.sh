#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

deploy_root=${1:?Usage: deploy-release.sh ABSOLUTE_DEPLOY_PATH RELEASE_ID ARCHIVE_SHA256}
release_id=${2:?Release ID is required}
archive_sha=${3:?Archive checksum is required}
if [[ ! "$deploy_root" =~ ^/([a-zA-Z0-9_.-]+/)*[a-zA-Z0-9_.-]+$ ]] ||
   [[ "/$deploy_root/" == *'/../'* ]] || [[ "/$deploy_root/" == *'/./'* ]] ||
   [[ ! "$release_id" =~ ^([a-f0-9]{40}|[a-f0-9]{64})-[0-9]+-[0-9]+$ ]] ||
   [[ ! "$archive_sha" =~ ^[a-f0-9]{64}$ ]]; then
    echo "Invalid deployment directory, release identifier or checksum." >&2
    exit 1
fi
for command in docker curl tar gzip sha256sum flock; do
    command -v "$command" >/dev/null || { echo "Server dependency missing: $command" >&2; exit 1; }
done
mkdir -p "$deploy_root/releases" "$deploy_root/shared/backups"
exec 9> "$deploy_root/.deploy.lock"
flock -w 900 9 || { echo "Another deployment is still running." >&2; exit 1; }

environment="$deploy_root/shared/.env.production"
archive="$deploy_root/incoming/$release_id.tar.gz"
release="$deploy_root/releases/$release_id"
if [[ ! -r "$environment" ]]; then
    echo "Place the production environment at $environment before enabling AWS deployment." >&2
    exit 1
fi
printf '%s  %s\n' "$archive_sha" "$archive" | sha256sum -c -
mkdir "$release"
tar -xzf "$archive" --no-same-owner -C "$release"
ln -s "$environment" "$release/.env.production"
compose=(docker compose --project-name socialrecipe-production --env-file "$environment" -f "$release/compose.production.yaml")
"${compose[@]}" config --quiet
"${compose[@]}" build --pull
"${compose[@]}" up -d --wait --wait-timeout 120 postgres

# Publish a backup only when pg_dump and gzip both succeed. This runs before
# migrations, and a failure stops the rollout rather than continuing without it.
backup="$deploy_root/shared/backups/$release_id.sql.gz"
"${compose[@]}" exec -T postgres pg_dump -U recipe -d socialrecipe | gzip > "$backup.incomplete"
mv "$backup.incomplete" "$backup"

"${compose[@]}" up -d --wait --wait-timeout 180
if ! "${compose[@]}" exec -T nginx test -s /etc/letsencrypt/live/socialrecipe-api/fullchain.pem; then
    echo "Initialize HTTPS with production:ssl on the server before enabling automatic deployment." >&2
    exit 1
fi
domain=$("${compose[@]}" exec -T nginx printenv API_DOMAIN)
domain=${domain//$'\r'/}
if [[ ! "$domain" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]$ ]]; then
    echo "Invalid API_DOMAIN in the production environment." >&2
    exit 1
fi
curl --fail --silent --show-error --retry 12 --retry-connrefused --retry-delay 5 \
    --max-time 10 "https://$domain/health/ready" > /dev/null

ln -s "releases/$release_id" "$deploy_root/.current-$release_id"
mv -Tf "$deploy_root/.current-$release_id" "$deploy_root/current"
printf '%s\n' "$release_id" > "$release/DEPLOYED_RELEASE"
rm -f "$archive"
echo "Deployed $release_id; HTTPS readiness passed."
