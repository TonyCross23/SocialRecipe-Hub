FROM nginx:stable-alpine
COPY http.conf.template https.conf.template /opt/socialrecipe-nginx/
COPY 40-configure-ssl.sh /docker-entrypoint.d/40-configure-ssl.sh
RUN chmod +x /docker-entrypoint.d/40-configure-ssl.sh
