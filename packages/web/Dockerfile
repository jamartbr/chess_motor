FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY tsconfig.base.json ./
COPY packages/engine ./packages/engine
COPY packages/web ./packages/web

RUN npm ci --workspace=packages/engine --workspace=packages/web
RUN npm run build --workspace=packages/engine
RUN npm run build --workspace=packages/web

# ── Production stage ──────────────────────────────────────────────────────────
FROM nginx:alpine
COPY --from=builder /app/packages/web/dist /usr/share/nginx/html

# SPA routing: fall back to index.html for all routes
COPY <<EOF /etc/nginx/conf.d/default.conf
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|svg|ico|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

EXPOSE 80
