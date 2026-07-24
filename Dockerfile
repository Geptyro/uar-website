# Fully prerendered SvelteKit site (adapter-static, see vite.config.ts) — the
# runtime image is just Caddy serving the build/ directory. No Node in prod.
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json .npmrc* ./
RUN npm ci

COPY . .
RUN npm run build

# --- runtime image ------------------------------------------------------------
FROM caddy:2-alpine

# Site-local Caddy config: static file_server with SvelteKit's *.html mapping
# and immutable caching for hashed assets. The cdd-gateway terminates TLS and
# forwards over .flycast; this app is never public.
COPY Caddyfile.site /etc/caddy/Caddyfile
COPY --from=builder /app/build /srv

EXPOSE 8080
