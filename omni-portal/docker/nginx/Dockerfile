FROM nginx:1.24-alpine

# Install certbot for SSL certificates
RUN apk add --no-cache certbot certbot-nginx

# Remove default nginx config
RUN rm -rf /etc/nginx/conf.d/default.conf

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Create necessary directories
RUN mkdir -p /var/www/backend /var/www/frontend /etc/nginx/ssl

# Set proper permissions
RUN chown -R nginx:nginx /var/www

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
