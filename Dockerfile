# SvelteKit site on adapter-node: the wiki pages are prerendered at build time,
# the node server serves them plus the SSR player/replay pages and the upload
# API (/api/replays), which parses uploads in a worker thread (build/
# replay-worker.mjs) and stores accepted replays in MongoDB and Tigris.
#
# Started through server.js rather than `node build`, for the static-asset cache
# policy that wrapper adds.
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json .npmrc* ./
RUN npm ci

COPY . .
RUN npm run build && npm prune --omit=dev

# --- runtime image ------------------------------------------------------------
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
# wraps build/handler.js to set Cache-Control on the static art; see server.js
COPY --from=builder /app/server.js ./server.js

EXPOSE 8080
CMD ["node", "server.js"]
