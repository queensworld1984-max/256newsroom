# 256 Heart — primary domain 256heart.com
# Legacy aliases (dating.256.co.ug, match.256.co.ug) redirect here.

server {
    listen 80;
    listen [::]:80;
    server_name 256heart.com www.256heart.com dating.256.co.ug www.dating.256.co.ug match.256.co.ug www.match.256.co.ug;
    return 301 https://256heart.com$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name www.256heart.com;

    ssl_certificate     /etc/letsencrypt/live/256heart.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/256heart.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    return 301 https://256heart.com$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name 256heart.com;

    ssl_certificate     /etc/letsencrypt/live/256heart.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/256heart.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    client_max_body_size 55m;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Serve user-uploaded photos directly — bypasses Node.js entirely
    location /uploads/ {
        alias /var/www/256heart/uploads/;
        expires 30d;
        add_header Cache-Control "public, max-age=2592000, immutable";
        add_header X-Content-Type-Options "nosniff" always;
        access_log off;
        gzip off;
    }

    location = /news { proxy_pass http://127.0.0.1:5066/api/platforms/256-heart/news-page; proxy_set_header Host $host; }
    location ~ ^/news/([^/]+)$ { proxy_pass http://127.0.0.1:5066/api/platforms/256-heart/news-page/$1; proxy_set_header Host $host; }

    location / {
        proxy_pass http://127.0.0.1:5030;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 120s;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name dating.256.co.ug www.dating.256.co.ug match.256.co.ug www.match.256.co.ug;

    ssl_certificate     /etc/letsencrypt/live/social.256.co.ug/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/social.256.co.ug/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    return 301 https://256heart.com$request_uri;
}
