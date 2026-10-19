#!/bin/sh
set -u
trap 'exit 0' TERM INT

while :; do
    if ! certbot renew --non-interactive --webroot -w /var/www/certbot \
        --deploy-hook 'touch /var/www/certbot/.reload-nginx'; then
        echo "Certificate renewal failed; check Certbot logs. Retrying in 12 hours." >&2
    fi
    sleep 43200 &
    wait "$!"
done
