# Laravel specific location blocks
location / {
    try_files $uri $uri/ /index.php?$query_string;
}

# API routes with rate limiting
# Handle Sanctum CSRF cookie route
location = /sanctum/csrf-cookie {
    try_files $uri /index.php?$query_string;
    
    add_header 'Access-Control-Allow-Origin' "http://localhost:3004" always;
    add_header 'Access-Control-Allow-Credentials' 'true' always;
    add_header 'Access-Control-Allow-Methods' 'GET, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'Accept,Authorization,Cache-Control,Content-Type,DNT,If-Modified-Since,Keep-Alive,Origin,User-Agent,X-Requested-With,X-CSRF-TOKEN,X-XSRF-TOKEN' always;
}

location ~ ^/api {
    limit_req zone=api burst=20 nodelay;
    limit_conn addr 10;
    
    try_files $uri $uri/ /index.php?$query_string;
    
    # CORS headers for API
    add_header 'Access-Control-Allow-Origin' "http://localhost:3004" always;
    add_header 'Access-Control-Allow-Credentials' 'true' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'Accept,Authorization,Cache-Control,Content-Type,DNT,If-Modified-Since,Keep-Alive,Origin,User-Agent,X-Requested-With,X-CSRF-TOKEN,X-XSRF-TOKEN' always;
    add_header 'Access-Control-Expose-Headers' 'X-CSRF-TOKEN,X-XSRF-TOKEN' always;
    
    if ($request_method = 'OPTIONS') {
        add_header 'Access-Control-Max-Age' 1728000;
        add_header 'Content-Type' 'text/plain charset=UTF-8';
        add_header 'Content-Length' 0;
        return 204;
    }
}

# Health check endpoint
location = /health {
    access_log off;
    add_header 'Content-Type' 'application/json';
    return 200 '{"status":"healthy"}';
}

# PHP processing
location ~ \.php$ {
    fastcgi_pass backend;
    fastcgi_index index.php;
    fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
    include fastcgi_params;
    fastcgi_buffer_size 32k;
    fastcgi_buffers 8 16k;
    fastcgi_busy_buffers_size 32k;
    fastcgi_temp_file_write_size 256k;
    fastcgi_read_timeout 120;
    fastcgi_send_timeout 120;
    fastcgi_connect_timeout 60;
    
    # Hide PHP version
    fastcgi_hide_header X-Powered-By;
    
    # Security headers for PHP responses
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}

# Static file handling with caching
location ~* \.(jpg|jpeg|gif|png|svg|webp|ico|css|js|eot|ttf|otf|woff|woff2)$ {
    expires 30d;
    add_header Cache-Control "public, immutable";
    add_header Vary "Accept-Encoding";
    access_log off;
    
    # Enable gzip for static files
    gzip_static on;
    
    # Rate limiting for static files
    limit_req zone=static burst=50 nodelay;
}

# Laravel storage files
location ^~ /storage/ {
    alias /var/www/html/storage/app/public/;
    expires 30d;
    add_header Cache-Control "public";
    add_header X-Content-Type-Options "nosniff";
    
    # Prevent execution of uploaded files
    location ~* \.(php|php3|php4|php5|php7|phtml|pl|py|jsp|asp|sh|cgi)$ {
        deny all;
    }
}

# Deny access to sensitive files
location ~ /\.(?!well-known).* {
    deny all;
}

location ~ /\.env {
    deny all;
}

location ~ /\.git {
    deny all;
}

location ~ composer\.(json|lock) {
    deny all;
}

location ~ package(-lock)?\.json {
    deny all;
}

location ~ /node_modules {
    deny all;
}

location ~ /vendor {
    deny all;
}

# Security for uploads directory
location ~* /uploads/.*\.php$ {
    deny all;
}

# Monitoring endpoints
location /nginx-status {
    stub_status on;
    access_log off;
    allow 127.0.0.1;
    allow 172.20.0.0/16;
    deny all;
}

location ~ ^/(status|ping)$ {
    access_log off;
    allow 127.0.0.1;
    allow 172.20.0.0/16;
    deny all;
    fastcgi_pass backend;
    fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
    include fastcgi_params;
}

# Error pages
error_page 404 /404.html;
error_page 500 502 503 504 /50x.html;

location = /404.html {
    internal;
    root /usr/share/nginx/html;
}

location = /50x.html {
    internal;
    root /usr/share/nginx/html;
}