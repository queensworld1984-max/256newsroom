server {
    server_name 256express.com www.256express.com;

    real_ip_header CF-Connecting-IP;
    set_real_ip_from 0.0.0.0/0;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(self), microphone=(), camera=(), payment=()" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' https: wss:; frame-ancestors 'self'; object-src 'none'; base-uri 'self'; form-action 'self'" always;

    root /var/www/256express/frontend/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:5040;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:5040;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location = /news { proxy_pass http://127.0.0.1:5066/api/platforms/256-express/news-page; proxy_set_header Host $host; }
    location ~ ^/news/([^/]+)$ { proxy_pass http://127.0.0.1:5066/api/platforms/256-express/news-page/$1; proxy_set_header Host $host; }

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }

    listen [::]:443 ssl; # managed by Certbot
    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/256express.com/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/256express.com/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot


}
server {
    if ($host = www.256express.com) {
        return 301 https://$host$request_uri;
    } # managed by Certbot


    if ($host = 256express.com) {
        return 301 https://$host$request_uri;
    } # managed by Certbot


    listen 80;
    listen [::]:80;
    server_name 256express.com www.256express.com;
    return 404; # managed by Certbot




}
