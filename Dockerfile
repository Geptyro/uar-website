# SvelteKit site on adapter-node: all pages are prerendered at build time, the
# node server serves them plus the replay upload API (/api/replays), which
# parses uploads in-process and commits accepted replays to GitHub.
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

EXPOSE 8080
CMD ["node", "build"]
