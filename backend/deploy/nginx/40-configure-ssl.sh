#!/bin/sh
set -eu

case "${API_DOMAIN:-}" in
    ''|.*|*.|*[!a-zA-Z0-9.-]*)
        echo "API_DOMAIN must be a hostname without a scheme, path or whitespace." >&2
        exit 1
        ;;
esac

render_config() {
    template=/opt/socialrecipe-nginx/http.conf.template
    if [ -s /etc/letsencrypt/live/socialrecipe-api/fullchain.pem ] &&
       [ -s /etc/letsencrypt/live/socialrecipe-api/privkey.pem ]; then
        template=/opt/socialrecipe-nginx/https.conf.template
    fi
    # Substitute the domain only; preserve Nginx's own $uri/$host variables.
    envsubst '${API_DOMAIN}' < "$template" > /etc/nginx/conf.d/default.conf
}

render_config

# Certbot writes this marker only after a certificate is successfully issued or
# renewed. Reload Nginx without mounting the Docker socket in either container.
(
    while sleep 5; do
        if [ -f /var/www/certbot/.reload-nginx ]; then
            render_config
            if nginx -t && nginx -s reload; then
                rm -f /var/www/certbot/.reload-nginx
            fi
        fi
    done
) &
